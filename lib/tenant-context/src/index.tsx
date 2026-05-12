import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { setExtraHeadersGetter } from "@workspace/api-client-react";
import { TENANTS } from "./tenants";
import type { TenantOption } from "./tenants";
export type { TenantOption } from "./tenants";

const STORAGE_KEY = "samax-tenant";
const TENANT_HEADER = "x-samax-tenant";

type TenantContextValue = {
  tenantId: string;
  setTenantId: (id: string) => void;
  options: readonly TenantOption[];
};

const TenantContext = createContext<TenantContextValue | null>(null);

function isAllowed(id: string | null | undefined): id is string {
  return !!id && TENANTS.some((t) => t.id === id);
}

function readUrlTenant(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = new URLSearchParams(window.location.search).get("tenant");
    return isAllowed(v) ? v : null;
  } catch {
    return null;
  }
}

function readInitial(): string {
  if (typeof window === "undefined") return "demo";
  const fromUrl = readUrlTenant();
  if (fromUrl) return fromUrl;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isAllowed(stored)) return stored;
  return "demo";
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantIdState] = useState<string>(readInitial);
  // A tab opened with an explicit `?tenant=` URL is "pinned" to that value and
  // ignores cross-tab storage updates that would otherwise flip it.
  const urlPinnedRef = useRef<string | null>(readUrlTenant());

  // Set the API client's tenant header synchronously during render so the very
  // first child query goes out with the correct x-samax-tenant value (avoiding
  // a race where the initial fetch falls back to the default tenant).
  const lastAppliedHeaderRef = useRef<string | null>(null);
  if (lastAppliedHeaderRef.current !== tenantId) {
    lastAppliedHeaderRef.current = tenantId;
    setExtraHeadersGetter(() => ({ [TENANT_HEADER]: tenantId }));
  }

  // Clear the header getter on unmount.
  useEffect(() => {
    return () => {
      setExtraHeadersGetter(null);
      lastAppliedHeaderRef.current = null;
    };
  }, []);

  // On mount, persist URL tenant so subsequent navigations within the same app keep it.
  useEffect(() => {
    const fromUrl = readUrlTenant();
    if (fromUrl && fromUrl !== window.localStorage.getItem(STORAGE_KEY)) {
      window.localStorage.setItem(STORAGE_KEY, fromUrl);
    }
  }, []);

  // Cross-tab sync: when another tab/app changes the tenant, mirror it here —
  // unless this tab is URL-pinned to a specific tenant.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (urlPinnedRef.current) return;
      const next = e.newValue;
      if (!isAllowed(next)) return;
      setTenantIdState((prev) => (prev === next ? prev : next));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTenantId = useCallback((id: string) => {
    if (!isAllowed(id)) return;
    setTenantIdState(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const value = useMemo(
    () => ({ tenantId, setTenantId, options: TENANTS }),
    [tenantId, setTenantId],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside <TenantProvider>");
  return ctx;
}
