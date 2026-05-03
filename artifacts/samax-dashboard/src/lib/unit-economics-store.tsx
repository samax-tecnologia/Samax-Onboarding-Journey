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
import { useTenant } from "@/lib/tenant-store";

export type MetricCategory = "resource_efficiency" | "business";
export type MetricFormat = "currency" | "percent";

export type UnitMetric = {
  id: string;
  name: string;
  description?: string;
  category: MetricCategory;
  /** e.g. "colaborador", "transação", "GB", "token", "FTE" */
  unitLabel: string;
  /** Display format. "percent" assumes denominator and numerator are in the same currency, ratio shown as %. */
  format: MetricFormat;
  /** Optional numerator scope filters that further restrict the active dashboard filter. Empty = use active filter as-is. */
  numerator: {
    providers?: string[];
    teams?: string[];
    products?: string[];
  };
  /** Optional reference to a built-in template (used for CSV sample naming). */
  templateId?: TemplateId;
  /** Period granularity. Defaults to "month" for backward-compat with metrics created
   *  before this field existed. */
  granularity?: "month" | "day";
  /** Optional thresholds for the unit cost. Any combination of:
   *   - target: ideal value (rendered as a reference line)
   *   - upperBound: maximum acceptable value (above = "fora do alvo")
   *   - lowerBound: minimum acceptable value (below = "fora do alvo")
   *  Values are in the same units as the metric's `format` (currency or ratio for percent). */
  thresholds?: {
    target?: number;
    upperBound?: number;
    lowerBound?: number;
  };
  createdAt: string;
};

/** Either "YYYY-MM" (month-granularity) or "YYYY-MM-DD" (day-granularity). */
export type Period = string;

export type UnitDataPoint = {
  period: Period;
  value: number;
};

export type UnitEconomicsState = {
  metrics: UnitMetric[];
  /** metricId -> period -> value */
  data: Record<string, Record<Period, number>>;
};

export type TemplateId = "cost-per-employee" | "cost-per-tech-fte" | "tech-cost-pct-revenue";

export type UnitMetricTemplate = {
  id: TemplateId;
  name: string;
  description: string;
  category: MetricCategory;
  unitLabel: string;
  format: MetricFormat;
  /** A short label used as the CSV "value" column header in the sample template. */
  sampleValueColumn: string;
};

export const TEMPLATES: UnitMetricTemplate[] = [
  {
    id: "cost-per-employee",
    name: "Custo por colaborador",
    description: "Gasto total de tecnologia dividido pelo número de colaboradores no período.",
    category: "business",
    unitLabel: "colaborador",
    format: "currency",
    sampleValueColumn: "headcount",
  },
  {
    id: "cost-per-tech-fte",
    name: "Custo por FTE de tecnologia",
    description:
      "Gasto total dividido pelo número de FTEs de tecnologia (engenharia, SRE, dados, etc.).",
    category: "business",
    unitLabel: "FTE de tecnologia",
    format: "currency",
    sampleValueColumn: "tech_fte",
  },
  {
    id: "tech-cost-pct-revenue",
    name: "Custo de tecnologia como % da receita",
    description: "Gasto total de tecnologia dividido pela receita do período, exibido em %.",
    category: "business",
    unitLabel: "receita",
    format: "percent",
    sampleValueColumn: "revenue",
  },
];

type Ctx = {
  metrics: UnitMetric[];
  getData: (metricId: string) => Record<Period, number>;
  upsertMetric: (m: Omit<UnitMetric, "id" | "createdAt"> & { id?: string }) => UnitMetric;
  deleteMetric: (id: string) => void;
  duplicateMetric: (id: string) => UnitMetric | null;
  setDataPoint: (metricId: string, period: Period, value: number) => void;
  removeDataPoint: (metricId: string, period: Period) => void;
  /** Bulk import. mode="merge" overlays new values on top, "replace" wipes existing first. */
  bulkSetDataPoints: (
    metricId: string,
    points: UnitDataPoint[],
    mode: "merge" | "replace",
  ) => void;
};

const UnitEconCtx = createContext<Ctx | null>(null);

const EMPTY_STATE: UnitEconomicsState = { metrics: [], data: {} };

function storageKey(tenantId: string) {
  return `samax-unit-economics-v1:${tenantId}`;
}

