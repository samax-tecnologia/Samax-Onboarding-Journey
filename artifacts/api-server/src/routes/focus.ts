import { Router, type IRouter } from "express";
import {
  GetFocusFiltersResponse,
  GetFocusSummaryQueryParams,
  GetFocusSummaryResponse,
  GetFocusTimeSeriesQueryParams,
  GetFocusTimeSeriesResponse,
  GetFocusBreakdownQueryParams,
  GetFocusBreakdownResponse,
  GetFocusSavingsQueryParams,
  GetFocusSavingsResponse,
} from "@workspace/api-zod";
import {
  ALL_PROVIDERS,
  applyFilters,
  costOf,
  defaultPeriod,
  getDataset,
  getSavings,
  parseDate,
  parseListParam,
  sumCost,
  ymKey,
  type CostType,
  type Filters,
} from "../lib/focus-aggregate";
import { PRODUCTS, TEAMS, type FocusRow } from "../lib/focus-mock";

const router: IRouter = Router();

const CURRENCY = "USD";

function buildFiltersFromQuery(
  q: {
    startDate?: string;
    endDate?: string;
    providers?: string;
    teams?: string;
    products?: string;
    costType?: string;
  },
  fallback?: { start?: Date; end?: Date },
): Filters {
  const costType: CostType =
    q.costType === "BilledCost" ? "BilledCost" : "EffectiveCost";
  return {
    startDate: parseDate(q.startDate) ?? fallback?.start,
    endDate: parseDate(q.endDate) ?? fallback?.end,
    providers: parseListParam(q.providers),
    teams: parseListParam(q.teams),
    products: parseListParam(q.products),
    costType,
  };
}

router.get("/focus/filters", (_req, res) => {
  const ds = getDataset();
  const period = defaultPeriod();
  const categoriesSet = new Set<string>();
  for (const r of ds.monthlyRows) categoriesSet.add(r.ServiceCategory);
  const data = GetFocusFiltersResponse.parse({
    providers: [...ALL_PROVIDERS],
    teams: [...TEAMS],
    products: [...PRODUCTS],
    categories: [...categoriesSet].sort(),
    currency: CURRENCY,
    periodStart: period.start.toISOString().slice(0, 10),
    periodEnd: period.end.toISOString().slice(0, 10),
  });
  res.json(data);
});

router.get("/focus/summary", (req, res) => {
  const parsed = GetFocusSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    req.log.warn({ issues: parsed.error.issues }, "Invalid focus/summary query");
    res.status(400).json({ error: "invalid_query" });
    return;
  }

  const period = defaultPeriod();
  const filters = buildFiltersFromQuery(parsed.data, {
    start: period.start,
    end: period.end,
  });

  const ds = getDataset();
  const windowStart = filters.startDate ?? period.start;
  const windowEnd = filters.endDate ?? period.end;
  const inRange = applyFilters(ds.monthlyRows, filters);
  const actualSpend = sumCost(inRange, filters.costType);

  // Identify the last month in the window. If it's the dataset's "current"
  // open month, treat it as 70% elapsed for forecasting; otherwise the
  // window is fully realized and forecast equals actual.
  const lastMonthStart = new Date(
    Date.UTC(windowEnd.getUTCFullYear(), windowEnd.getUTCMonth() - 1, 1),
  );
  const lastMonthRows = applyFilters(ds.monthlyRows, {
    ...filters,
    startDate: lastMonthStart,
    endDate: windowEnd,
  });
  const lastMonthSpend = sumCost(lastMonthRows, filters.costType);
  const isCurrentOpenWindow = ymKey(lastMonthStart) === ymKey(
    new Date(Date.UTC(ds.endDate.getUTCFullYear(), ds.endDate.getUTCMonth() - 1, 1)),
  );
  const elapsedRatio = isCurrentOpenWindow ? 0.7 : 1;
  const remainder = actualSpend - lastMonthSpend;
  const forecastSpend = remainder + lastMonthSpend / elapsedRatio;

  // Budget = previous window of same length, scaled by 1.05.
  const windowMonths = Math.max(
    1,
    (windowEnd.getUTCFullYear() - windowStart.getUTCFullYear()) * 12 +
      (windowEnd.getUTCMonth() - windowStart.getUTCMonth()),
  );
  const prevStart = new Date(
    Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() - windowMonths, 1),
  );
  const prevRows = applyFilters(ds.monthlyRows, {
    ...filters,
    startDate: prevStart,
    endDate: windowStart,
  });
  const prevSpend = sumCost(prevRows, filters.costType);
  const budget = roundTo(Math.max(forecastSpend, prevSpend) * 1.05, 1000);
  const percentConsumed = budget > 0 ? actualSpend / budget : 0;
  const projectedDelta = forecastSpend - budget;

  // Filter savings opportunities by the same provider/team/product filters
  const savings = getSavings({
    providers: filters.providers,
    teams: filters.teams,
    products: filters.products,
  });
  const savingsTotal = savings.reduce((acc, s) => acc + s.monthlySavings, 0);
  const topSavings = [...savings]
    .sort((a, b) => b.monthlySavings - a.monthlySavings)
    .slice(0, 3);

  const data = GetFocusSummaryResponse.parse({
    currency: CURRENCY,
    periodStart: windowStart.toISOString().slice(0, 10),
    periodEnd: windowEnd.toISOString().slice(0, 10),
    costType: filters.costType,
    actualSpend: round2(actualSpend),
    forecastSpend: round2(forecastSpend),
    budget: round2(budget),
    percentConsumed: round4(percentConsumed),
    projectedDelta: round2(projectedDelta),
    savingsTotal: round2(savingsTotal),
    savingsCount: savings.length,
    topSavings: topSavings.map(serializeSaving),
  });
  res.json(data);
});

