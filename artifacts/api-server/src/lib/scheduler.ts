import { db, providerConnectionsTable } from "@workspace/db";
import { lte, isNotNull, and, ne, eq } from "drizzle-orm";
import { runSync } from "./sync";
import { logger } from "./logger";

let timer: NodeJS.Timeout | null = null;

async function tick(): Promise<void> {
  const now = new Date();
  // First-pass select: connections whose nextSyncAt is in the past and that
  // are not already syncing. We then atomically "claim" each row by flipping
  // status to 'syncing' guarded by `status != 'syncing'` so overlapping ticks
  // (or a manual sync racing with the scheduler) can't double-run a single
  // connection. Only rows that come back from the RETURNING clause win the
  // claim and proceed to runSync.
  const due = await db
    .select()
    .from(providerConnectionsTable)
    .where(
      and(
        isNotNull(providerConnectionsTable.nextSyncAt),
        lte(providerConnectionsTable.nextSyncAt, now),
        ne(providerConnectionsTable.status, "syncing"),
      ),
    );

  for (const c of due) {
    logger.info({ connectionId: c.id, provider: c.provider }, "Running scheduled sync");
    // runSync performs its own atomic claim, so the scheduler doesn't have to;
    // a manual sync racing with this loop will lose the claim cleanly.
    await runSync(c, { trigger: "scheduled" }).catch((err) => {
      logger.error({ err, connectionId: c.id }, "Scheduled sync threw");
    });
  }
}

export function startScheduler(intervalMs = 60_000): void {
  if (timer) return;
  timer = setInterval(() => {
    tick().catch((err) => logger.error({ err }, "Scheduler tick failed"));
  }, intervalMs);
  logger.info({ intervalMs }, "Sync scheduler started");
}
