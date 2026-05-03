import {
  applyFilters,
  costOf,
  ymKey,
  type CostType,
  type LoadedDataset,
} from "./focus-aggregate";
import type { FocusRow } from "./focus-mock";

export type UnitEconomicsInput = {
  id: string;
  name: string;
  unitLabel: string;
  format: "currency" | "percent";
  granularity?: "month" | "day";
  numerator?: {
    providers?: string[];
    teams?: string[];
    products?: string[];
  };
  denominator: Record<string, number>;
};

export type UnitEconomicsPoint = {
  period: string;
  cost: number;
  volume: number | null;
  unitCost: number | null;
};

export type UnitEconomicsMetric = {
  id: string;
  name: string;
  unitLabel: string;
  format: "currency" | "percent";
  granularity: "month" | "day";
  currentUnitCost: number | null;
  previousUnitCost: number | null;
  delta: number | null;
  deltaPercent: number | null;
  currentPeriodLabel: string | null;
  previousPeriodLabel: string | null;
  series: UnitEconomicsPoint[];
};

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function previousPeriodKey(period: string, granularity: "month" | "day"): string {
  if (granularity === "month") {
    const [yStr, mStr] = period.split("-");
    const y = Number(yStr);
    const mo = Number(mStr);
    const d = new Date(Date.UTC(y, mo - 2, 1));
    return ymKey(d);
  }
  const [yStr, mStr, dStr] = period.split("-");
  const y = Number(yStr);
  const mo = Number(mStr);
  const dd = Number(dStr);
  const prev = new Date(Date.UTC(y, mo - 1, dd - 1));
  const py = prev.getUTCFullYear();
  const pm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const pd = String(prev.getUTCDate()).padStart(2, "0");
  return `${py}-${pm}-${pd}`;
}

function monthKeysBetween(start: Date, end: Date): string[] {
  const out: string[] = [];
  for (
    let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    d < end;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  ) {
    out.push(ymKey(d));
  }
  return out;
}

function bucketCostByMonth(rows: FocusRow[], costType: CostType): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    const k = ymKey(r.ChargePeriodStart);
    out.set(k, (out.get(k) ?? 0) + costOf(r, costType));
  }
  return out;
}

function buildSeries(
  costByMonth: Map<string, number>,
  monthsInPeriod: string[],
  denominator: Record<string, number>,
  granularity: "month" | "day",
  periodStart: Date,
  periodEnd: Date,
): UnitEconomicsPoint[] {
  if (granularity === "month") {
    return monthsInPeriod.map((period) => {
      const cost = r2(costByMonth.get(period) ?? 0);
      const volume = denominator[period];
      const hasVolume = typeof volume === "number" && volume > 0;
      return {
        period,
        cost,
        volume: hasVolume ? volume : null,
        // When we have a denominator we always emit a unitCost (0 when cost
        // is 0). Only when the denominator is missing/zero do we leave it null.
        unitCost: hasVolume ? r4(cost / volume) : null,
      };
    });
  }

  // Day granularity: pro-rate the month's total cost across the days in the
  // month and only emit days that have a denominator value AND fall strictly
  // inside the report's [periodStart, periodEnd) window — important for
  // partial-month custom periods.
  const startMs = periodStart.getTime();
  const endMs = periodEnd.getTime();
  const dayKeys = Object.keys(denominator)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .filter((k) => {
      const [yy, mm, dd] = k.split("-").map(Number);
      const t = Date.UTC(yy, mm - 1, dd);
      return t >= startMs && t < endMs;
    })
    .sort();

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
      cost: r2(dayCost),
      volume: hasVolume ? volume : null,
      // Same convention as month granularity: emit 0 when denominator exists
      // but the (pro-rated) cost is zero; only leave null when denominator is
      // missing or zero.
      unitCost: hasVolume ? r4(dayCost / volume) : null,
    };
  });
}

export function buildUnitEconomicsForReport(args: {
  ds: LoadedDataset;
  periodStart: Date;
  periodEnd: Date;
  costType: CostType;
  inputs: UnitEconomicsInput[];
}): UnitEconomicsMetric[] {
  const { ds, periodStart, periodEnd, costType, inputs } = args;
  if (inputs.length === 0) return [];

  const monthsInPeriod = monthKeysBetween(periodStart, periodEnd);

  return inputs.map((m) => {
    const granularity: "month" | "day" = m.granularity ?? "month";
    const rows = applyFilters(ds.monthlyRows, {
      startDate: periodStart,
      endDate: periodEnd,
      costType,
      providers: m.numerator?.providers?.length ? m.numerator.providers : undefined,
      teams: m.numerator?.teams?.length ? m.numerator.teams : undefined,
      products: m.numerator?.products?.length ? m.numerator.products : undefined,
    });
    const costByMonth = bucketCostByMonth(rows, costType);
    const series = buildSeries(
      costByMonth,
      monthsInPeriod,
      m.denominator,
      granularity,
      periodStart,
      periodEnd,
    );

    // KPI: the most recent period in the series with a defined unitCost is the
    // "current" reading. The "previous" reading must be the IMMEDIATELY
    // preceding calendar period (previous month for month granularity,
    // previous day for day granularity). If that adjacent prior period has no
    // unitCost, delta/deltaPercent stay null — we never compare against a
    // non-adjacent period.
    let current: UnitEconomicsPoint | null = null;
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].unitCost !== null) {
        current = series[i];
        break;
      }
    }
    let previous: UnitEconomicsPoint | null = null;
    if (current) {
      const prevPeriod = previousPeriodKey(current.period, granularity);
      const found = series.find((p) => p.period === prevPeriod) ?? null;
      previous = found && found.unitCost !== null ? found : null;
    }
    let delta: number | null = null;
    let deltaPercent: number | null = null;
    if (current && previous && current.unitCost !== null && previous.unitCost !== null) {
      // Absolute delta is always defined when both adjacent points exist;
      // percent change is only meaningful when previous != 0.
      delta = r4(current.unitCost - previous.unitCost);
      deltaPercent =
        previous.unitCost !== 0
          ? r4((current.unitCost - previous.unitCost) / previous.unitCost)
          : null;
    }

    return {
      id: m.id,
      name: m.name,
      unitLabel: m.unitLabel,
      format: m.format,
      granularity,
      currentUnitCost: current?.unitCost ?? null,
      previousUnitCost: previous?.unitCost ?? null,
      delta,
      deltaPercent,
      currentPeriodLabel: current?.period ?? null,
      previousPeriodLabel: previous?.period ?? null,
      series,
    };
  });
}
