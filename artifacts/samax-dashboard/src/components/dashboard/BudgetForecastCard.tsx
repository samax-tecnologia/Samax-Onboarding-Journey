import { useGetFocusSummary } from "@workspace/api-client-react";
import { useFilters, toCommonParams } from "@/lib/filters-store";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp, Wallet } from "lucide-react";

export function BudgetForecastCard() {
  const { filters, anchorEnd } = useFilters();
  const { data, isLoading, isError } = useGetFocusSummary(
    toCommonParams(filters, anchorEnd),
  );

  if (isLoading) {
    return (
      <Card className="p-6 lg:col-span-2">
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-12 w-64 mb-6" />
        <Skeleton className="h-3 w-full mb-3" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="p-6 lg:col-span-2">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">Não foi possível carregar o resumo de budget.</span>
        </div>
      </Card>
    );
  }

  const overBudget = data.projectedDelta > 0;
  const pctClamped = Math.max(0, Math.min(1, data.percentConsumed));

  return (
    <Card className="p-6 lg:col-span-2 relative overflow-hidden">
      <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-primary/5 pointer-events-none" />
      <div className="flex items-start justify-between mb-2 relative">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">
            <Wallet className="w-3.5 h-3.5" />
            Budget vs. forecast — período atual
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {data.periodStart} → {data.periodEnd} · {data.costType}
          </div>
        </div>
        <Badge
          variant={overBudget ? "destructive" : "secondary"}
          className={
            overBudget
              ? ""
              : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/10"
          }
        >
          {overBudget ? "Projeção acima do budget" : "Dentro do budget"}
        </Badge>
      </div>

      <div className="flex items-end gap-3 mt-4">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">
          {formatCurrency(data.actualSpend, data.currency, { compact: false })}
        </span>
        <span className="text-sm text-muted-foreground mb-1.5">gastos até agora</span>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-muted-foreground">
            {formatPercent(data.percentConsumed)} do budget consumido
          </span>
          <span className="text-muted-foreground tabular-nums">
            {formatCurrency(data.budget, data.currency, { compact: true })}
          </span>
        </div>
        <Progress value={pctClamped * 100} className="h-2" />
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t">
        <Metric
          label="Forecast fim do período"
          value={formatCurrency(data.forecastSpend, data.currency)}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
        />
        <Metric
          label="Budget"
          value={formatCurrency(data.budget, data.currency)}
        />
        <Metric
          label={overBudget ? "Excedente projetado" : "Folga projetada"}
          value={formatCurrency(Math.abs(data.projectedDelta), data.currency)}
          tone={overBudget ? "danger" : "good"}
        />
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "good" | "danger";
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div
        className={
          "mt-1 text-lg font-semibold tabular-nums " +
          (tone === "danger"
            ? "text-destructive"
            : tone === "good"
              ? "text-primary"
              : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
