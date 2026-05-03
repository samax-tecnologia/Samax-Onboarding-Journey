import type { Request, Response, NextFunction } from "express";
import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_TENANT = process.env["DEFAULT_TENANT_ID"] ?? "demo";

// Resolve current tenant from `x-samax-tenant` header (falls back to default).
// This is a placeholder until real auth lands. We always look up the tenant
// row so unknown tenants are rejected loudly.
export async function resolveTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header("x-samax-tenant");
  const tenantId = (header && header.trim()) || DEFAULT_TENANT;

  const rows = await db
    .select({ id: tenantsTable.id, dataSource: tenantsTable.dataSource })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    req.log.warn({ tenantId }, "Unknown tenant");
    res.status(404).json({ error: "unknown_tenant", tenantId });
    return;
  }

  // Augment the request via cast — the helper in lib/req-tenant.ts reads it
  // back as typed values, so we don't need a global module augmentation.
  const r = req as Request & {
    tenantId?: string;
    tenantDataSource?: "mock" | "live";
  };
  r.tenantId = row.id;
  r.tenantDataSource = row.dataSource === "live" ? "live" : "mock";
  next();
}
