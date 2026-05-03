import { pgTable, text, timestamp, varchar, integer, uuid, index } from "drizzle-orm/pg-core";
import { providerConnectionsTable } from "./provider-connections";

export const syncRunsTable = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => providerConnectionsTable.id, { onDelete: "cascade" }),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: varchar("status", { length: 16 }).notNull(), // 'running' | 'ok' | 'error'
    rowsUpserted: integer("rows_upserted").notNull().default(0),
    partitionsRead: integer("partitions_read").notNull().default(0),
    error: text("error"),
    trigger: varchar("trigger", { length: 16 }).notNull().default("manual"), // 'manual' | 'scheduled' | 'backfill'
  },
  (t) => [index("sync_runs_connection_idx").on(t.connectionId)],
);

export type SyncRun = typeof syncRunsTable.$inferSelect;
