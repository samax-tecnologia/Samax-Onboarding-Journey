import {
  customType,
  pgTable,
  text,
  timestamp,
  varchar,
  uuid,
  jsonb,
  doublePrecision,
  integer,
  index,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});
import { tenantsTable } from "./tenants";
import { baselinesTable } from "./baselines";

export const optimizationReportsTable = pgTable(
  "optimization_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    baselineId: uuid("baseline_id").references(() => baselinesTable.id, {
      onDelete: "set null",
    }),
    baselineLabel: text("baseline_label"),
    author: text("author"),
    totalCost: doublePrecision("total_cost").notNull(),
    baselineProjectedCost: doublePrecision("baseline_projected_cost").notNull(),
    realizedSavings: doublePrecision("realized_savings").notNull(),
    appliedChangesCount: doublePrecision("applied_changes_count").notNull().default(0),
    payload: jsonb("payload").notNull(),
    pdfBytes: bytea("pdf_bytes"),
    pdfBytesSize: integer("pdf_bytes_size"),
    pdfGeneratedAt: timestamp("pdf_generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("optimization_reports_tenant_idx").on(t.tenantId)],
);

export type OptimizationReport = typeof optimizationReportsTable.$inferSelect;
