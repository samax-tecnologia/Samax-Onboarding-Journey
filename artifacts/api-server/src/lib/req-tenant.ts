import type { Request } from "express";

export type TenantContext = {
  tenantId: string;
  tenantDataSource: "mock" | "live";
};

/**
 * Reads tenant context off the request. The `resolveTenant` middleware sets
 * these properties; this helper centralises the cast so route code stays clean
 * and we don't depend on cross-file module augmentation propagation.
 */
export function getTenant(req: Request): TenantContext {
  const r = req as Request & Partial<TenantContext>;
  if (!r.tenantId || !r.tenantDataSource) {
    throw new Error("getTenant called before resolveTenant middleware");
  }
  return { tenantId: r.tenantId, tenantDataSource: r.tenantDataSource };
}
