import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  baselinesTable,
  appliedChangesTable,
  optimizationReportsTable,
  type Baseline,
  type AppliedChange,
} from "@workspace/db";
import { getTenant } from "../lib/req-tenant";
import {
  buildBaselineMetrics,
  computeReport,
  type ComputedReport,
} from "../lib/report-compute";
import { loadDataset, parseDate, type CostType } from "../lib/focus-aggregate";
import { renderReportPdf } from "../lib/report-pdf";
import {
  CreateBaselineBody,
  CreateAppliedChangeBody,
  UpdateAppliedChangeBody,
  CreateOptimizationReportBody,
} from "@workspace/api-zod";

const CURRENCY = "USD";
const router: IRouter = Router();

// ---------- Baselines ----------

function serializeBaseline(b: Baseline) {
  return {
    id: b.id,
    tenantId: b.tenantId,
    label: b.label,
    periodStart: b.periodStart.toISOString().slice(0, 10),
    periodEnd: b.periodEnd.toISOString().slice(0, 10),
    costType: b.costType,
    currency: CURRENCY,
    totalCost: b.totalCost,
    monthlyAvg: b.metrics.monthlyAvg,
    months: b.metrics.months,
    source: b.source,
    isActive: b.isActive === "true",
    createdAt: b.createdAt.toISOString(),
    byService: b.metrics.byService,
    byCategory: b.metrics.byCategory,
    byProvider: b.metrics.byProvider,
    byTeam: b.metrics.byTeam,
    byProduct: b.metrics.byProduct,
  };
}

router.get("/tenants/:tenantId/baselines", async (req, res) => {
  const { tenantId } = req.params;
  const resolved = getTenant(req);
  if (resolved.tenantId !== tenantId) {
    res.status(403).json({ error: "tenant_mismatch" });
    return;
  }
  const rows = await db
    .select()
    .from(baselinesTable)
    .where(eq(baselinesTable.tenantId, tenantId))
    .orderBy(desc(baselinesTable.createdAt));
  res.json(rows.map(serializeBaseline));
});

router.post("/tenants/:tenantId/baselines", async (req, res) => {
  const { tenantId } = req.params;
  const resolved = getTenant(req);
  if (resolved.tenantId !== tenantId) {
    res.status(403).json({ error: "tenant_mismatch" });
    return;
  }
  const parsed = CreateBaselineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", issues: parsed.error.issues });
    return;
  }
  const start = parseDate(parsed.data.periodStart);
  const end = parseDate(parsed.data.periodEnd);
  if (!start || !end || start >= end) {
    res.status(400).json({ error: "invalid_period" });
    return;
  }
  const costType: CostType =
    parsed.data.costType === "BilledCost" ? "BilledCost" : "EffectiveCost";
  const ds = await loadDataset(tenantId, resolved.tenantDataSource);
  if (ds.monthlyRows.length === 0) {
    res.status(409).json({ error: "no_data" });
    return;
  }
  const m = buildBaselineMetrics(ds, start, end, costType);
  if (m.totalCost <= 0) {
    res.status(409).json({ error: "no_cost_in_period" });
    return;
  }
  const setActive = parsed.data.setActive !== false;
  if (setActive) {
    await db
      .update(baselinesTable)
      .set({ isActive: "false" })
      .where(eq(baselinesTable.tenantId, tenantId));
  }
  const [created] = await db
    .insert(baselinesTable)
    .values({
      tenantId,
      label: parsed.data.label,
      periodStart: start,
      periodEnd: end,
      costType,
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
      source: parsed.data.source ?? "manual",
      isActive: setActive ? "true" : "false",
    })
    .returning();
  if (!created) {
    res.status(500).json({ error: "insert_failed" });
    return;
  }
  res.status(201).json(serializeBaseline(created));
});

// ---------- Applied changes ----------

function serializeChange(c: AppliedChange) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    opportunityId: c.opportunityId ?? null,
    title: c.title,
    description: c.description ?? null,
    scopeProvider: c.scopeProvider ?? null,
    scopeService: c.scopeService ?? null,
    scopeCategory: c.scopeCategory ?? null,
    scopeTeam: c.scopeTeam ?? null,
    scopeProduct: c.scopeProduct ?? null,
    scopeResourceId: c.scopeResourceId ?? null,
    appliedAt: c.appliedAt.toISOString(),
    author: c.author ?? null,
    estimatedMonthlySavings: c.estimatedMonthlySavings,
    realizedMonthlySavingsOverride: c.realizedMonthlySavingsOverride ?? null,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/applied-changes", async (req, res) => {
  const { tenantId } = getTenant(req);
  const rows = await db
    .select()
    .from(appliedChangesTable)
    .where(eq(appliedChangesTable.tenantId, tenantId))
    .orderBy(desc(appliedChangesTable.appliedAt));
  res.json(rows.map(serializeChange));
});

