import { pgTable, text, timestamp, varchar, jsonb, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const providerConnectionsTable = pgTable(
  "provider_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 16 }).notNull(), // 'aws' | 'azure' | 'gcp' | 'sample'
    displayName: text("display_name").notNull(),
    // Free-form, non-secret configuration: AWS bucket+roleArn (no secrets), Azure
    // tenant/subscription/storage account, GCP project/dataset, etc.
    config: jsonb("config").notNull().$type<Record<string, unknown>>().default({}),
    // Reference to the Replit Secret holding any sensitive credentials. The
    // secret value itself is never persisted in the DB.
    secretRef: text("secret_ref"),
    status: varchar("status", { length: 16 }).notNull().default("pending"), // 'pending' | 'ok' | 'error' | 'syncing'
    lastError: text("last_error"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    nextSyncAt: timestamp("next_sync_at", { withTimezone: true }),
    refreshIntervalHours: varchar("refresh_interval_hours", { length: 8 }).notNull().default("24"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("provider_connections_tenant_idx").on(t.tenantId)],
);

export const insertProviderConnectionSchema = createInsertSchema(providerConnectionsTable).omit({
  id: true,
  createdAt: true,
  lastSyncedAt: true,
  nextSyncAt: true,
  lastError: true,
  status: true,
});
export type ProviderConnection = typeof providerConnectionsTable.$inferSelect;
export type InsertProviderConnection = z.infer<typeof insertProviderConnectionSchema>;
