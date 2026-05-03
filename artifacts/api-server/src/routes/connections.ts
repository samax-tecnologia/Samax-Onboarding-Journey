import { Router, type IRouter } from "express";
import { getTenant } from "../lib/req-tenant.js";
import { db, providerConnectionsTable, baselinesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { runSync } from "../lib/sync";
import { getAdapter } from "../lib/adapters";
import { liveHasData } from "../lib/focus-live";
import { loadDataset } from "../lib/focus-aggregate";
import { buildBaselineMetrics } from "../lib/report-compute";
import type { Logger } from "pino";

const router: IRouter = Router();

const ALLOWED_PROVIDERS = ["sample", "aws", "azure", "gcp"] as const;

const ConnectionInput = z.object({
  provider: z.enum(ALLOWED_PROVIDERS),
  displayName: z.string().min(1).max(120),
  config: z.record(z.string(), z.unknown()).optional(),
  secretRef: z.string().min(1).max(120).optional(),
  refreshIntervalHours: z.enum(["4", "24"]).optional(),
});

function serialize(c: typeof providerConnectionsTable.$inferSelect) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    provider: c.provider,
    displayName: c.displayName,
    config: c.config ?? {},
    secretRef: c.secretRef ?? undefined,
    status: c.status,
    lastError: c.lastError ?? undefined,
    lastSyncedAt: c.lastSyncedAt?.toISOString(),
    nextSyncAt: c.nextSyncAt?.toISOString(),
    refreshIntervalHours: c.refreshIntervalHours,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/connections", async (req, res) => {
  const { tenantId, tenantDataSource } = getTenant(req);
  const rows = await db
    .select()
    .from(providerConnectionsTable)
    .where(eq(providerConnectionsTable.tenantId, tenantId))
    .orderBy(desc(providerConnectionsTable.createdAt));
  const hasLive = await liveHasData(tenantId).catch(() => false);
  res.json({
    tenantId,
    dataSource: tenantDataSource,
    hasLiveData: hasLive,
    connections: rows.map(serialize),
  });
});

router.post("/connections", async (req, res) => {
  const { tenantId } = getTenant(req);
  const parsed = ConnectionInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", issues: parsed.error.issues });
    return;
  }
  if (parsed.data.refreshIntervalHours === "4" && parsed.data.provider !== "azure") {
    res.status(400).json({ error: "invalid_refresh_interval", detail: "4h refresh only available for Azure connections." });
    return;
  }
  const [created] = await db
    .insert(providerConnectionsTable)
    .values({
      tenantId,
      provider: parsed.data.provider,
      displayName: parsed.data.displayName,
      config: parsed.data.config ?? {},
      secretRef: parsed.data.secretRef ?? null,
      refreshIntervalHours: parsed.data.refreshIntervalHours ?? "24",
    })
    .returning();
  if (!created) {
    res.status(500).json({ error: "insert_failed" });
    return;
  }
  // Best-effort probe; we surface errors via status, never block creation.
  const adapter = getAdapter(parsed.data.provider);
  if (adapter) {
    const probe = await adapter.probe(created).catch((err) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    }));
    if (probe.ok) {
      await db
        .update(providerConnectionsTable)
        .set({ status: "ok", lastError: null })
        .where(eq(providerConnectionsTable.id, created.id));
      created.status = "ok";
      created.lastError = null;
    } else {
      await db
        .update(providerConnectionsTable)
        .set({ status: "pending", lastError: probe.error })
        .where(eq(providerConnectionsTable.id, created.id));
      created.status = "pending";
      created.lastError = probe.error;
    }
  }
  res.status(201).json(serialize(created));
});

router.delete("/connections/:id", async (req, res) => {
  const { tenantId } = getTenant(req);
  const { id } = req.params;
  await db
    .delete(providerConnectionsTable)
    .where(and(eq(providerConnectionsTable.id, id), eq(providerConnectionsTable.tenantId, tenantId)));
  res.status(204).end();
});

router.post("/connections/:id/sync", async (req, res) => {
  const { tenantId, tenantDataSource } = getTenant(req);
  const { id } = req.params;
  const [conn] = await db
    .select()
    .from(providerConnectionsTable)
    .where(and(eq(providerConnectionsTable.id, id), eq(providerConnectionsTable.tenantId, tenantId)))
    .limit(1);
  if (!conn) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const result = await runSync(conn, { trigger: "manual" });
  // Best-effort: ensure an active baseline exists once the tenant has any
  // synced data. This makes the onboarding "Conectar" step automatically yield
  // a baseline, so the next report generated has a meaningful comparison.
  await ensureInitialBaseline(tenantId, tenantDataSource, req.log).catch(() => undefined);
  res.json(result);
});

// Auto-create a "first-light" baseline the first time the tenant has billing
// data. Uses the most recent up-to-3-month window in the dataset.
async function ensureInitialBaseline(
  tenantId: string,
  tenantDataSource: "mock" | "live",
  log: Logger,
): Promise<void> {
  const existing = await db
    .select({ id: baselinesTable.id })
    .from(baselinesTable)
    .where(eq(baselinesTable.tenantId, tenantId))
    .limit(1);
  if (existing.length > 0) return;

  const ds = await loadDataset(tenantId, tenantDataSource);
  if (ds.monthlyRows.length === 0) return;

  const end = new Date(Date.UTC(ds.endDate.getUTCFullYear(), ds.endDate.getUTCMonth() + 1, 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 3, 1));
  const m = buildBaselineMetrics(ds, start, end, "EffectiveCost");
  if (m.totalCost <= 0) return;

  await db
    .update(baselinesTable)
    .set({ isActive: "false" })
    .where(eq(baselinesTable.tenantId, tenantId));
  await db.insert(baselinesTable).values({
    tenantId,
    label: "Baseline inicial (auto)",
    periodStart: start,
    periodEnd: end,
    costType: "EffectiveCost",
    totalCost: m.totalCost,
    metrics: {
      monthlyAvg: m.monthlyAvg,
      months: m.months,
      byService: m.byService,
      byCategory: m.byCategory,
      byProvider: m.byProvider,
      byTeam: m.byTeam,
      byProduct: m.byProduct,
    },
    source: "auto",
    isActive: "true",
  });
  log.info({ tenantId, start, end }, "Auto-created initial baseline after first sync");
}

export default router;
