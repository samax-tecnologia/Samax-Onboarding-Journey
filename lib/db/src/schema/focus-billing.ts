import {
  pgTable,
  text,
  timestamp,
  varchar,
  doublePrecision,
  jsonb,
  uuid,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { providerConnectionsTable } from "./provider-connections";

// Canonical FOCUS row, normalized across AWS/Azure/GCP.
export const focusBillingTable = pgTable(
  "focus_billing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => providerConnectionsTable.id, { onDelete: "cascade" }),
    chargePeriodStart: timestamp("charge_period_start", { withTimezone: true }).notNull(),
    chargePeriodEnd: timestamp("charge_period_end", { withTimezone: true }).notNull(),
    providerName: varchar("provider_name", { length: 16 }).notNull(),
    serviceCategory: varchar("service_category", { length: 64 }).notNull(),
    serviceName: varchar("service_name", { length: 128 }).notNull(),
    chargeCategory: varchar("charge_category", { length: 32 }).notNull(),
    billedCost: doublePrecision("billed_cost").notNull(),
    effectiveCost: doublePrecision("effective_cost").notNull(),
    billingCurrency: varchar("billing_currency", { length: 8 }).notNull(),
    resourceId: text("resource_id"),
    regionName: varchar("region_name", { length: 64 }),
    xTeam: varchar("x_team", { length: 64 }),
    xProduct: varchar("x_product", { length: 64 }),
    tags: jsonb("tags").$type<Record<string, string>>(),
    // Deterministic line-item hash for idempotent upserts.
    lineItemHash: varchar("line_item_hash", { length: 64 }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("focus_billing_tenant_period_idx").on(t.tenantId, t.chargePeriodStart),
    index("focus_billing_tenant_provider_idx").on(t.tenantId, t.providerName),
    index("focus_billing_tenant_team_idx").on(t.tenantId, t.xTeam),
    index("focus_billing_tenant_product_idx").on(t.tenantId, t.xProduct),
    unique("focus_billing_tenant_dedupe_uq").on(t.tenantId, t.chargePeriodStart, t.lineItemHash),
  ],
);

export type FocusBilling = typeof focusBillingTable.$inferSelect;