router.get("/focus/timeseries", (req, res) => {
  const coercedQuery = { ...req.query, months: Number((req.query as Record<string, unknown>)["months"]) };
  const parsed = GetFocusTimeSeriesQueryParams.safeParse(coercedQuery);
  if (!parsed.success) {
    req.log.warn({ issues: parsed.error.issues }, "Invalid focus/timeseries query");
    res.status(400).json({ error: "invalid_query" });
    return;
  }
  const months = Number(parsed.data.months);
  const ds = getDataset();
  const end = ds.endDate;
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months, 1));
  const filters = buildFiltersFromQuery(parsed.data, { start, end });

  const inRange = applyFilters(ds.monthlyRows, filters);

  // Group by YYYY-MM and provider
  const buckets = new Map<string, { total: number; byProvider: Record<string, number> }>();
  // Initialize empty months so the chart always has a continuous axis
  for (
    let cursor = new Date(start);
    cursor < end;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    const key = ymKey(cursor);
    const byProvider: Record<string, number> = {};
    for (const p of ALL_PROVIDERS) byProvider[p] = 0;
    buckets.set(key, { total: 0, byProvider });
  }

  for (const r of inRange) {
    const key = ymKey(r.ChargePeriodStart);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const c = costOf(r, filters.costType);
    bucket.total += c;
    bucket.byProvider[r.ProviderName] = (bucket.byProvider[r.ProviderName] ?? 0) + c;
  }

  const points = [...buckets.entries()].map(([period, b]) => ({
    period,
    total: round2(b.total),
    byProvider: Object.fromEntries(
      Object.entries(b.byProvider).map(([k, v]) => [k, round2(v)]),
    ),
  }));

  const totalRange = points.reduce((a, p) => a + p.total, 0);

  // Previous range of same length for comparison
  const prevStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - months, 1));
  const prevRows = applyFilters(ds.monthlyRows, {
    ...filters,
    startDate: prevStart,
    endDate: start,
  });
  const previousRangeTotal = sumCost(prevRows, filters.costType);

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const momDelta = last && prev ? last.total - prev.total : 0;
  const momDeltaPercent = last && prev && prev.total > 0 ? momDelta / prev.total : 0;

  const data = GetFocusTimeSeriesResponse.parse({
    currency: CURRENCY,
    costType: filters.costType,
    points,
    momDelta: round2(momDelta),
    momDeltaPercent: round4(momDeltaPercent),
    totalRange: round2(totalRange),
    previousRangeTotal: round2(previousRangeTotal),
  });
  res.json(data);
});

