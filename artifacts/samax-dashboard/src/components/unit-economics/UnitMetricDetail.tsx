import { useMemo, useState } from "react";
import { useGetFocusTimeSeries } from "@workspace/api-client-react";
import { useFilters, toCommonParams } from "@/lib/filters-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDown, ArrowUp, Minus, Pencil, Upload, Trash2, Copy } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { useUnitEconomics, type UnitMetric } from "@/lib/unit-economics-store";
import {
  buildUnitSeries,
  computeKpis,
  formatUnitCost,
} from "@/lib/unit-economics-compute";
import { formatCurrency, formatPercent, formatPeriod } from "@/lib/format";
import { DataPointTable } from "./DataPointTable";
import { CsvImportDialog } from "./CsvImportDialog";
import { MetricEditor } from "./MetricEditor";
import { useToast } from "@/hooks/use-toast";

type Props = { metric: UnitMetric };

function intersect(a: string[] | undefined, b: string[] | undefined): string[] | undefined {
  if (!a || a.length === 0) return b && b.length > 0 ? b : undefined;
  if (!b || b.length === 0) return a;
  const set = new Set(b.map((s) => s.toLowerCase()));
  const r = a.filter((s) => set.has(s.toLowerCase()));
  return r.length > 0 ? r : ["__none__"]; // ensure empty result if mutually exclusive
}

export function UnitMetricDetail({ metric }: Props) {
  const { filters, anchorEnd } = useFilters();
  const { getData, deleteMetric, duplicateMetric } = useUnitEconomics();
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  const common = toCommonParams(filters, anchorEnd);
  // Intersect active filter with metric numerator scope.
  const activeProviders = filters.providers;
  const activeTeams = filters.teams;
  const activeProducts = filters.products;
  const mProviders = intersect(activeProviders, metric.numerator.providers);
  const mTeams = intersect(activeTeams, metric.numerator.teams);
  const mProducts = intersect(activeProducts, metric.numerator.products);

  const params =
    filters.range.mode === "preset"
      ? {
          months: filters.range.months,
          providers: mProviders?.join(","),
          teams: mTeams?.join(","),
          products: mProducts?.join(","),
          costType: common.costType,
        }
      : {
          startDate: common.startDate,
          endDate: common.endDate,
          providers: mProviders?.join(","),
          teams: mTeams?.join(","),
          products: mProducts?.join(","),
          costType: common.costType,
        };
  const { data, isLoading, isError } = useGetFocusTimeSeries(params);

  const points = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        period: p.period,
        total: p.total,
        byProvider: p.byProvider as Record<string, number>,
      })),
    [data],
  );
  const denominator = getData(metric.id);
  const series = useMemo(
    () => buildUnitSeries(points, denominator, metric.granularity ?? "month"),
    [points, denominator, metric.granularity],
  );
  const kpis = useMemo(() => computeKpis(series), [series]);
  const currency = data?.currency ?? "USD";

  const onDelete = () => {
    if (!window.confirm(`Remover a métrica "${metric.name}"? Os dados informados serão perdidos.`)) {
      return;
    }
    deleteMetric(metric.id);
    toast({ title: "Métrica removida" });
  };

  const onDuplicate = () => {
    const copy = duplicateMetric(metric.id);
    if (copy) toast({ title: `Métrica duplicada como "${copy.name}"` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold tracking-tight" data-testid="metric-detail-name">
              {metric.name}
            </h2>
            <Badge variant="outline" className="text-[11px]">
              {metric.category === "business" ? "Negócio" : "Eficiência de recurso"}
            </Badge>
            <Badge variant="secondary" className="text-[11px]">
              por {metric.unitLabel}
            </Badge>
          </div>
          {metric.description && (
            <p className="text-sm text-muted-foreground mt-1">{metric.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)} data-testid="open-csv-import">
            <Upload className="w-3.5 h-3.5 mr-1.5" /> Importar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)} data-testid="edit-metric">
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
          </Button>
          <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicar">
            <Copy className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} title="Remover" data-testid="delete-metric">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <KpiCards kpis={kpis} metric={metric} currency={currency} />
      )}

      <Card>
        <CardContent className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
            Custo unitário ao longo do tempo
          </div>
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : isError ? (
            <div className="text-sm text-destructive">Não foi possível carregar a série de custos.</div>
          ) : (
            <UnitCostChart series={series} metric={metric} currency={currency} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <DataPointTable metric={metric} points={points} currency={currency} />
        </CardContent>
      </Card>

      <MetricEditor open={editorOpen} onOpenChange={setEditorOpen} editing={metric} />
      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} metric={metric} />
    </div>
  );
}

