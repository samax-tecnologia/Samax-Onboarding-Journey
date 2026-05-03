import { useMemo, useState } from "react";
import {
  useGetFocusSavings,
  useCreateAppliedChange,
  getListAppliedChangesQueryKey,
  getListOptimizationReportsQueryKey,
} from "@workspace/api-client-react";
import type { SavingOpportunity } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFilters } from "@/lib/filters-store";
import { formatCurrency, humanize } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, Sparkles, ArrowUpDown, Download } from "lucide-react";
import { categoryStyle, effortLabel } from "./savings-style";
import { downloadCsv, toCsv, todayStamp } from "@/lib/export";

type SortKey = "monthlySavings" | "category" | "effort" | "provider";
type Saving = SavingOpportunity;

export function SavingsTable() {
  const { filters } = useFilters();
  const { data, isLoading, isError } = useGetFocusSavings({
    providers: filters.providers.length ? filters.providers.join(",") : undefined,
    teams: filters.teams.length ? filters.teams.join(",") : undefined,
    products: filters.products.length ? filters.products.join(",") : undefined,
  });

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "monthlySavings",
    dir: "desc",
  });
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Saving | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createApplied = useCreateAppliedChange();

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.opportunities;
    if (categoryFilter !== "all") {
      rows = rows.filter((r) => r.category === categoryFilter);
    }
    const sorted = [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "number" && typeof bv === "number") {
        return sort.dir === "asc" ? av - bv : bv - av;
      }
      return sort.dir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return sorted;
  }, [data, sort, categoryFilter]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({
      key,
      dir: s.key === key ? (s.dir === "asc" ? "desc" : "asc") : "desc",
    }));

  const SortHead = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      {sort.key === k ? (
        sort.dir === "desc" ? (
          <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUp className="w-3 h-3" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-50" />
      )}
    </button>
  );

  return (
    <Card className="lg:col-span-3 overflow-hidden">
      <div className="p-6 pb-3 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Oportunidades de economia
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {data ? `${data.count} oportunidades · ` : ""}
            {data ? formatCurrency(data.totalMonthlySavings, data.currency) : "—"} / mês
            potencial
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            disabled={!data || filtered.length === 0}
            onClick={() => {
              if (!data) return;
              const headers = [
                "id",
                "title",
                "category",
                "provider",
                "service",
                "resourceId",
                "team",
                "product",
                "effort",
                "monthlySavings",
                "currency",
                "recommendedAction",
                "details",
              ];
              const rows = filtered.map((r) => [
                r.id,
                r.title,
                r.category,
                r.provider,
                r.service,
                r.resourceId ?? "",
                humanize(r.team),
                humanize(r.product),
                r.effort,
                r.monthlySavings,
                r.currency ?? "USD",
                r.recommendedAction,
                r.details ?? "",
              ]);
              downloadCsv(
                `samax-oportunidades-${todayStamp()}.csv`,
                toCsv(headers, rows),
              );
            }}
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </Button>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              <SelectItem value="idle">Recurso ocioso</SelectItem>
              <SelectItem value="rightsizing">Rightsizing</SelectItem>
              <SelectItem value="commitment">Commitment</SelectItem>
              <SelectItem value="untagged">Untagged</SelectItem>
              <SelectItem value="storage-tier">Storage tier</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 pt-0 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <div className="p-6 text-sm text-destructive">Erro ao carregar oportunidades.</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          Nenhuma oportunidade encontrada para os filtros atuais.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[34%]">Oportunidade</TableHead>
                <TableHead>
                  <SortHead k="category" label="Categoria" />
                </TableHead>
                <TableHead>
                  <SortHead k="provider" label="Provedor / serviço" />
                </TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>
                  <SortHead k="effort" label="Esforço" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead k="monthlySavings" label="Economia / mês" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const style = categoryStyle(row.category);
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(row)}
                  >
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={style.badge}>
                        {style.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{row.provider}</div>
                      <div className="text-xs text-muted-foreground">{row.service}</div>
                    </TableCell>
                    <TableCell className="text-sm">{humanize(row.team)}</TableCell>
                    <TableCell className="text-sm">{humanize(row.product)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {effortLabel(row.effort)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-primary">
                      {formatCurrency(row.monthlySavings, row.currency ?? "USD")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <Badge
                  variant="outline"
                  className={categoryStyle(selected.category).badge + " w-fit"}
                >
                  {categoryStyle(selected.category).label}
                </Badge>
                <SheetTitle className="text-left">{selected.title}</SheetTitle>
                <SheetDescription className="text-left">
                  {selected.provider} · {selected.service}
                  {selected.resourceId ? ` · ${selected.resourceId}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="px-4 mt-6 space-y-5">
                <div className="rounded-md bg-primary/5 border border-primary/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-primary font-semibold">
                    Economia mensal estimada
                  </div>
                  <div className="text-3xl font-semibold tabular-nums text-primary mt-1">
                    {formatCurrency(selected.monthlySavings, selected.currency ?? "USD")}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
                    Ação recomendada
                  </div>
                  <p className="text-sm">{selected.recommendedAction}</p>
                </div>

                {selected.details && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
                      Detalhes
                    </div>
                    <p className="text-sm text-muted-foreground">{selected.details}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                  <Field label="Time" value={humanize(selected.team)} />
                  <Field label="Produto" value={humanize(selected.product)} />
                  <Field label="Esforço" value={effortLabel(selected.effort)} />
                </div>

                <div className="pt-2 flex gap-2">
                  <Button variant="outline" className="flex-1" disabled>
                    Atribuir responsável
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={createApplied.isPending}
                    data-testid={`mark-applied-${selected.id}`}
                    onClick={async () => {
                      try {
                        await createApplied.mutateAsync({
                          data: {
                            opportunityId: selected.id,
                            title: selected.title,
                            description: selected.recommendedAction,
                            scopeProvider: selected.provider,
                            scopeService: selected.service,
                            scopeCategory: selected.category,
                            scopeTeam: selected.team,
                            scopeProduct: selected.product,
                            scopeResourceId: selected.resourceId ?? undefined,
                            estimatedMonthlySavings: selected.monthlySavings,
                            appliedAt: new Date().toISOString().slice(0, 10),
                          },
                        });
                        await Promise.all([
                          queryClient.invalidateQueries({
                            queryKey: getListAppliedChangesQueryKey(),
                          }),
                          queryClient.invalidateQueries({
                            queryKey: getListOptimizationReportsQueryKey(),
                          }),
                        ]);
                        toast({
                          title: "Mudança registrada",
                          description: `"${selected.title}" será incluída no próximo relatório.`,
                        });
                        setSelected(null);
                      } catch (err) {
                        toast({
                          title: "Falha ao registrar",
                          description: err instanceof Error ? err.message : String(err),
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    {createApplied.isPending ? "Registrando…" : "Marcar como aplicada"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}
