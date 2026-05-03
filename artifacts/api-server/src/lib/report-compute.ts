import {
  applyFilters,
  costOf,
  getSavings,
  loadDataset,
  sumCost,
  type CostType,
  type LoadedDataset,
} from "./focus-aggregate";
import type { FocusRow } from "./focus-mock";
import type { AppliedChange, Baseline } from "@workspace/db";

const CURRENCY = "USD";

export type ComparisonRow = {
  key: string;
  label: string;
  current: number;
  baseline: number;
  delta: number;
  deltaPct: number;
};

export type TimeSeriesPoint = {
  month: string; // YYYY-MM
  actual: number;
  projectedNoOptimization: number;
};

export type EfficiencyMetric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  baselineValue: number | null;
  delta: number | null;
  hint: string;
};

export type ComputedReport = {
  currency: string;
  periodStart: string;
  periodEnd: string;
  totalCost: number;
  baselineProjectedCost: number;
  realizedSavings: number;
  appliedChangesCount: number;
  monthsCurrent: number;
  sections: {
    executiveSummary: {
      periodLabel: string;
      baselineLabel: string;
      totalCost: number;
      baselineProjectedCost: number;
      realizedSavings: number;
      savingsPercent: number;
      appliedChangesCount: number;
      openOpportunitiesCount: number;
      openOpportunitiesMonthlySavings: number;
      topWinsLabel: string | null;
    };
    timeSeries: TimeSeriesPoint[];
    efficiency: EfficiencyMetric[];
    byCategory: ComparisonRow[];
    byProvider: ComparisonRow[];
    byService: ComparisonRow[];
    byTeam: ComparisonRow[];
    byProduct: ComparisonRow[];
    appliedChanges: Array<{
      id: string;
      title: string;
      status: string;
      opportunityId: string | null;
      appliedAt: string;
      author: string | null;
      estimatedMonthlySavings: number;
      realizedMonthlySavings: number;
      realizedPeriodSavings: number;
      activeMonths: number;
      scopeProvider: string | null;
      scopeService: string | null;
      scopeCategory: string | null;
    }>;
    topWins: Array<{
      id: string;
      title: string;
      realizedMonthlySavings: number;
      realizedPeriodSavings: number;
      scope: string | null;
    }>;
    openOpportunities: Array<{
      id: string;
      title: string;
      category: string;
      provider: string;
      service: string;
      monthlySavings: number;
      effort: string;
      team: string;
      product: string;
    }>;
    baselineSnapshot: {
      periodStart: string;
      periodEnd: string;
      totalCost: number;
      monthlyAvg: number;
      months: number;
    };
  };
};

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function monthsBetween(start: Date, end: Date): number {
  const s = (start.getUTCFullYear() * 12) + start.getUTCMonth();
  const e = (end.getUTCFullYear() * 12) + end.getUTCMonth();
  return Math.max(1, e - s);
}

function periodLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", {
      timeZone: "UTC",
      month: "short",
      year: "numeric",
    });
  // end is exclusive; show last included month
  const lastIncluded = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return `${fmt(start)} – ${fmt(lastIncluded)}`;
}

function ymKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bucketBy(
  rows: FocusRow[],
  costType: CostType,
  keyFn: (r: FocusRow) => string,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    const k = keyFn(r);
    out.set(k, (out.get(k) ?? 0) + costOf(r, costType));
  }
  return out;
}

function compareBuckets(
  current: Map<string, number>,
  baseline: Record<string, number>,
  baselineMonths: number,
  currentMonths: number,
  humanize: (k: string) => string,
  topN = 12,
): ComparisonRow[] {
  const projected = (v: number) => (v / baselineMonths) * currentMonths;
  const allKeys = new Set<string>([...current.keys(), ...Object.keys(baseline)]);
  const rows: ComparisonRow[] = [];
  for (const key of allKeys) {
    const cur = current.get(key) ?? 0;
    const base = projected(baseline[key] ?? 0);
    const delta = cur - base;
    const deltaPct = base !== 0 ? delta / base : 0;
    rows.push({
      key,
      label: humanize(key),
      current: r2(cur),
      baseline: r2(base),
      delta: r2(delta),
      deltaPct: r4(deltaPct),
    });
  }
  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return rows.slice(0, topN);
}

