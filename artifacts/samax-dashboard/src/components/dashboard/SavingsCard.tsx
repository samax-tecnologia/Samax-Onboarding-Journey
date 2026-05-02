import { useGetFocusSummary } from "@workspace/api-client-react";
import { useFilters, toCommonParams } from "@/lib/filters-store";
import { formatCurrency } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ArrowRight } from "lucide-react";
import { categoryStyle } from "./savings-style";

type Props = {
  onViewAll?: () => void;
};

export function SavingsCard({ onViewAll }: Props) {
  const { filters, anchorEnd } = useFilters();
  const { data, isLoading, isError } = useGetFocusSummary(
    toCommonParams(filters, anchorEnd),
  );

  if (isLoading) {
    return (
      <Card className="p-6 lg:col-span-1 bg-primary/[0.04] border-primary/20">
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-12 w-32 mb-6" />
        <Skeleton className="h-16 w-full mb-2" />
        <Skeleton className="h-16 w-full mb-2" />
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="p-6 lg:col-span-1">
        <div className="text-sm text-destructive">
          Não foi possível carregar oportunidades de economia.
        </div>
      </Card>
    );
  }

  const empty = data.savingsCount === 0;

  return (
    <Card className="p-6 lg:col-span-1 bg-primary/[0.04] border-primary/20 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-primary/10 pointer-events-none" />
      <div className="flex items-start justify-between mb-2 relative">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          Economia identificada
        </div>
        <Badge className="bg-primary text-primary-foreground hover:bg-primary border-transparent">
          {data.savingsCount} oport.
        </Badge>
      </div>

      <div className="flex items-end gap-2 mt-3">
        <span className="text-4xl font-semibold tracking-tight tabular-nums text-primary">
          {formatCurrency(data.savingsTotal, data.currency)}
        </span>
        <span className="text-xs text-muted-foreground mb-2">/ mês potencial</span>
      </div>

      {empty ? (
        <div className="mt-6 text-sm text-muted-foreground">
          Nenhuma oportunidade encontrada para os filtros atuais.
        </div>
      ) : (
        <>
          <div className="mt-5 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            Top 3 por impacto
          </div>
          <ul className="mt-2 space-y-2">
            {data.topSavings.map((s) => {
              const style = categoryStyle(s.category);
              return (
                <li
                  key={s.id}
                  className="rounded-md border bg-card p-3 hover-elevate"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{s.provider}</span>
                        <span>·</span>
                        <span className="truncate">{s.service}</span>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="text-sm font-semibold text-primary tabular-nums">
                        {formatCurrency(s.monthlySavings, s.currency ?? "USD")}
                      </div>
                      <div className="text-[10px] text-muted-foreground">/ mês</div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className={style.badge}>
                      {style.label}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>

          {onViewAll && (
            <button
              onClick={onViewAll}
              className="mt-4 inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline"
            >
              Ver todas as oportunidades
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </>
      )}
    </Card>
  );
}
