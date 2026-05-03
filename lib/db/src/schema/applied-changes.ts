import {
  pgTable,
  text,
  timestamp,
  varchar,
  uuid,
  doublePrecision,
  index,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const appliedChangesTable = pgTable(
  "applied_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    opportunityId: varchar("opportunity_id", { length: 64 }),
    title: text("title").notNull(),
    description: text("description"),
    scopeProvider: varchar("scope_provider", { length: 16 }),
    scopeService: varchar("scope_service", { length: 128 }),
    scopeCategory: varchar("scope_category", { length: 64 }),
    scopeTeam: varchar("scope_team", { length: 64 }),
    scopeProduct: varchar("scope_product", { length: 64 }),
    scopeResourceId: text("scope_resource_id"),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull(),
    author: text("author"),
    estimatedMonthlySavings: doublePrecision("estimated_monthly_savings").notNull().default(0),
    realizedMonthlySavingsOverride: doublePrecision("realized_monthly_savings_override"),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("applied_changes_tenant_idx").on(t.tenantId),
    index("applied_changes_tenant_applied_at_idx").on(t.tenantId, t.appliedAt),
  ],
);

export type AppliedChange = typeof appliedChangesTable.$inferSelect;
