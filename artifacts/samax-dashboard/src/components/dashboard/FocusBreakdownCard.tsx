import { useState } from "react";
import { useGetFocusBreakdown } from "@workspace/api-client-react";
import { useFilters, toCommonParams } from "@/lib/filters-store";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Layers } from "lucide-react";

type Dimension = "serviceCategory" | "chargeCategory";

const CATEGORY_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(142 50% 35%)",
  "hsl(120 30% 50%)",
];

export function FocusBreakdownCard() {
  const { filters, anchorEnd } = useFilters();
  const common = toCommonParams(filters, anchorEnd);
  const [dimension, setDimension] = useState<Dimension>("serviceCategory");
  const [drillParent, setDrillParent] = useState<string | null>(null);

  const isDrilled = dimension === "serviceCategory" && drillParent !== null;
  const effectiveDimension = isDrilled ? "serviceName" : dimension;

  const { data, isLoading, isError } = useGetFocusBreakdown({
    dimension: effectiveDimension,
    parent: isDrilled ? drillParent ?? undefined : undefined,
    limit: 10,
    ...common,
  });

  return (
    <Card className="p-6 lg:col-span-2">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">
            <Layers className="w-3.5 h-3.5" />
            Custo por categoria FOCUS
          </div>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            {isDrilled ? (
              <>
                <button
                  onClick={() => setDrillParent(null)}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>
                <span className="mx-1">·</span>
                <span>Serviços em {drillParent}</span>
              </>
            ) : (
              <span>
                {dimension === "serviceCategory" ? "ServiceCategory" : "ChargeCategory"} —
                trailing 3 meses
              </span>
            )}
          </div>
        </div>
        {!isDrilled && (
          <Tabs value={dimension} onValueChange={(v) => setDimension(v as Dimension)}>
            <TabsList className="h-8">
              <TabsTrigger value="serviceCategory" className="text-xs px-3">
                Service
              </TabsTrigger>
              <TabsTrigger value="chargeCategory" className="text-xs px-3">
                Charge
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <div className="text-sm text-destructive py-8">Erro ao carregar breakdown.</div>
      ) : data.items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-12 text-center">
          Sem dados para a seleção atual.
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.items.map((item, idx) => {
            const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
            const drillable = !isDrilled && dimension === "serviceCategory";
            return (
              <li key={item.key}>
                <Button
                  variant="ghost"
                  className="w-full h-auto py-2 px-2 justify-start text-left whitespace-normal"
                  disabled={!drillable}
                  onClick={() => drillable && setDrillParent(item.key)}
                >
                  <div className="w-full">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ background: color }}
                        />
                        <span className="text-sm font-medium truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(item.amount, data.currency)}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                          {formatPercent(item.percent)}
                        </span>
                        {drillable && (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(2, item.percent * 100)}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
