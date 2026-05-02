import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CostType = "BilledCost" | "EffectiveCost";

export type DateRange = {
  /** Convenience preset; drives /focus/timeseries `months` and the derived window. */
  months: 3 | 6 | 12;
};

export type DashboardFilters = {
  range: DateRange;
  providers: string[];
  teams: string[];
  products: string[];
  costType: CostType;
};

type Ctx = {
  filters: DashboardFilters;
  /** ISO date (YYYY-MM-DD) — exclusive end of the dataset's "current" window. */
  anchorEnd: string | undefined;
  setAnchorEnd: (anchor: string | undefined) => void;
  setRange: (r: DateRange) => void;
  setProviders: (p: string[]) => void;
  setTeams: (t: string[]) => void;
  setProducts: (p: string[]) => void;
  setCostType: (c: CostType) => void;
  reset: () => void;
};

const DEFAULT: DashboardFilters = {
  range: { months: 6 },
  providers: [],
  teams: [],
  products: [],
  costType: "EffectiveCost",
};

const FilterCtx = createContext<Ctx | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT);
  const [anchorEnd, setAnchorEndState] = useState<string | undefined>(undefined);

  const setAnchorEnd = useCallback((anchor: string | undefined) => {
    setAnchorEndState((prev) => (prev === anchor ? prev : anchor));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      filters,
      anchorEnd,
      setAnchorEnd,
      setRange: (range) => setFilters((f) => ({ ...f, range })),
      setProviders: (providers) => setFilters((f) => ({ ...f, providers })),
      setTeams: (teams) => setFilters((f) => ({ ...f, teams })),
      setProducts: (products) => setFilters((f) => ({ ...f, products })),
      setCostType: (costType) => setFilters((f) => ({ ...f, costType })),
      reset: () => setFilters(DEFAULT),
    }),
    [filters, anchorEnd, setAnchorEnd],
  );

  return <FilterCtx.Provider value={value}>{children}</FilterCtx.Provider>;
}

export function useFilters(): Ctx {
  const ctx = useContext(FilterCtx);
  if (!ctx) throw new Error("useFilters must be used within FiltersProvider");
  return ctx;
}

/**
 * Helper: keep the FiltersProvider's anchor in sync with whatever the API
 * reports as the dataset's current period end.
 */
export function useSyncAnchor(anchorEnd: string | undefined) {
  const { setAnchorEnd } = useFilters();
  useEffect(() => {
    setAnchorEnd(anchorEnd);
  }, [anchorEnd, setAnchorEnd]);
}

/**
 * Derive ISO start/end dates from the months preset + anchor, so every
 * widget consumes the exact same time window.
 */
export function deriveWindow(
  months: 3 | 6 | 12,
  anchorEnd: string | undefined,
): { startDate?: string; endDate?: string } {
  if (!anchorEnd) return {};
  const [y, m, d] = anchorEnd.split("-").map((v) => Number(v));
  if (!y || !m || !d) return {};
  const end = new Date(Date.UTC(y, m - 1, d));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months, 1));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

/** Build the params object that the generated React Query hooks expect for filter-aware endpoints. */
export function toCommonParams(
  f: DashboardFilters,
  anchorEnd?: string,
) {
  const { startDate, endDate } = deriveWindow(f.range.months, anchorEnd);
  return {
    providers: f.providers.length ? f.providers.join(",") : undefined,
    teams: f.teams.length ? f.teams.join(",") : undefined,
    products: f.products.length ? f.products.join(",") : undefined,
    costType: f.costType,
    startDate,
    endDate,
  } as const;
}