router.post("/applied-changes", async (req, res) => {
  const { tenantId } = getTenant(req);
  const parsed = CreateAppliedChangeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", issues: parsed.error.issues });
    return;
  }
  const appliedAt = parseDate(parsed.data.appliedAt);
  if (!appliedAt) {
    res.status(400).json({ error: "invalid_applied_at" });
    return;
  }
  const [created] = await db
    .insert(appliedChangesTable)
    .values({
      tenantId,
      opportunityId: parsed.data.opportunityId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      scopeProvider: parsed.data.scopeProvider ?? null,
      scopeService: parsed.data.scopeService ?? null,
      scopeCategory: parsed.data.scopeCategory ?? null,
      scopeTeam: parsed.data.scopeTeam ?? null,
      scopeProduct: parsed.data.scopeProduct ?? null,
      scopeResourceId: parsed.data.scopeResourceId ?? null,
      appliedAt,
      author: parsed.data.author ?? null,
      estimatedMonthlySavings: parsed.data.estimatedMonthlySavings,
      realizedMonthlySavingsOverride: parsed.data.realizedMonthlySavingsOverride ?? null,
    })
    .returning();
  if (!created) {
    res.status(500).json({ error: "insert_failed" });
    return;
  }
  res.status(201).json(serializeChange(created));
});

router.patch("/applied-changes/:id", async (req, res) => {
  const { tenantId } = getTenant(req);
  const { id } = req.params;
  const parsed = UpdateAppliedChangeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", issues: parsed.error.issues });
    return;
  }
  const update: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.description !== undefined) update.description = parsed.data.description;
  if (parsed.data.appliedAt !== undefined) {
    const d = parseDate(parsed.data.appliedAt);
    if (!d) {
      res.status(400).json({ error: "invalid_applied_at" });
      return;
    }
    update.appliedAt = d;
  }
  if (parsed.data.author !== undefined) update.author = parsed.data.author;
  if (parsed.data.estimatedMonthlySavings !== undefined) {
    update.estimatedMonthlySavings = parsed.data.estimatedMonthlySavings;
  }
  if (parsed.data.realizedMonthlySavingsOverride !== undefined) {
    update.realizedMonthlySavingsOverride = parsed.data.realizedMonthlySavingsOverride;
  }
  if (parsed.data.status !== undefined) update.status = parsed.data.status;

  const [updated] = await db
    .update(appliedChangesTable)
    .set(update)
    .where(and(eq(appliedChangesTable.id, id), eq(appliedChangesTable.tenantId, tenantId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(serializeChange(updated));
});

router.delete("/applied-changes/:id", async (req, res) => {
  const { tenantId } = getTenant(req);
  const { id } = req.params;
  await db
    .delete(appliedChangesTable)
    .where(and(eq(appliedChangesTable.id, id), eq(appliedChangesTable.tenantId, tenantId)));
  res.status(204).end();
});

// ---------- Optimization reports ----------

type StoredReport = typeof optimizationReportsTable.$inferSelect;

function summary(r: StoredReport) {
  return {
    id: r.id,
    tenantId: r.tenantId,
    title: r.title,
    periodStart: r.periodStart.toISOString().slice(0, 10),
    periodEnd: r.periodEnd.toISOString().slice(0, 10),
    baselineId: r.baselineId ?? null,
    baselineLabel: r.baselineLabel ?? null,
    author: r.author ?? null,
    currency: CURRENCY,
    totalCost: r.totalCost,
    baselineProjectedCost: r.baselineProjectedCost,
    realizedSavings: r.realizedSavings,
    appliedChangesCount: Math.round(r.appliedChangesCount),
    pdfUrl: `/api/optimization-reports/${r.id}/pdf`,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/optimization-reports", async (req, res) => {
  const { tenantId } = getTenant(req);
  const rows = await db
    .select()
    .from(optimizationReportsTable)
    .where(eq(optimizationReportsTable.tenantId, tenantId))
    .orderBy(desc(optimizationReportsTable.createdAt));
  res.json(rows.map(summary));
});

router.post("/optimization-reports", async (req, res) => {
  const { tenantId, tenantDataSource } = getTenant(req);
  const parsed = CreateOptimizationReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", issues: parsed.error.issues });
    return;
  }
  const start = parseDate(parsed.data.periodStart);
  const end = parseDate(parsed.data.periodEnd);
  if (!start || !end || start >= end) {
    res.status(400).json({ error: "invalid_period" });
    return;
  }
  const costType: CostType =
    parsed.data.costType === "BilledCost" ? "BilledCost" : "EffectiveCost";

  // Resolve baseline: explicit -> active -> most recent
  let baseline: Baseline | undefined;
  if (parsed.data.baselineId) {
    const [b] = await db
      .select()
      .from(baselinesTable)
      .where(
        and(
          eq(baselinesTable.id, parsed.data.baselineId),
          eq(baselinesTable.tenantId, tenantId),
        ),
      );
    baseline = b;
  } else {
    const candidates = await db
      .select()
      .from(baselinesTable)
      .where(eq(baselinesTable.tenantId, tenantId))
      .orderBy(desc(baselinesTable.createdAt));
    baseline = candidates.find((b) => b.isActive === "true") ?? candidates[0];
  }
  if (!baseline) {
    res.status(409).json({ error: "no_baseline", detail: "Crie um baseline antes de gerar relatórios." });
    return;
  }

  const changes = await db
    .select()
    .from(appliedChangesTable)
    .where(eq(appliedChangesTable.tenantId, tenantId));

  const computed = await computeReport({
    tenantId,
    tenantDataSource,
    periodStart: start,
    periodEnd: end,
    costType,
    baseline,
    appliedChanges: changes,
  });

  const [created] = await db
    .insert(optimizationReportsTable)
    .values({
      tenantId,
      title: parsed.data.title,
      periodStart: start,
      periodEnd: end,
      baselineId: baseline.id,
      baselineLabel: baseline.label,
      author: parsed.data.author ?? null,
      totalCost: computed.totalCost,
      baselineProjectedCost: computed.baselineProjectedCost,
      realizedSavings: computed.realizedSavings,
      appliedChangesCount: computed.appliedChangesCount,
      payload: computed,
    })
    .returning();
  if (!created) {
    res.status(500).json({ error: "insert_failed" });
    return;
  }

  // Render and persist the PDF binary so re-downloads are served from a frozen
  // artifact rather than recomputing/regenerating on every request.
  try {
    const pdfBuf = await renderReportPdf({
      title: created.title,
      createdAt: created.createdAt,
      tenantId,
      report: computed,
    });
    await db
      .update(optimizationReportsTable)
      .set({
        pdfBytes: pdfBuf,
        pdfBytesSize: pdfBuf.length,
        pdfGeneratedAt: new Date(),
      })
      .where(eq(optimizationReportsTable.id, created.id));
  } catch (err) {
    req.log.error({ err, reportId: created.id }, "Failed to persist report PDF at creation");
    // Non-fatal: the /pdf route will fall back to on-demand rendering.
  }

  res.status(201).json({ ...summary(created), sections: computed.sections });
});

