import { Router, type IRouter } from "express";
import { db, tenantsTable, providerConnectionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getTenant } from "../lib/req-tenant";

const router: IRouter = Router();

// Cross-app onboarding summary. Even though the tenantId is in the path, the
// request must already be tenant-resolved (via x-samax-tenant) and the path
// tenantId must match — preventing arbitrary cross-tenant probing.
const STAGES = [
  { number: 1, title: "Conectar" },
  { number: 2, title: "Descobrir" },
  { number: 3, title: "Decidir" },
  { number: 4, title: "Capturar valor" },
];

router.get("/tenants/:tenantId/onboarding-summary", async (req, res) => {
  const { tenantId } = req.params;
  const resolved = getTenant(req);
  if (resolved.tenantId !== tenantId) {
    res.status(403).json({ error: "tenant_mismatch" });
    return;
  }
  const tenant = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  if (!tenant[0]) {
    res.status(404).json({ error: "unknown_tenant", tenantId });
    return;
  }

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      ok: sql<number>`count(*) filter (where ${providerConnectionsTable.status} = 'ok')::int`,
    })
    .from(providerConnectionsTable)
    .where(eq(providerConnectionsTable.tenantId, tenantId));

  const connectionCount = Number(counts?.total ?? 0);
  const okCount = Number(counts?.ok ?? 0);
  const hasActiveConnection = okCount > 0;

  // Derive a coarse stage estimate from connection state. Backend currently
  // doesn't track per-step state for the onboarding journey, so this is a
  // conservative inference: stage 1 (Conectar) completes once at least one
  // connection is OK; further stages remain in progress until proper backend
  // state lands (Task #3).
  const stagesCompleted = hasActiveConnection ? 1 : 0;
  const currentStageIdx = Math.min(stagesCompleted, STAGES.length - 1);
  const currentStage = STAGES[currentStageIdx];

  res.json({
    tenantId,
    hasActiveConnection,
    connectionCount,
    stagesTotal: STAGES.length,
    stagesCompleted,
    currentStage,
  });
});

export default router;
