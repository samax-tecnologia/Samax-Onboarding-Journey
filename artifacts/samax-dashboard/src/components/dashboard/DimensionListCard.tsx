import { useGetFocusBreakdown } from "@workspace/api-client-react";
import { useFilters, toCommonParams } from "@/lib/filters-store";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "./Sparkline";
import type { ReactNode } from "react";

type Props = {
  dimension: "team" | "product" | "provider";
  title: string;
  icon: ReactNode;
  limit?: number;
};

export function DimensionListCard({ dimension, title, icon, limit = 8 }: Props) {
  const { filters, anchorEnd } = useFilters();
  const common = toCommonParams(filters, anchorEnd);
  const { data, isLoading, isError } = useGetFocusBreakdown({
    dimension,
    limit,
    ...common,
  });

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1 text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {icon}
        {title}
      </div>
      <div className="text-sm text-muted-foreground mb-4">
        Top {limit} · trailing 3 meses
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <div className="text-sm text-destructive">Erro ao carregar.</div>
      ) : data.items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Sem dados para a seleção atual.
        </div>
      ) : (
        <ul className="divide-y">
          {data.items.map((item, idx) => (
            <li key={item.key} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs tabular-nums text-muted-foreground w-5 text-right">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <Sparkline values={item.sparkline ?? []} />
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {formatCurrency(item.amount, data.currency, { compact: true })}
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      {formatPercent(item.percent)}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
