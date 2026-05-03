import { db, focusBillingTable } from "@workspace/db";
import { and, eq, gte, lt, inArray, sql, type SQL } from "drizzle-orm";
import type { Filters } from "./focus-aggregate";

// Live-data aggregations against `focus_billing`. All queries MUST include a
// tenant scope — we throw if it's missing so a bug can't accidentally cross
// tenants.
function requireTenant(tenantId: string | undefined): string {
  if (!tenantId) throw new Error("tenantId is required for focus aggregations");
  return tenantId;
}

function whereClauses(tenantId: string, f: Filters): SQL<unknown> {
  const parts: SQL<unknown>[] = [eq(focusBillingTable.tenantId, tenantId)];
  if (f.startDate) parts.push(gte(focusBillingTable.chargePeriodStart, f.startDate));
  if (f.endDate) parts.push(lt(focusBillingTable.chargePeriodStart, f.endDate));
  if (f.providers && f.providers.length > 0) parts.push(inArray(focusBillingTable.providerName, f.providers));
  if (f.teams && f.teams.length > 0) parts.push(inArray(focusBillingTable.xTeam, f.teams));
  if (f.products && f.products.length > 0) parts.push(inArray(focusBillingTable.xProduct, f.products));
  return and(...parts) as SQL<unknown>;
}

function costColumn(costType: Filters["costType"]) {
  return costType === "BilledCost" ? focusBillingTable.billedCost : focusBillingTable.effectiveCost;
}

export async function liveSumCost(tenantId: string, f: Filters): Promise<number> {
  const tid = requireTenant(tenantId);
  const cost = costColumn(f.costType);
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${cost}), 0)` })
    .from(focusBillingTable)
    .where(whereClauses(tid, f));
  return Number(row?.total ?? 0);
}

export async function liveTimeseries(
  tenantId: string,
  f: Filters,
): Promise<{ period: string; total: number; byProvider: Record<string, number> }[]> {
  const tid = requireTenant(tenantId);
  const cost = costColumn(f.costType);
  const rows = await db
    .select({
      period: sql<string>`to_char(${focusBillingTable.chargePeriodStart}, 'YYYY-MM')`,
      provider: focusBillingTable.providerName,
      total: sql<number>`coalesce(sum(${cost}), 0)`,
    })
    .from(focusBillingTable)
    .where(whereClauses(tid, f))
    .groupBy(sql`to_char(${focusBillingTable.chargePeriodStart}, 'YYYY-MM')`, focusBillingTable.providerName)
    .orderBy(sql`to_char(${focusBillingTable.chargePeriodStart}, 'YYYY-MM')`);

  const byPeriod = new Map<string, { period: string; total: number; byProvider: Record<string, number> }>();
  for (const r of rows) {
    const num = Number(r.total ?? 0);
    let entry = byPeriod.get(r.period);
    if (!entry) {
      entry = { period: r.period, total: 0, byProvider: {} };
      byPeriod.set(r.period, entry);
    }
    entry.total += num;
    entry.byProvider[r.provider] = (entry.byProvider[r.provider] ?? 0) + num;
  }
  return [...byPeriod.values()];
}

export type LiveBreakdownDimension = "ProviderName" | "ServiceCategory" | "ServiceName" | "x_Team" | "x_Product" | "RegionName";

const dimColumn = {
  ProviderName: focusBillingTable.providerName,
  ServiceCategory: focusBillingTable.serviceCategory,
  ServiceName: focusBillingTable.serviceName,
  x_Team: focusBillingTable.xTeam,
  x_Product: focusBillingTable.xProduct,
  RegionName: focusBillingTable.regionName,
} as const;

export async function liveBreakdown(
  tenantId: string,
  f: Filters,
  dimension: LiveBreakdownDimension,
  parentDimension?: { dimension: LiveBreakdownDimension; value: string },
): Promise<{ key: string; total: number }[]> {
  const tid = requireTenant(tenantId);
  const cost = costColumn(f.costType);
  const col = dimColumn[dimension];
  const where: SQL<unknown>[] = [whereClauses(tid, f)];
  if (parentDimension) where.push(eq(dimColumn[parentDimension.dimension], parentDimension.value));
  const rows = await db
    .select({ key: sql<string>`coalesce(${col}, 'unknown')`, total: sql<number>`coalesce(sum(${cost}), 0)` })
    .from(focusBillingTable)
    .where(and(...where) as SQL<unknown>)
    .groupBy(col)
    .orderBy(sql`sum(${cost}) desc`);
  return rows.map((r) => ({ key: r.key, total: Number(r.total ?? 0) }));
}

export async function liveHasData(tenantId: string): Promise<boolean> {
  const tid = requireTenant(tenantId);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(focusBillingTable)
    .where(eq(focusBillingTable.tenantId, tid))
    .limit(1);
  return Number(row?.n ?? 0) > 0;
}

export async function liveDistinct(
  tenantId: string,
  dimension: LiveBreakdownDimension,
): Promise<string[]> {
  const tid = requireTenant(tenantId);
  const col = dimColumn[dimension];
  const rows = await db
    .selectDistinct({ value: col })
    .from(focusBillingTable)
    .where(eq(focusBillingTable.tenantId, tid));
  return rows.map((r) => (r.value ?? "")).filter(Boolean) as string[];
}
