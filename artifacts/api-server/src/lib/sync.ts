import { createHash } from "node:crypto";
import { db, focusBillingTable, providerConnectionsTable, syncRunsTable, type ProviderConnection } from "@workspace/db";
import { and, eq, ne, sql } from "drizzle-orm";
import { getAdapter, type CanonicalFocusRow } from "./adapters";
import { logger } from "./logger";

function hashLine(connectionId: string, providerName: string, upstreamLineId: string, periodStart: Date) {
  // connectionId scoping prevents two connections in the same tenant
  // (e.g. multiple AWS accounts) from colliding when their upstream IDs
  // happen to match. The unique target on the table is
  // (tenantId, chargePeriodStart, lineItemHash) — the connectionId-laced
  // hash makes that key unique-per-connection in practice.
  return createHash("sha256")
    .update(`${connectionId}|${providerName}|${upstreamLineId}|${periodStart.toISOString()}`)
    .digest("hex")
    .slice(0, 32);
}

export type RunSyncOptions = {
  trigger: "manual" | "scheduled" | "backfill";
};

export async function runSync(
  connection: ProviderConnection,
  options: RunSyncOptions,
): Promise<{ status: "ok" | "error"; rowsUpserted: number; partitionsRead: number; error?: string }> {
  const adapter = getAdapter(connection.provider);
  if (!adapter) {
    return { status: "error", rowsUpserted: 0, partitionsRead: 0, error: `Unknown provider: ${connection.provider}` };
  }

  // Atomic claim: only one caller can flip status to 'syncing'. If a parallel
  // manual + scheduled run race here, one of them gets 0 rows back and bails.
  const claimed = await db
    .update(providerConnectionsTable)
    .set({ status: "syncing", lastError: null })
    .where(
      and(
        eq(providerConnectionsTable.id, connection.id),
        ne(providerConnectionsTable.status, "syncing"),
      ),
    )
    .returning({ id: providerConnectionsTable.id });
  if (claimed.length === 0) {
    return {
      status: "error",
      rowsUpserted: 0,
      partitionsRead: 0,
      error: "Sync já em execução para esta conexão.",
    };
  }

  const [runRow] = await db
    .insert(syncRunsTable)
    .values({
      connectionId: connection.id,
      tenantId: connection.tenantId,
      status: "running",
      trigger: options.trigger,
    })
    .returning({ id: syncRunsTable.id });

  try {
    const { rows, partitionsRead } = await adapter.fetch(connection);
    const upserted = await upsertRows(connection, rows);

    const intervalH = Number(connection.refreshIntervalHours) || 24;
    const nextSyncAt = new Date(Date.now() + intervalH * 3600_000);

    await db
      .update(providerConnectionsTable)
      .set({
        status: "ok",
        lastError: null,
        lastSyncedAt: new Date(),
        nextSyncAt,
      })
      .where(eq(providerConnectionsTable.id, connection.id));

    if (runRow) {
      await db
        .update(syncRunsTable)
        .set({
          status: "ok",
          finishedAt: new Date(),
          rowsUpserted: upserted,
          partitionsRead,
        })
        .where(eq(syncRunsTable.id, runRow.id));
    }

    logger.info({ connectionId: connection.id, upserted, partitionsRead }, "Sync completed");
    return { status: "ok", rowsUpserted: upserted, partitionsRead };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(providerConnectionsTable)
      .set({ status: "error", lastError: msg })
      .where(eq(providerConnectionsTable.id, connection.id));

    if (runRow) {
      await db
        .update(syncRunsTable)
        .set({ status: "error", finishedAt: new Date(), error: msg })
        .where(eq(syncRunsTable.id, runRow.id));
    }

    logger.error({ err, connectionId: connection.id }, "Sync failed");
    return { status: "error", rowsUpserted: 0, partitionsRead: 0, error: msg };
  }
}

async function upsertRows(connection: ProviderConnection, rows: CanonicalFocusRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const BATCH = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const values = slice.map((r) => ({
      tenantId: connection.tenantId,
      connectionId: connection.id,
      chargePeriodStart: r.chargePeriodStart,
      chargePeriodEnd: r.chargePeriodEnd,
      providerName: r.providerName,
      serviceCategory: r.serviceCategory,
      serviceName: r.serviceName,
      chargeCategory: r.chargeCategory,
      billedCost: r.billedCost,
      effectiveCost: r.effectiveCost,
      billingCurrency: r.billingCurrency,
      resourceId: r.resourceId ?? null,
      regionName: r.regionName ?? null,
      xTeam: r.xTeam ?? null,
      xProduct: r.xProduct ?? null,
      tags: r.tags ?? null,
      lineItemHash: hashLine(connection.id, r.providerName, r.upstreamLineId, r.chargePeriodStart),
    }));
    const inserted = await db
      .insert(focusBillingTable)
      .values(values)
      .onConflictDoUpdate({
        target: [focusBillingTable.tenantId, focusBillingTable.chargePeriodStart, focusBillingTable.lineItemHash],
        set: {
          connectionId: sql`excluded.connection_id`,
          billedCost: sql`excluded.billed_cost`,
          effectiveCost: sql`excluded.effective_cost`,
          serviceCategory: sql`excluded.service_category`,
          serviceName: sql`excluded.service_name`,
          chargeCategory: sql`excluded.charge_category`,
          billingCurrency: sql`excluded.billing_currency`,
          resourceId: sql`excluded.resource_id`,
          regionName: sql`excluded.region_name`,
          xTeam: sql`excluded.x_team`,
          xProduct: sql`excluded.x_product`,
          tags: sql`excluded.tags`,
          ingestedAt: sql`now()`,
        },
      })
      .returning({ id: focusBillingTable.id });
    total += inserted.length;
  }
  return total;
}