function humanizeKey(k: string): string {
  return k
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function buildBaselineMetrics(
  ds: LoadedDataset,
  start: Date,
  end: Date,
  costType: CostType,
) {
  const rows = applyFilters(ds.monthlyRows, {
    startDate: start,
    endDate: end,
    costType,
  });
  const totalCost = sumCost(rows, costType);
  const months = monthsBetween(start, end);
  const monthlyAvg = totalCost / months;
  const byService = Object.fromEntries(bucketBy(rows, costType, (r) => r.ServiceName));
  const byCategory = Object.fromEntries(bucketBy(rows, costType, (r) => r.ServiceCategory));
  const byProvider = Object.fromEntries(bucketBy(rows, costType, (r) => r.ProviderName));
  const byTeam = Object.fromEntries(bucketBy(rows, costType, (r) => r.x_Team));
  const byProduct = Object.fromEntries(bucketBy(rows, costType, (r) => r.x_Product));
  return {
    totalCost: r2(totalCost),
    monthlyAvg: r2(monthlyAvg),
    months,
    byService,
    byCategory,
    byProvider,
    byTeam,
    byProduct,
  };
}

// Compute scope-level realized savings. For each applied change with a scope
// (provider/service/category), compare the actual cost in the period for that
// scope against the projected baseline cost for the same scope. The positive
// difference is the realized saving for the scope, attributed across the
// change(s) covering it proportionally to their estimated monthly savings.
// Changes with `realizedMonthlySavingsOverride` bypass the diff and use the
// override directly.
//
// Returns, per change id, both:
//   - `monthly`: realized USD per active month (what we display as "/ mês")
//   - `activeMonths`: how many months of the period the change was active for
// The period total is `monthly * activeMonths`.
type RealizedAttribution = { monthly: number; activeMonths: number };

function attributeRealizedSavings(args: {
  rows: FocusRow[];
  costType: CostType;
  baseline: Baseline;
  monthsCurrent: number;
  periodStart: Date;
  periodEnd: Date;
  changes: AppliedChange[];
}): Map<string, RealizedAttribution> {
  const { rows, costType, baseline, monthsCurrent, periodStart, periodEnd, changes } = args;
  const monthsBaseline = baseline.metrics.months;
  const projected = (v: number) => (v / monthsBaseline) * monthsCurrent;

  // Pre-aggregate current period by service/provider/category for quick lookup.
  const currentByService = bucketBy(rows, costType, (r) => r.ServiceName);
  const currentByProvider = bucketBy(rows, costType, (r) => r.ProviderName);
  const currentByCategory = bucketBy(rows, costType, (r) => r.ServiceCategory);

  function activeMonthsFor(c: AppliedChange): number {
    if (c.appliedAt >= periodEnd) return 0;
    const effectiveStart = c.appliedAt > periodStart ? c.appliedAt : periodStart;
    return Math.max(0, Math.min(monthsCurrent, monthsBetween(effectiveStart, periodEnd)));
  }

  // Group by deepest scope key so multiple changes on same scope share the diff.
  type ScopeKind = "service" | "provider" | "category" | "global";
  function scopeOf(c: AppliedChange): { kind: ScopeKind; key: string } {
    if (c.scopeService) return { kind: "service", key: c.scopeService };
    if (c.scopeProvider) return { kind: "provider", key: c.scopeProvider };
    if (c.scopeCategory) return { kind: "category", key: c.scopeCategory };
    return { kind: "global", key: "__all__" };
  }

  function scopeDiff(kind: ScopeKind, key: string): number {
    if (kind === "service") {
      const cur = currentByService.get(key) ?? 0;
      const base = projected(baseline.metrics.byService[key] ?? 0);
      return base - cur;
    }
    if (kind === "provider") {
      const cur = currentByProvider.get(key) ?? 0;
      const base = projected(baseline.metrics.byProvider[key] ?? 0);
      return base - cur;
    }
    if (kind === "category") {
      const cur = currentByCategory.get(key) ?? 0;
      const base = projected(baseline.metrics.byCategory[key] ?? 0);
      return base - cur;
    }
    const curAll = sumCost(rows, costType);
    const baseAll = projected(baseline.totalCost);
    return baseAll - curAll;
  }

  const realizedByChange = new Map<string, RealizedAttribution>();
  // Changes with override: assign directly (monthly value).
  const groups = new Map<string, AppliedChange[]>();
  for (const c of changes) {
    const m = activeMonthsFor(c);
    if (m === 0) {
      realizedByChange.set(c.id, { monthly: 0, activeMonths: 0 });
      continue;
    }
    if (c.realizedMonthlySavingsOverride != null) {
      realizedByChange.set(c.id, {
        monthly: c.realizedMonthlySavingsOverride,
        activeMonths: m,
      });
      continue;
    }
    const s = scopeOf(c);
    const k = `${s.kind}::${s.key}`;
    const arr = groups.get(k) ?? [];
    arr.push(c);
    groups.set(k, arr);
  }

  for (const [k, group] of groups) {
    const [kind, key] = k.split("::") as [ScopeKind, string];
    const fullDiff = scopeDiff(kind, key); // period-total USD diff for the scope
    // Cap realized credit at total estimated period savings for the group.
    const totalEstPeriod = group.reduce(
      (a, c) => a + c.estimatedMonthlySavings * activeMonthsFor(c),
      0,
    );
    const creditedPeriod = Math.max(0, Math.min(fullDiff, totalEstPeriod));
    if (totalEstPeriod <= 0) {
      for (const c of group) {
        realizedByChange.set(c.id, { monthly: 0, activeMonths: activeMonthsFor(c) });
      }
      continue;
    }
    for (const c of group) {
      const m = activeMonthsFor(c);
      const sharePeriod =
        (creditedPeriod * (c.estimatedMonthlySavings * m)) / totalEstPeriod;
      realizedByChange.set(c.id, {
        monthly: m > 0 ? sharePeriod / m : 0,
        activeMonths: m,
      });
    }
  }
  return realizedByChange;
}

function buildTimeSeries(
  rows: FocusRow[],
  costType: CostType,
  start: Date,
  end: Date,
  baseline: Baseline,
): TimeSeriesPoint[] {
  // monthly buckets between start (inclusive) and end (exclusive)
  const months: TimeSeriesPoint[] = [];
  const monthlyBase = baseline.metrics.monthlyAvg;
  for (
    let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    d < end;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  ) {
    months.push({
      month: ymKey(d),
      actual: 0,
      projectedNoOptimization: r2(monthlyBase),
    });
  }
  const idx = new Map<string, TimeSeriesPoint>();
  for (const m of months) idx.set(m.month, m);
  for (const row of rows) {
    const k = ymKey(row.ChargePeriodStart);
    const p = idx.get(k);
    if (p) p.actual = r2(p.actual + costOf(row, costType));
  }
  return months;
}

function buildEfficiencyMetrics(args: {
  currentRows: FocusRow[];
  baselineRows: FocusRow[];
  costType: CostType;
  monthsCurrent: number;
  monthsBaseline: number;
}): EfficiencyMetric[] {
  const { currentRows, baselineRows, costType, monthsCurrent, monthsBaseline } = args;

  const totalCur = sumCost(currentRows, costType);
  const totalBase = sumCost(baselineRows, costType);

  // Monthly cost per active resource.
  const resCur = new Set(currentRows.map((r) => r.x_ResourceId).filter(Boolean));
  const resBase = new Set(baselineRows.map((r) => r.x_ResourceId).filter(Boolean));
  const cprCur = resCur.size > 0 ? totalCur / monthsCurrent / resCur.size : 0;
  const cprBase = resBase.size > 0 ? totalBase / monthsBaseline / resBase.size : 0;

  // Commitment coverage: share of cost classified as Purchase (commitments).
  const purchaseCur = currentRows
    .filter((r) => r.ChargeCategory === "Purchase")
    .reduce((a, r) => a + costOf(r, costType), 0);
  const purchaseBase = baselineRows
    .filter((r) => r.ChargeCategory === "Purchase")
    .reduce((a, r) => a + costOf(r, costType), 0);
  const covCur = totalCur > 0 ? purchaseCur / totalCur : 0;
  const covBase = totalBase > 0 ? purchaseBase / totalBase : 0;

  // Untagged share: cost without a known team.
  const untaggedCur = currentRows
    .filter((r) => !r.x_Team || r.x_Team === "unknown")
    .reduce((a, r) => a + costOf(r, costType), 0);
  const untaggedBase = baselineRows
    .filter((r) => !r.x_Team || r.x_Team === "unknown")
    .reduce((a, r) => a + costOf(r, costType), 0);
  const untagCur = totalCur > 0 ? untaggedCur / totalCur : 0;
  const untagBase = totalBase > 0 ? untaggedBase / totalBase : 0;

  // Avg monthly cost (run-rate).
  const runCur = monthsCurrent > 0 ? totalCur / monthsCurrent : 0;
  const runBase = monthsBaseline > 0 ? totalBase / monthsBaseline : 0;

  return [
    {
      key: "monthly_run_rate",
      label: "Run-rate mensal",
      value: r2(runCur),
      unit: "USD",
      baselineValue: r2(runBase),
      delta: r2(runCur - runBase),
      hint: "Custo médio por mês no período vs no baseline.",
    },
    {
      key: "cost_per_resource",
      label: "Custo / recurso ativo / mês",
      value: r2(cprCur),
      unit: "USD",
      baselineValue: r2(cprBase),
      delta: r2(cprCur - cprBase),
      hint: "Custo mensal médio dividido pelo número de recursos únicos com cobrança.",
    },
    {
      key: "commitment_coverage",
      label: "Cobertura de commitments",
      value: r4(covCur),
      unit: "ratio",
      baselineValue: r4(covBase),
      delta: r4(covCur - covBase),
      hint: "Parcela do custo classificada como Purchase (RIs/SPs/CUDs).",
    },
    {
      key: "untagged_share",
      label: "Custo sem time atribuído",
      value: r4(untagCur),
      unit: "ratio",
      baselineValue: r4(untagBase),
      delta: r4(untagCur - untagBase),
      hint: "Parcela do custo sem rótulo de time — alvo de governança.",
    },
  ];
}

export async function computeReport(args: {
  tenantId: string;
  tenantDataSource: "mock" | "live";
  periodStart: Date;
  periodEnd: Date;
  costType: CostType;
  baseline: Baseline;
  appliedChanges: AppliedChange[];
}): Promise<ComputedReport> {
  const { tenantId, tenantDataSource, periodStart, periodEnd, costType, baseline, appliedChanges } = args;
  const ds = await loadDataset(tenantId, tenantDataSource);
  const rows = applyFilters(ds.monthlyRows, {
    startDate: periodStart,
    endDate: periodEnd,
    costType,
  });
  const baselineRows = applyFilters(ds.monthlyRows, {
    startDate: baseline.periodStart,
    endDate: baseline.periodEnd,
    costType,
  });
  const totalCost = sumCost(rows, costType);
  const monthsCurrent = monthsBetween(periodStart, periodEnd);
  const monthsBaseline = baseline.metrics.months;
  const baselineProjectedCost = (baseline.totalCost / monthsBaseline) * monthsCurrent;

  // "Mudanças aplicadas no período" — strictly those whose appliedAt falls
  // inside [periodStart, periodEnd). This drives the report listing, the
  // appliedChangesCount and the top-wins ranking.
  const appliedInPeriod = appliedChanges.filter(
    (c) => c.appliedAt >= periodStart && c.appliedAt < periodEnd,
  );
  // Realized savings attribution still uses every active change ongoing during
  // the period (including those applied before periodStart) — activeMonthsFor
  // already clips to the period window so historical changes only contribute
  // their in-period months.
  const activeChanges = appliedChanges.filter(
    (c) => c.status === "active" && c.appliedAt < periodEnd,
  );
  const activeInPeriodIds = new Set(
    appliedInPeriod.filter((c) => c.status === "active").map((c) => c.id),
  );
  const realizedByChange = attributeRealizedSavings({
    rows,
    costType,
    baseline,
    monthsCurrent,
    periodStart,
    periodEnd,
    changes: activeChanges,
  });
  const realizedSavings = Array.from(realizedByChange.values()).reduce(
    (a, v) => a + v.monthly * v.activeMonths,
    0,
  );

  // Open opportunities exclude any opportunity already covered by an applied
  // change (by opportunityId) — regardless of status, since reverted changes
  // shouldn't reappear automatically without explicit re-flagging.
  const appliedOppIds = new Set(
    appliedChanges
      .map((c) => c.opportunityId)
      .filter((x): x is string => typeof x === "string" && x.length > 0),
  );
  const opps = getSavings({}).filter((o) => !appliedOppIds.has(o.id));
  const openOppsTotal = opps.reduce((a, o) => a + o.monthlySavings, 0);

  // Top wins: 3 changes APPLIED IN THIS PERIOD with biggest realized savings.
  const topWins = activeChanges
    .filter((c) => activeInPeriodIds.has(c.id))
    .map((c) => {
      const v = realizedByChange.get(c.id);
      const monthly = v?.monthly ?? 0;
      const periodTotal = monthly * (v?.activeMonths ?? 0);
      const scope = [c.scopeProvider, c.scopeService, c.scopeCategory]
        .filter(Boolean)
        .join(" · ");
      return {
        id: c.id,
        title: c.title,
        realizedMonthlySavings: r2(monthly),
        realizedPeriodSavings: r2(periodTotal),
        scope: scope || null,
      };
    })
    .filter((w) => w.realizedPeriodSavings > 0)
    .sort((a, b) => b.realizedPeriodSavings - a.realizedPeriodSavings)
    .slice(0, 3);
  const topWinsLabel = topWins.length > 0
    ? topWins
        .map((w, i) => `${i + 1}. ${w.title} (${r2(w.realizedPeriodSavings)})`)
        .join(" · ")
    : null;

  const byCategory = compareBuckets(
    bucketBy(rows, costType, (r) => r.ServiceCategory),
    baseline.metrics.byCategory,
    monthsBaseline,
    monthsCurrent,
    (k) => k,
  );
  const byProvider = compareBuckets(
    bucketBy(rows, costType, (r) => r.ProviderName),
    baseline.metrics.byProvider,
    monthsBaseline,
    monthsCurrent,
    (k) => k,
  );
  const byService = compareBuckets(
    bucketBy(rows, costType, (r) => r.ServiceName),
    baseline.metrics.byService,
    monthsBaseline,
    monthsCurrent,
    (k) => k,
  );
  const byTeam = compareBuckets(
    bucketBy(rows, costType, (r) => r.x_Team),
    baseline.metrics.byTeam,
    monthsBaseline,
    monthsCurrent,
    humanizeKey,
  );
  const byProduct = compareBuckets(
    bucketBy(rows, costType, (r) => r.x_Product),
    baseline.metrics.byProduct,
    monthsBaseline,
    monthsCurrent,
    humanizeKey,
  );

  const periodLbl = periodLabel(periodStart, periodEnd);
  const timeSeries = buildTimeSeries(rows, costType, periodStart, periodEnd, baseline);
  const efficiency = buildEfficiencyMetrics({
    currentRows: rows,
    baselineRows,
    costType,
    monthsCurrent,
    monthsBaseline,
  });

  return {
    currency: CURRENCY,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    totalCost: r2(totalCost),
    baselineProjectedCost: r2(baselineProjectedCost),
    realizedSavings: r2(realizedSavings),
    appliedChangesCount: appliedInPeriod.length,
    monthsCurrent,
    sections: {
      executiveSummary: {
        periodLabel: periodLbl,
        baselineLabel: baseline.label,
        totalCost: r2(totalCost),
        baselineProjectedCost: r2(baselineProjectedCost),
        realizedSavings: r2(realizedSavings),
        savingsPercent: baselineProjectedCost > 0
          ? r4((baselineProjectedCost - totalCost) / baselineProjectedCost)
          : 0,
        appliedChangesCount: appliedInPeriod.length,
        openOpportunitiesCount: opps.length,
        openOpportunitiesMonthlySavings: r2(openOppsTotal),
        topWinsLabel,
      },
      topWins,
      timeSeries,
      efficiency,
      byCategory,
      byProvider,
      byService,
      byTeam,
      byProduct,
      appliedChanges: appliedInPeriod.map((c) => {
        const v = realizedByChange.get(c.id);
        const monthly = v?.monthly ?? 0;
        const months = v?.activeMonths ?? 0;
        return {
          id: c.id,
          title: c.title,
          status: c.status,
          opportunityId: c.opportunityId ?? null,
          appliedAt: c.appliedAt.toISOString(),
          author: c.author ?? null,
          estimatedMonthlySavings: r2(c.estimatedMonthlySavings),
          realizedMonthlySavings: r2(monthly),
          realizedPeriodSavings: r2(monthly * months),
          activeMonths: months,
          scopeProvider: c.scopeProvider ?? null,
          scopeService: c.scopeService ?? null,
          scopeCategory: c.scopeCategory ?? null,
        };
      }),
      openOpportunities: opps
        .sort((a, b) => b.monthlySavings - a.monthlySavings)
        .slice(0, 20)
        .map((o) => ({
          id: o.id,
          title: o.title,
          category: o.category,
          provider: o.provider,
          service: o.service,
          monthlySavings: r2(o.monthlySavings),
          effort: o.effort,
          team: o.team,
          product: o.product,
        })),
      baselineSnapshot: {
        periodStart: baseline.periodStart.toISOString().slice(0, 10),
        periodEnd: baseline.periodEnd.toISOString().slice(0, 10),
        totalCost: r2(baseline.totalCost),
        monthlyAvg: r2(baseline.metrics.monthlyAvg),
        months: baseline.metrics.months,
      },
    },
  };
}