router.get("/optimization-reports/:id", async (req, res) => {
  const { tenantId } = getTenant(req);
  const { id } = req.params;
  const [row] = await db
    .select()
    .from(optimizationReportsTable)
    .where(
      and(
        eq(optimizationReportsTable.id, id),
        eq(optimizationReportsTable.tenantId, tenantId),
      ),
    );
  if (!row) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const payload = row.payload as ComputedReport;
  res.json({ ...summary(row), sections: payload.sections });
});

router.delete("/optimization-reports/:id", async (req, res) => {
  const { tenantId } = getTenant(req);
  const { id } = req.params;
  await db
    .delete(optimizationReportsTable)
    .where(
      and(
        eq(optimizationReportsTable.id, id),
        eq(optimizationReportsTable.tenantId, tenantId),
      ),
    );
  res.status(204).end();
});

router.get("/optimization-reports/:id/pdf", async (req, res) => {
  const { tenantId } = getTenant(req);
  const { id } = req.params;
  const [row] = await db
    .select()
    .from(optimizationReportsTable)
    .where(
      and(
        eq(optimizationReportsTable.id, id),
        eq(optimizationReportsTable.tenantId, tenantId),
      ),
    );
  if (!row) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const safeName =
    row.title.replace(/[^a-z0-9-]+/gi, "-").toLowerCase().slice(0, 60) || "report";
  const filename = `samax-${safeName}-${row.id.slice(0, 8)}.pdf`;

  // Prefer the persisted binary so re-downloads are byte-identical to what was
  // produced at report-generation time.
  if (row.pdfBytes && row.pdfBytes.length > 0) {
    const buf = Buffer.isBuffer(row.pdfBytes) ? row.pdfBytes : Buffer.from(row.pdfBytes);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buf.length));
    res.send(buf);
    return;
  }

  // Legacy / fallback: render on-demand from the frozen JSON snapshot, then
  // cache the bytes so subsequent downloads are served from storage.
  try {
    const buf = await renderReportPdf({
      title: row.title,
      createdAt: row.createdAt,
      tenantId,
      report: row.payload as ComputedReport,
    });
    db.update(optimizationReportsTable)
      .set({ pdfBytes: buf, pdfBytesSize: buf.length, pdfGeneratedAt: new Date() })
      .where(eq(optimizationReportsTable.id, row.id))
      .catch((err) => req.log.warn({ err }, "Failed to backfill report pdf cache"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) {
    req.log.error({ err }, "Failed to render report PDF");
    res.status(500).json({ error: "pdf_render_failed" });
  }
});

router.get("/tenants/:tenantId/latest-optimization-report", async (req, res) => {
  const { tenantId } = req.params;
  const resolved = getTenant(req);
  if (resolved.tenantId !== tenantId) {
    res.status(403).json({ error: "tenant_mismatch" });
    return;
  }
  const [row] = await db
    .select()
    .from(optimizationReportsTable)
    .where(eq(optimizationReportsTable.tenantId, tenantId))
    .orderBy(desc(optimizationReportsTable.createdAt))
    .limit(1);
  if (!row) {
    res.status(204).end();
    return;
  }
  res.json(summary(row));
});

export default router;
