import {
  buildDataset,
  buildSavingsOpportunities,
  PROVIDERS,
  type FocusRow,
  type SavingOpportunity,
} from "./focus-mock";
import { db, focusBillingTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

export type DataSource = "mock" | "live";

export type LoadedDataset = {
  monthlyRows: FocusRow[];
  startDate: Date;
  endDate: Date;
  source: DataSource;
};

// Unified loader that picks mock or DB-backed rows based on the tenant's data
// source. Falls back to mock when a live tenant has no ingested rows yet.
export async function loadDataset(
  tenantId: string,
  dataSource: DataSource,
): Promise<LoadedDataset> {
  if (dataSource === "mock") {
    const ds = buildDataset();
    return { monthlyRows: ds.monthlyRows, startDate: ds.startDate, endDate: ds.endDate, source: "mock" };
  }
  const rows = await db
    .select()
    .from(focusBillingTable)
    .where(eq(focusBillingTable.tenantId, tenantId));
  if (rows.length === 0) {
    return { monthlyRows: [], startDate: new Date(), endDate: new Date(), source: "live" };
  }
  let minStart = rows[0]!.chargePeriodStart;
  let maxEnd = rows[0]!.chargePeriodEnd;
  const monthlyRows: FocusRow[] = rows.map((r) => {
    if (r.chargePeriodStart < minStart) minStart = r.chargePeriodStart;
    if (r.chargePeriodEnd > maxEnd) maxEnd = r.chargePeriodEnd;
    return {
      ChargePeriodStart: r.chargePeriodStart,
      ChargePeriodEnd: r.chargePeriodEnd,
      ProviderName: r.providerName as FocusRow["ProviderName"],
      ServiceCategory: r.serviceCategory,
      ServiceName: r.serviceName,
      ChargeCategory: r.chargeCategory as FocusRow["ChargeCategory"],
      BilledCost: r.billedCost,
      EffectiveCost: r.effectiveCost,
      BillingCurrency: "USD",
      x_Team: r.xTeam ?? "unknown",
      x_Product: r.xProduct ?? "unknown",
      x_ResourceId: r.resourceId ?? "",
    };
  });
  return { monthlyRows, startDate: minStart, endDate: maxEnd, source: "live" };
}

export function defaultPeriodForDataset(ds: LoadedDataset): { start: Date; end: Date } {
  const end = ds.endDate;
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return { start, end };
}

// Provisional cutoff: the trailing 3 days are always considered provisional
// because upstream providers restate them as late charges arrive.
export function provisionalUntil(): string {
  const d = new Date(Date.now() - 3 * 24 * 3600_000);
  return d.toISOString().slice(0, 10);
}
