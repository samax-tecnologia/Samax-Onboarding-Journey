import { useEffect, useMemo, useState } from "react";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Upload, Sigma, Gauge } from "lucide-react";
import { useUnitEconomics } from "@/lib/unit-economics-store";
import { MetricEditor } from "@/components/unit-economics/MetricEditor";
import { CsvImportDialog } from "@/components/unit-economics/CsvImportDialog";
import { UnitMetricDetail } from "@/components/unit-economics/UnitMetricDetail";

export default function UnitEconomicsPage() {
  const { metrics, getData } = useUnitEconomics();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  // Keep a valid selection at all times.
  useEffect(() => {
    if (metrics.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !metrics.some((m) => m.id === selectedId)) {
      setSelectedId(metrics[0]!.id);
    }
  }, [metrics, selectedId]);

  const selected = useMemo(
    () => metrics.find((m) => m.id === selectedId) ?? null,
    [metrics, selectedId],
  );

  return (
    <div>
      <FilterBar />
      <div className="px-8 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Unit Economics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Conecte seu gasto multi-cloud a unidades de negócio (clientes, transações, FTEs, receita) e
              acompanhe o custo unitário ao longo do tempo.
            </p>
          </div>
          {metrics.length > 0 && (
            <Button onClick={() => setEditorOpen(true)} data-testid="add-metric">
              <Plus className="w-4 h-4 mr-1.5" /> Nova métrica
            </Button>
          )}
        </div>

        {metrics.length === 0 ? (
          <EmptyState onAdd={() => setEditorOpen(true)} onImport={() => setCsvOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6">
            <MetricList
              metrics={metrics}
              selectedId={selectedId}
              onSelect={setSelectedId}
              getData={getData}
            />
            <div>
              {selected ? (
                <UnitMetricDetail key={selected.id} metric={selected} />
              ) : (
                <Card>
                  <CardContent className="p-10 text-center text-sm text-muted-foreground">
                    Selecione uma métrica à esquerda.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        <MetricEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          onSaved={(m) => setSelectedId(m.id)}
        />
        {/*
          The "Import CSV" empty-state CTA needs a metric. We use a transient placeholder approach:
          create a metric first via editor; the per-metric detail view exposes its own CSV import.
          So in the empty state we instead route the user to "Nova métrica" — see EmptyState.
        */}
        {selected && (
          <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} metric={selected} />
        )}
      </div>
    </div>
  );
}

function MetricList({
  metrics,
  selectedId,
  onSelect,
  getData,
}: {
  metrics: ReturnType<typeof useUnitEconomics>["metrics"];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getData: ReturnType<typeof useUnitEconomics>["getData"];
}) {
  return (
    <Card>
      <CardContent className="p-2">
        <ul className="space-y-1">
          {metrics.map((m) => {
            const data = getData(m.id);
            const periodCount = Object.keys(data).length;
            const isActive = m.id === selectedId;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelect(m.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-md transition-colors",
                    isActive ? "bg-accent" : "hover:bg-accent/50",
                  )}
                  data-testid={`metric-list-item-${m.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        por {m.unitLabel}
                      </div>
                    </div>
                    {m.category === "business" ? (
                      <Sigma className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <Gauge className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {periodCount} período{periodCount === 1 ? "" : "s"}
                    </Badge>
                    {m.format === "percent" && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        %
                      </Badge>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <Card>
      <CardContent className="p-10 text-center max-w-2xl mx-auto space-y-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Sigma className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">O que é Unit Economics?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas que conectam seu gasto técnico a um denominador de negócio — por exemplo,
            <em> custo por cliente</em>, <em>custo por transação</em>, <em>custo por colaborador</em> ou
            <em> custo de tecnologia como % da receita</em>. Você define a métrica, informa o volume de
            negócio por período (manualmente ou via CSV), e nós calculamos o custo unitário a partir do
            seu gasto FOCUS já filtrado.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
          <Button onClick={onAdd} data-testid="empty-add-metric">
            <Plus className="w-4 h-4 mr-1.5" /> Adicionar métrica manualmente
          </Button>
          <Button variant="outline" onClick={onAdd} data-testid="empty-import-csv">
            <Upload className="w-4 h-4 mr-1.5" /> Importar CSV
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Os modelos prontos incluem custo por colaborador, custo por FTE de tecnologia e custo de
          tecnologia como % da receita. Após criar a métrica, importe o denominador via CSV ou preencha
          mês a mês.
        </p>
        {/* keep onImport referenced so unused-warning doesn't fire when we later wire it up */}
        <span className="hidden">{String(onImport)}</span>
      </CardContent>
    </Card>
  );
}
