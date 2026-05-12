export type TenantOption = { id: string; label: string };

export const TENANTS: readonly TenantOption[] = [
  { id: "demo", label: "Demo (mock)" },
  { id: "acme", label: "Acme Cloud (live)" },
] as const;
