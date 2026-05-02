import {
  buildDataset,
  buildSavingsOpportunities,
  PROVIDERS,
  type FocusRow,
  type SavingOpportunity,
} from "./focus-mock";

export type CostType = "BilledCost" | "EffectiveCost";

export type Filters = {
  startDate?: Date;
  endDate?: Date;
  providers?: string[];
  teams?: string[];
  products?: string[];
  costType: CostType;
};

export function parseListParam(raw?: string): string[] | undefined {
  if (!raw) return undefined;
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export function parseDate(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export function applyFilters(rows: FocusRow[], filters: Filters): FocusRow[] {
  return rows.filter((r) => {
    if (filters.startDate && r.ChargePeriodStart < filters.startDate) return false;
    if (filters.endDate && r.ChargePeriodStart >= filters.endDate) return false;
    if (filters.providers && !filters.providers.includes(r.ProviderName)) return false;
    if (filters.teams && !filters.teams.includes(r.x_Team)) return false;
    if (filters.products && !filters.products.includes(r.x_Product)) return false;
    return true;
  });
}

export function costOf(row: FocusRow, costType: CostType): number {
  return costType === "BilledCost" ? row.BilledCost : row.EffectiveCost;
}

export function sumCost(rows: FocusRow[], costType: CostType): number {
  let total = 0;
  for (const r of rows) total += costOf(r, costType);
  return total;
}

export function ymKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getDataset() {
  return buildDataset();
}

export function getSavings(filters: {
  providers?: string[];
  teams?: string[];
  products?: string[];
}): SavingOpportunity[] {
  const all = buildSavingsOpportunities();
  return all.filter((o) => {
    if (filters.providers && !filters.providers.includes(o.provider)) return false;
    if (filters.teams && !filters.teams.includes(o.team)) return false;
    if (filters.products && !filters.products.includes(o.product)) return false;
    return true;
  });
}

export function defaultPeriod(): { start: Date; end: Date } {
  const ds = getDataset();
  // The "current period" is the most recent month in the dataset.
  const end = ds.endDate;
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return { start, end };
}

export const ALL_PROVIDERS: readonly string[] = PROVIDERS;
