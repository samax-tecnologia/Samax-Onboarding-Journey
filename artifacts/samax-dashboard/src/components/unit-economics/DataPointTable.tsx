import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Download } from "lucide-react";
import { downloadCsv, toCsv, todayStamp } from "@/lib/export";
import { useUnitEconomics, type UnitMetric } from "@/lib/unit-economics-store";
import {
  buildUnitSeries,
  evaluateThreshold,
  formatUnitCost,
  type FocusPoint,
} from "@/lib/unit-economics-compute";
import { formatCurrency, formatPercent, formatPeriod } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";
import { normalizePeriod } from "@/lib/csv-parse";

type Props = {
  metric: UnitMetric;
  points: FocusPoint[];
  currency: string;
};

export function DataPointTable({ metric, points, currency }: Props) {
  const { getData, setDataPoint, removeDataPoint } = useUnitEconomics();
  const denominator = getData(metric.id);
  const { toast } = useToast();

  const granularity = metric.granularity ?? "month";
  const series = useMemo(
    () => buildUnitSeries(points, denominator),
    [points, denominator],
  );

  const [newPeriod, setNewPeriod] = useState("");
  const [newValue, setNewValue] = useState("");

  // Periods present in the FOCUS series but with no manual value yet — surface them so the
  // user can fill them in directly.
  const missingPeriods = series.filter((r) => r.volume === null).map((r) => r.period);

  // Periods that the user has entered but that aren't in the FOCUS window.
  const orphanPeriods = useMemo(() => {
    const known = new Set(series.map((r) => r.period));
    return Object.keys(denominator)
      .filter((p) => !known.has(p))
      .sort();
  }, [denominator, series]);

  const onAdd = () => {
    const p = normalizePeriod(newPeriod, granularity);
    if (!p) {
      toast({
        title:
          granularity === "day"
            ? "Período inválido (use AAAA-MM-DD)"
            : "Período inválido (use AAAA-MM)",
        variant: "destructive",
      });
      return;
    }
    const n = Number(newValue.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    setDataPoint(metric.id, p, n);
    setNewPeriod("");
    setNewValue("");
  };

  const onEdit = (period: string, raw: string) => {
    if (raw.trim() === "") {
      removeDataPoint(metric.id, period);
      return;
    }
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    setDataPoint(metric.id, period, n);
  };

  const onExport = () => {
    const headers = ["period", "cost", `volume_${metric.unitLabel || "unit"}`, "unit_cost", "currency"];
    const rows = series.map((r) => [
      r.period,
      r.cost,
      r.volume ?? "",
      r.unitCost ?? "",
      currency,
    ]);
    const slug = metric.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    downloadCsv(`samax-unit-economics-${slug || "metric"}-${todayStamp()}.csv`, toCsv(headers, rows));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Períodos</div>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={series.length === 0}
          data-testid="period-table-export"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Volume ({metric.unitLabel || "unidade"})</TableHead>
              <TableHead className="text-right">Custo unitário</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {series.length === 0 && orphanPeriods.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                  Sem períodos ainda. Adicione manualmente abaixo ou importe um CSV.
                </TableCell>
              </TableRow>
            )}
            {series.map((r) => {
              const status = evaluateThreshold(r.unitCost, metric.thresholds);
              const breach = status === "above" || status === "below";
              return (
                <TableRow
                  key={r.period}
                  data-testid={`period-row-${r.period}`}
                  data-threshold-status={status}
                  className={cn(breach && "bg-destructive/5")}
                >
                  <TableCell className="font-medium">{formatPeriod(r.period)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(r.cost, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      key={`${r.period}:${r.volume ?? ""}`}
                      className="h-8 w-32 ml-auto text-right"
                      type="number"
                      step="any"
                      min="0"
                      defaultValue={r.volume ?? ""}
                      onBlur={(e) => onEdit(r.period, e.target.value)}
                      placeholder="—"
                      data-testid={`period-value-${r.period}`}
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      breach && "text-destructive font-medium",
                    )}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      {status === "above" && <ArrowUp className="w-3 h-3" aria-label="Acima do limite" />}
                      {status === "below" && <ArrowDown className="w-3 h-3" aria-label="Abaixo do limite" />}
                      {formatUnitCost(r.unitCost, metric, currency, formatCurrency, formatPercent)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.volume !== null && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeDataPoint(metric.id, r.period)}
                        title="Remover valor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {orphanPeriods.map((p) => (
              <TableRow key={p} className="text-muted-foreground">
                <TableCell>{formatPeriod(p)}</TableCell>
                <TableCell className="text-right text-xs italic">fora da janela</TableCell>
                <TableCell className="text-right tabular-nums">{denominator[p]}</TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeDataPoint(metric.id, p)}
                    title="Remover valor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Novo período ({granularity === "day" ? "AAAA-MM-DD" : "AAAA-MM"})
          </label>
          <Input
            className="h-8 w-36"
            value={newPeriod}
            onChange={(e) => setNewPeriod(e.target.value)}
            placeholder={granularity === "day" ? "2026-05-15" : "2026-05"}
            data-testid="new-period"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Valor</label>
          <Input
            className="h-8 w-32"
            type="number"
            step="any"
            min="0"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="0"
            data-testid="new-value"
          />
        </div>
        <Button onClick={onAdd} size="sm" data-testid="add-period">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar período
        </Button>
        {missingPeriods.length > 0 && (
          <div className="text-xs text-muted-foreground ml-auto">
            {missingPeriods.length} período(s) sem volume informado.
          </div>
        )}
      </div>
    </div>
  );
}