router.get("/focus/breakdown", (req, res) => {
  const parsed = GetFocusBreakdownQueryParams.safeParse(req.query);
  if (!parsed.success) {
    req.log.warn({ issues: parsed.error.issues }, "Invalid focus/breakdown query");
    res.status(400).json({ error: "invalid_query" });
    return;
  }
  const dimension = parsed.data.dimension;
  const parent = parsed.data.parent;
  const limit = parsed.data.limit ?? 12;

  const ds = getDataset();
  const period = defaultPeriod();
  // For breakdowns we default to the trailing 3 months for a stable picture
  const trailingStart = new Date(
    Date.UTC(period.end.getUTCFullYear(), period.end.getUTCMonth() - 3, 1),
  );
  const filters = buildFiltersFromQuery(parsed.data, {
    start: trailingStart,
    end: period.end,
  });

  let rows = applyFilters(ds.monthlyRows, filters);

  // Drill-down: if dimension is serviceName and parent (a ServiceCategory) is provided
  if (dimension === "serviceName" && parent) {
    rows = rows.filter((r) => r.ServiceCategory === parent);
  }

  const keyOf = (r: FocusRow): string => {
    switch (dimension) {
      case "serviceCategory":
        return r.ServiceCategory;
      case "chargeCategory":
        return r.ChargeCategory;
      case "serviceName":
        return r.ServiceName;
      case "team":
        return r.x_Team;
      case "product":
        return r.x_Product;
      case "provider":
        return r.ProviderName;
    }
  };

  const totals = new Map<string, number>();
  // For sparklines, also track per-month totals across the trailing range
  const months: string[] = [];
  for (
    let cursor = new Date(filters.startDate ?? trailingStart);
    cursor < (filters.endDate ?? period.end);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    months.push(ymKey(cursor));
  }
  const perMonth = new Map<string, Map<string, number>>();

  for (const r of rows) {
    const k = keyOf(r);
    const c = costOf(r, filters.costType);
    totals.set(k, (totals.get(k) ?? 0) + c);
    const m = ymKey(r.ChargePeriodStart);
    let mm = perMonth.get(k);
    if (!mm) {
      mm = new Map();
      perMonth.set(k, mm);
    }
    mm.set(m, (mm.get(m) ?? 0) + c);
  }

  const totalAmount = [...totals.values()].reduce((a, b) => a + b, 0);

  const items = [...totals.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, limit)
    .map(([key, amount]) => {
      const sparkline = months.map((m) => round2(perMonth.get(key)?.get(m) ?? 0));
      return {
        key,
        label: humanizeKey(dimension, key),
        amount: round2(amount),
        percent: totalAmount !== 0 ? round4(amount / totalAmount) : 0,
        sparkline,
      };
    });

  const data = GetFocusBreakdownResponse.parse({
    dimension,
    parent,
    currency: CURRENCY,
    costType: filters.costType,
    totalAmount: round2(totalAmount),
    items,
  });
  res.json(data);
});

router.get("/focus/savings", (req, res) => {
  const parsed = GetFocusSavingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    req.log.warn({ issues: parsed.error.issues }, "Invalid focus/savings query");
    res.status(400).json({ error: "invalid_query" });
    return;
  }
  const filters = {
    providers: parseListParam(parsed.data.providers),
    teams: parseListParam(parsed.data.teams),
    products: parseListParam(parsed.data.products),
  };
  const all = getSavings(filters);
  const totalMonthlySavings = all.reduce((a, b) => a + b.monthlySavings, 0);
  const data = GetFocusSavingsResponse.parse({
    currency: CURRENCY,
    totalMonthlySavings: round2(totalMonthlySavings),
    count: all.length,
    opportunities: all
      .sort((a, b) => b.monthlySavings - a.monthlySavings)
      .map(serializeSaving),
  });
  res.json(data);
});

function serializeSaving(s: ReturnType<typeof getSavings>[number]) {
  return {
    id: s.id,
    title: s.title,
    category: s.category,
    provider: s.provider,
    service: s.service,
    resourceId: s.resourceId,
    team: s.team,
    product: s.product,
    monthlySavings: round2(s.monthlySavings),
    currency: s.currency,
    recommendedAction: s.recommendedAction,
    effort: s.effort,
    details: s.details,
  };
}

function humanizeKey(dimension: string, key: string): string {
  if (dimension === "team" || dimension === "product") {
    return key
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return key;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export default router;
