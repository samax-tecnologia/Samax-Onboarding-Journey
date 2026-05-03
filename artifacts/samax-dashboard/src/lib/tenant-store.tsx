import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setExtraHeadersGetter } from "@workspace/api-client-react";

const TENANTS = [
  { id: "demo", label: "Demo (mock)" },
  { id: "acme", label: "Acme Cloud (live)" },
] as const;

const STORAGE_KEY = "samax-tenant";

type TenantContextValue = {
  tenantId: string;
  setTenantId: (id: string) => void;
  options: typeof TENANTS;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "demo";
    return window.localStorage.getItem(STORAGE_KEY) ?? "demo";
  });

  // Re-register the header getter whenever the tenant changes so the next
  // fetch sees the new value. Safe across React strict-mode double mounts.
  useEffect(() => {
    setExtraHeadersGetter(() => ({ "x-samax-tenant": tenantId }));
    return () => setExtraHeadersGetter(null);
  }, [tenantId]);

  const setTenantId = useCallback((id: string) => {
    setTenantIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const value = useMemo(() => ({ tenantId, setTenantId, options: TENANTS }), [tenantId, setTenantId]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside <TenantProvider>");
  return ctx;
}
