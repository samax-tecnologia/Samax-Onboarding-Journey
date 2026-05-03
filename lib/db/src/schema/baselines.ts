import {
  pgTable,
  text,
  timestamp,
  varchar,
  uuid,
  jsonb,
  doublePrecision,
  index,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export type BaselineMetrics = {
  monthlyAvg: number;
  months: number;
  byService: Record<string, number>;
  byCategory: Record<string, number>;
  byProvider: Record<string, number>;
  byTeam: Record<string, number>;
  byProduct: Record<string, number>;
};

export const baselinesTable = pgTable(
  "baselines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    costType: varchar("cost_type", { length: 16 }).notNull().default("EffectiveCost"),
    totalCost: doublePrecision("total_cost").notNull(),
    metrics: jsonb("metrics").notNull().$type<BaselineMetrics>(),
    isActive: varchar("is_active", { length: 8 }).notNull().default("true"),
    source: varchar("source", { length: 16 }).notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("baselines_tenant_idx").on(t.tenantId)],
);

export type Baseline = typeof baselinesTable.$inferSelect;