function readState(tenantId: string): UnitEconomicsState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId));
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as UnitEconomicsState;
    if (!parsed || !Array.isArray(parsed.metrics) || typeof parsed.data !== "object") {
      return EMPTY_STATE;
    }
    return parsed;
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(tenantId: string, state: UnitEconomicsState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(tenantId), JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function genId() {
  return `m_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function UnitEconomicsProvider({ children }: { children: ReactNode }) {
  const { tenantId } = useTenant();
  const [state, setState] = useState<UnitEconomicsState>(() => readState(tenantId));
  const lastTenantRef = useRef<string>(tenantId);

  // Re-hydrate synchronously during render when the tenant changes, so we never
  // briefly persist the previous tenant's state under the new tenant's key.
  if (lastTenantRef.current !== tenantId) {
    lastTenantRef.current = tenantId;
    const fresh = readState(tenantId);
    // setState during render with a different tenant ref is safe: React will
    // throw away the in-flight render and restart with the fresh state.
    setState(fresh);
  }

  // Persist on every change (after render commits, so `state` is always for the current tenant).
  useEffect(() => {
    writeState(tenantId, state);
  }, [tenantId, state]);

  const upsertMetric = useCallback<Ctx["upsertMetric"]>((input) => {
    let result!: UnitMetric;
    setState((prev) => {
      const id = input.id ?? genId();
      const existing = prev.metrics.find((m) => m.id === id);
      const next: UnitMetric = {
        id,
        name: input.name,
        description: input.description,
        category: input.category,
        unitLabel: input.unitLabel,
        format: input.format,
        numerator: input.numerator ?? {},
        templateId: input.templateId,
        granularity: input.granularity ?? "month",
        thresholds: input.thresholds,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      result = next;
      const metrics = existing
        ? prev.metrics.map((m) => (m.id === id ? next : m))
        : [...prev.metrics, next];
      return { ...prev, metrics };
    });
    return result;
  }, []);

  const deleteMetric = useCallback<Ctx["deleteMetric"]>((id) => {
    setState((prev) => {
      const { [id]: _omit, ...rest } = prev.data;
      void _omit;
      return { metrics: prev.metrics.filter((m) => m.id !== id), data: rest };
    });
  }, []);

  const duplicateMetric = useCallback<Ctx["duplicateMetric"]>((id) => {
    let copy: UnitMetric | null = null;
    setState((prev) => {
      const src = prev.metrics.find((m) => m.id === id);
      if (!src) return prev;
      const newId = genId();
      copy = {
        ...src,
        id: newId,
        name: `${src.name} (cópia)`,
        createdAt: new Date().toISOString(),
      };
      const data = { ...prev.data, [newId]: { ...(prev.data[id] ?? {}) } };
      return { metrics: [...prev.metrics, copy], data };
    });
    return copy;
  }, []);

  const setDataPoint = useCallback<Ctx["setDataPoint"]>((metricId, period, value) => {
    setState((prev) => {
      const existing = prev.data[metricId] ?? {};
      return {
        ...prev,
        data: { ...prev.data, [metricId]: { ...existing, [period]: value } },
      };
    });
  }, []);

  const removeDataPoint = useCallback<Ctx["removeDataPoint"]>((metricId, period) => {
    setState((prev) => {
      const existing = prev.data[metricId] ?? {};
      const { [period]: _omit, ...rest } = existing;
      void _omit;
      return { ...prev, data: { ...prev.data, [metricId]: rest } };
    });
  }, []);

  const bulkSetDataPoints = useCallback<Ctx["bulkSetDataPoints"]>(
    (metricId, points, mode) => {
      setState((prev) => {
        const base = mode === "replace" ? {} : { ...(prev.data[metricId] ?? {}) };
        for (const p of points) base[p.period] = p.value;
        return { ...prev, data: { ...prev.data, [metricId]: base } };
      });
    },
    [],
  );

  const getData = useCallback<Ctx["getData"]>(
    (metricId) => state.data[metricId] ?? {},
    [state.data],
  );

  const value = useMemo<Ctx>(
    () => ({
      metrics: state.metrics,
      getData,
      upsertMetric,
      deleteMetric,
      duplicateMetric,
      setDataPoint,
      removeDataPoint,
      bulkSetDataPoints,
    }),
    [
      state.metrics,
      getData,
      upsertMetric,
      deleteMetric,
      duplicateMetric,
      setDataPoint,
      removeDataPoint,
      bulkSetDataPoints,
    ],
  );

  return <UnitEconCtx.Provider value={value}>{children}</UnitEconCtx.Provider>;
}

export function useUnitEconomics(): Ctx {
  const ctx = useContext(UnitEconCtx);
  if (!ctx) throw new Error("useUnitEconomics must be used within UnitEconomicsProvider");
  return ctx;
}
