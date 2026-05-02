import { useGetFocusTimeSeries } from "@workspace/api-client-react";
import { useFilters, toCommonParams } from "@/lib/filters-store";
import { formatCurrency, formatPercent, formatPeriod } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Minus, TrendingDown } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PROVIDER_COLORS: Record<string, string> = {
  AWS: "hsl(var(--chart-1))",
  Azure: "hsl(var(--chart-2))",
  GCP: "hsl(var(--chart-3))",
};

export function PastCostsChart() {
  const { filters, anchorEnd } = useFilters();
  const common = toCommonParams(filters, anchorEnd);
  // Note: /focus/timeseries derives its window from the `months` preset
  // (per the OpenAPI contract). startDate/endDate from `common` are used
  // by the other widgets to keep them in lockstep with the same window.
  const params = {
    months: filters.range.months,
    providers: common.providers,
    teams: common.teams,
    products: common.products,
    costType: common.costType,
  };
  const { data, isLoading, isError } = useGetFocusTimeSeries(params);

  if (isLoading) {
    return (
      <Card className="p-6 lg:col-span-3">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-72 w-full" />
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="p-6 lg:col-span-3">
        <div className="text-sm text-destructive">Não foi possível carregar a série temporal.</div>
      </Card>
    );
  }

  if (data.points.length === 0) {
    return (
      <Card className="p-6 lg:col-span-3">
        <EmptyState />
      </Card>
    );
  }

  const providers = Object.keys(data.points[0]?.byProvider ?? {});
  const chartData = data.points.map((p) => ({
    period: formatPeriod(p.period),
    ...p.byProvider,
  }));

  const trend = data.momDelta;
  const trendUp = trend > 0;
  const trendNeutral = Math.abs(trend) < 1;

  return (
    <Card className="p-6 lg:col-span-3">
      <div className="flex items-start justify-between mb-1 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">
            <TrendingDown className="w-3.5 h-3.5" />
            Custos históricos
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Últimos {filters.range.months} meses · {data.costType}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Total no período
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {formatCurrency(data.totalRange, data.currency)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              MoM
            </div>
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
              {formatPercent(Math.abs(data.momDeltaPercent))} ·{" "}
              {formatCurrency(Math.abs(trend), data.currency, { compact: true })}
            </Badge>
          </div>
        </div>
      </div>

      <div className="h-72 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="period"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCurrency(Number(v), data.currency, { compact: true })}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--accent))", opacity: 0.4 }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--popover-border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, name) => [
                formatCurrency(value, data.currency),
                String(name),
              ]}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            {providers.map((p) => (
              <Bar
                key={p}
                dataKey={p}
                stackId="a"
                fill={PROVIDER_COLORS[p] ?? "hsl(var(--chart-4))"}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="text-sm text-muted-foreground">
        Sem dados de custo para os filtros atuais.
      </div>
    </div>
  );
}
