import { db, tenantsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

// Seed the two baseline tenants used by the dashboard:
// - `demo`: serves the deterministic FOCUS mock (good for screenshots).
// - `acme`: a "real" tenant that starts empty until a connection is added.
export async function seedTenants(): Promise<void> {
  try {
    await db
      .insert(tenantsTable)
      .values([
        { id: "demo", name: "Demo (mock)", dataSource: "mock" },
        { id: "acme", name: "Acme Cloud", dataSource: "live" },
      ])
      .onConflictDoNothing();
    logger.info("Tenants seeded");
  } catch (err) {
    logger.error({ err }, "Failed to seed tenants");
  }
}