function KpiCards({
  kpis,
  metric,
  currency,
}: {
  kpis: ReturnType<typeof computeKpis>;
  metric: UnitMetric;
  currency: string;
}) {
  const fmt = (v: number | null) =>
    formatUnitCost(v, metric, currency, formatCurrency, formatPercent);
  const trendUp = kpis.delta !== null && kpis.delta > 0;
  const trendNeutral =
    kpis.deltaPercent !== null && Math.abs(kpis.deltaPercent) < 0.005;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Período atual
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1" data-testid="kpi-current">
            {fmt(kpis.current?.unitCost ?? null)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {kpis.current ? formatPeriod(kpis.current.period) : "—"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Período anterior
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {fmt(kpis.previous?.unitCost ?? null)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {kpis.previous ? formatPeriod(kpis.previous.period) : "—"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Variação
          </div>
          <div className="mt-1">
            {kpis.deltaPercent === null ? (
              <span className="text-sm text-muted-foreground">Sem comparação</span>
            ) : (
              <Badge
                variant="outline"
                className={
                  trendNeutral
                    ? "text-muted-foreground"
                    : trendUp
                      ? "text-destructive border-destructive/30 bg-destructive/5"
                      : "text-primary border-primary/30 bg-primary/5"
                }
              >
                {trendNeutral ? (
                  <Minus className="w-3 h-3 mr-1" />
                ) : trendUp ? (
                  <ArrowUp className="w-3 h-3 mr-1" />
                ) : (
                  <ArrowDown className="w-3 h-3 mr-1" />
                )}
                {formatPercent(Math.abs(kpis.deltaPercent))}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {kpis.delta !== null ? `${kpis.delta > 0 ? "+" : ""}${fmt(kpis.delta)}` : "—"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UnitCostChart({
  series,
  metric,
  currency,
}: {
  series: ReturnType<typeof buildUnitSeries>;
  metric: UnitMetric;
  currency: string;
}) {
  if (series.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-sm text-muted-foreground text-center px-6">
        Sem dados de custo no período selecionado.
      </div>
    );
  }
  const chartData = series.map((r) => ({
    period: formatPeriod(r.period),
    cost: r.cost,
    volume: r.volume,
    unitCost: r.unitCost,
  }));
  const fmtUnit = (n: number | null | undefined) =>
    n == null
      ? "—"
      : metric.format === "percent"
        ? formatPercent(n, 2)
        : formatCurrency(n, currency);
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="period"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="left"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              metric.format === "percent"
                ? formatPercent(Number(v), 1)
                : formatCurrency(Number(v), currency, { compact: true })
            }
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCurrency(Number(v), currency, { compact: true })}
          />
          {/* Hidden axis purely for the volume line, so it gets its own scale
              instead of being plotted against the (currency/percent) unit-cost axis. */}
          <YAxis yAxisId="volume" orientation="right" hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--popover-border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number | string, name: string) => {
              const n = Number(value);
              if (name === "Custo unitário") return [fmtUnit(n), name];
              if (name === "Custo") return [formatCurrency(n, currency), name];
              if (name === "Volume") return [n.toLocaleString("pt-BR"), name];
              return [String(value), name];
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar
            yAxisId="right"
            dataKey="cost"
            name="Custo"
            fill="hsl(var(--chart-2))"
            opacity={0.4}
            radius={[2, 2, 0, 0]}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="unitCost"
            name="Custo unitário"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            yAxisId="volume"
            type="monotone"
            dataKey="volume"
            name="Volume"
            stroke="hsl(var(--chart-3))"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
            hide={metric.format === "percent"}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
