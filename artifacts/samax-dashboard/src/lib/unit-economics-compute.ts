import type { UnitMetric } from "./unit-economics-store";

export type FocusPoint = {
  period: string;
  total: number;
  byProvider: Record<string, number>;
};

export type UnitSeriesRow = {
  period: string;
  cost: number;
  volume: number | null;
  unitCost: number | null;
};

export type UnitKpis = {
  current: UnitSeriesRow | null;
  previous: UnitSeriesRow | null;
  /** Absolute change in unit cost vs previous period (current.unitCost - previous.unitCost). */
  delta: number | null;
  /** Relative change as a ratio (e.g. 0.12 = +12%). null if previous is unavailable or zero. */
  deltaPercent: number | null;
};

/**
 * Build a per-period unit cost series from FOCUS spend points and a metric's denominator data.
 * - The numerator is `point.total` (already filtered server-side by the active dashboard filter
 *   intersected with the metric's optional providers/teams/products scope when those are set).
 * - For "month" granularity (default), volume comes from `denominator[YYYY-MM]`.
 * - For "day" granularity, volume comes from `denominator[YYYY-MM-DD]` and the matching
 *   month's cost is allocated proportionally across the days in that month
 *   (cost_for_day = monthly_cost / daysInMonth).
 */
export function buildUnitSeries(
  points: FocusPoint[],
  denominator: Record<string, number>,
  granularity: "month" | "day" = "month",
): UnitSeriesRow[] {
  if (granularity === "month") {
    return points.map((p) => {
      const volume = denominator[p.period];
      const hasVolume = typeof volume === "number" && volume > 0;
      return {
        period: p.period,
        cost: p.total,
        volume: hasVolume ? volume : null,
        unitCost: hasVolume ? p.total / volume : null,
      };
    });
  }

  // Day granularity: index monthly cost by month, then emit one row per provided day.
  const costByMonth = new Map<string, number>();
  for (const p of points) costByMonth.set(p.period, p.total);

  const dayKeys = Object.keys(denominator).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
  dayKeys.sort();

  return dayKeys.map((day) => {
    const month = day.slice(0, 7);
    const [yStr, mStr] = month.split("-");
    const y = Number(yStr);
    const mo = Number(mStr);
    const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const monthlyCost = costByMonth.get(month) ?? 0;
    const dayCost = daysInMonth > 0 ? monthlyCost / daysInMonth : 0;
    const volume = denominator[day];
    const hasVolume = typeof volume === "number" && volume > 0;
    return {
      period: day,
      cost: dayCost,
      volume: hasVolume ? volume : null,
      unitCost: hasVolume && dayCost > 0 ? dayCost / volume : null,
    };
  });
}

export function computeKpis(rows: UnitSeriesRow[]): UnitKpis {
  if (rows.length === 0) return { current: null, previous: null, delta: null, deltaPercent: null };
  const current = rows[rows.length - 1] ?? null;
  const previous = rows.length >= 2 ? rows[rows.length - 2] : null;
  if (!current || current.unitCost === null) {
    return { current, previous, delta: null, deltaPercent: null };
  }
  if (!previous || previous.unitCost === null || previous.unitCost === 0) {
    return { current, previous, delta: null, deltaPercent: null };
  }
  const delta = current.unitCost - previous.unitCost;
  const deltaPercent = delta / previous.unitCost;
  return { current, previous, delta, deltaPercent };
}

export type ThresholdStatus = "above" | "below" | "ok" | "unknown";

/** Classify a unit-cost value against the metric's optional thresholds.
 *  - "above": exceeded upperBound (worse for cost-style metrics)
 *  - "below": fell below lowerBound
 *  - "ok": value is inside the configured band (or no bounds set but a value exists)
 *  - "unknown": no value to evaluate
 */
export function evaluateThreshold(
  value: number | null | undefined,
  thresholds: UnitMetric["thresholds"],
): ThresholdStatus {
  if (value == null || !Number.isFinite(value)) return "unknown";
  if (!thresholds) return "ok";
  const { upperBound, lowerBound } = thresholds;
  if (typeof upperBound === "number" && value > upperBound) return "above";
  if (typeof lowerBound === "number" && value < lowerBound) return "below";
  return "ok";
}

/** True when the metric has at least one configured bound or target. */
export function hasThresholds(metric: Pick<UnitMetric, "thresholds">): boolean {
  const t = metric.thresholds;
  if (!t) return false;
  return (
    typeof t.target === "number" ||
    typeof t.upperBound === "number" ||
    typeof t.lowerBound === "number"
  );
}

/**
 * Format a unit cost value for display, depending on the metric's display format.
 * - "currency": treats the unit cost as money (e.g. $1234 / customer)
 * - "percent": treats the unit cost as a ratio (e.g. tech spend / revenue)
 */
export function formatUnitCost(
  value: number | null,
  metric: Pick<UnitMetric, "format">,
  currency: string,
  fmtCurrency: (n: number, cur: string) => string,
  fmtPercent: (r: number, digits?: number) => string,
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (metric.format === "percent") return fmtPercent(value, 2);
  return fmtCurrency(value, currency);
}
