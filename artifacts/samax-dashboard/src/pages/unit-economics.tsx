import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Upload, Sigma, Gauge } from "lucide-react";
import { useUnitEconomics } from "@/lib/unit-economics-store";
import type { ThresholdStatus } from "@/lib/unit-economics-compute";
import { AlertTriangle } from "lucide-react";
import { MetricEditor } from "@/components/unit-economics/MetricEditor";
import { CsvImportDialog } from "@/components/unit-economics/CsvImportDialog";
import { UnitMetricDetail } from "@/components/unit-economics/UnitMetricDetail";

export default function UnitEconomicsPage() {
  const { metrics, getData } = useUnitEconomics();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  // When the user starts from "Importar CSV" in the empty state we don't have a
  // metric yet — so we open the editor first and remember to chain the CSV
  // dialog right after the metric is created.
  const [importAfterCreate, setImportAfterCreate] = useState(false);
  // Breach status reported by the detail view for each metric the user has
  // visited in this session. Used by the sidebar to display the
  // "Fora do alvo" badge using the real unit-cost evaluation.
  const [breachByMetric, setBreachByMetric] = useState<Record<string, ThresholdStatus>>({});
  const handleBreachChange = useCallback((metricId: string, status: ThresholdStatus) => {
    setBreachByMetric((prev) => (prev[metricId] === status ? prev : { ...prev, [metricId]: status }));
  }, []);

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
            <h1 className="text-2xl font-semibold tracking-tight">
              Custo unitário <span className="text-muted-foreground font-normal">(Unit Economics)</span>
            </h1>
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
          <EmptyState
            onAdd={() => {
              setImportAfterCreate(false);
              setEditorOpen(true);
            }}
            onImport={() => {
              setImportAfterCreate(true);
              setEditorOpen(true);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6">
            <MetricList
              metrics={metrics}
              selectedId={selectedId}
              onSelect={setSelectedId}
              getData={getData}
              breachByMetric={breachByMetric}
            />
            <div>
              {selected ? (
                <UnitMetricDetail
                  key={selected.id}
                  metric={selected}
                  onBreachChange={handleBreachChange}
                />
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
          onSaved={(m) => {
            setSelectedId(m.id);
            if (importAfterCreate) {
              setImportAfterCreate(false);
              // Defer one tick so the editor finishes closing before we open the
              // CSV dialog over it.
              setTimeout(() => setCsvOpen(true), 0);
            }
          }}
        />
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
  breachByMetric,
}: {
  metrics: ReturnType<typeof useUnitEconomics>["metrics"];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getData: ReturnType<typeof useUnitEconomics>["getData"];
  breachByMetric: Record<string, ThresholdStatus>;
}) {
  return (
    <Card>
      <CardContent className="p-2">
        <ul className="space-y-1">
          {metrics.map((m) => {
            const data = getData(m.id);
            const periodCount = Object.keys(data).length;
            const isActive = m.id === selectedId;
            // Breach status comes from the detail view's evaluation against
            // the real unit cost (cost / volume). Metrics the user hasn't
            // visited yet won't have an entry here, so no badge is shown until
            // we have authoritative data.
            const status = breachByMetric[m.id];
            const breach = status === "above" || status === "below" ? status : null;
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
                    {breach && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] px-1.5 py-0 gap-1"
                        data-testid={`metric-list-breach-${m.id}`}
                      >
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Fora do alvo
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
          <Button variant="outline" onClick={onImport} data-testid="empty-import-csv">
            <Upload className="w-4 h-4 mr-1.5" /> Importar CSV
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Os modelos prontos incluem custo por colaborador, custo por FTE de tecnologia e custo de
          tecnologia como % da receita. Ao importar um CSV, criamos a métrica primeiro e em seguida
          abrimos o assistente de importação.
        </p>
      </CardContent>
    </Card>
  );
}
