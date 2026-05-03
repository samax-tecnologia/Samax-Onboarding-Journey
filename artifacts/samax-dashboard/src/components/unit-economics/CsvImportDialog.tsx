import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { parseCsv, normalizePeriodMonth, parseNumber } from "@/lib/csv-parse";
import { downloadCsv, toCsv } from "@/lib/export";
import {
  TEMPLATES,
  useUnitEconomics,
  type UnitMetric,
} from "@/lib/unit-economics-store";
import { Upload, Download, FileText, AlertTriangle } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  metric: UnitMetric;
};

type Preview = {
  rows: { period: string; value: number; raw: string[]; rowIndex: number }[];
  errors: { rowIndex: number; reason: string; raw: string[] }[];
};

export function CsvImportDialog({ open, onOpenChange, metric }: Props) {
  const { bulkSetDataPoints } = useUnitEconomics();
  const { toast } = useToast();

  const [fileName, setFileName] = useState<string | null>(null);
  const [header, setHeader] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [periodCol, setPeriodCol] = useState<string>("");
  const [valueCol, setValueCol] = useState<string>("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");

  const reset = () => {
    setFileName(null);
    setHeader([]);
    setRawRows([]);
    setPeriodCol("");
    setValueCol("");
    setMode("merge");
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.header.length === 0) {
      toast({ title: "CSV vazio ou inválido", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    setHeader(parsed.header);
    setRawRows(parsed.rows);
    // Auto-pick reasonable defaults
    const lower = parsed.header.map((h) => h.toLowerCase());
    const periodGuess =
      lower.findIndex((h) => /^per[ií]odo|period|m[eê]s|month|date$/.test(h));
    const valueGuess = lower.findIndex((h) =>
      /value|valor|qtd|quantidade|count|head|fte|revenue|receita/.test(h),
    );
    setPeriodCol(parsed.header[periodGuess >= 0 ? periodGuess : 0] ?? "");
    setValueCol(
      parsed.header[valueGuess >= 0 ? valueGuess : Math.min(1, parsed.header.length - 1)] ?? "",
    );
  };

  const preview: Preview = useMemo(() => {
    if (!periodCol || !valueCol) return { rows: [], errors: [] };
    const pIdx = header.indexOf(periodCol);
    const vIdx = header.indexOf(valueCol);
    const rows: Preview["rows"] = [];
    const errors: Preview["errors"] = [];
    const seen = new Map<string, number>();
    rawRows.forEach((raw, i) => {
      const periodRaw = raw[pIdx] ?? "";
      const valueRaw = raw[vIdx] ?? "";
      const period = normalizePeriodMonth(periodRaw);
      const value = parseNumber(valueRaw);
      if (!period) {
        errors.push({ rowIndex: i + 2, reason: `Período inválido: "${periodRaw}"`, raw });
        return;
      }
      if (value === null) {
        errors.push({ rowIndex: i + 2, reason: `Valor inválido: "${valueRaw}"`, raw });
        return;
      }
      if (value < 0) {
        errors.push({ rowIndex: i + 2, reason: `Valor negativo: ${value}`, raw });
        return;
      }
      if (seen.has(period)) {
        errors.push({
          rowIndex: i + 2,
          reason: `Período duplicado "${period}" (linha ${seen.get(period)})`,
          raw,
        });
        return;
      }
      seen.set(period, i + 2);
      rows.push({ period, value, raw, rowIndex: i + 2 });
    });
    rows.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
    return { rows, errors };
  }, [rawRows, header, periodCol, valueCol]);

  const onConfirm = () => {
    if (preview.rows.length === 0) {
      toast({ title: "Nada para importar", variant: "destructive" });
      return;
    }
    bulkSetDataPoints(metric.id, preview.rows.map(({ period, value }) => ({ period, value })), mode);
    toast({
      title: "Importação concluída",
      description: `${preview.rows.length} período(s) ${mode === "merge" ? "mesclado(s)" : "substituído(s)"}.`,
    });
    onOpenChange(false);
    reset();
  };

  const downloadSample = () => {
    const t = TEMPLATES.find((x) => x.id === metric.templateId);
    const valueCol = t?.sampleValueColumn ?? "value";
    const slug = (t?.id ?? "unit-economics").toLowerCase();
    const today = new Date();
    const periods: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
      periods.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }
    const sampleValues =
      t?.id === "tech-cost-pct-revenue"
        ? [820000, 845000, 870000, 905000, 930000, 980000]
        : t?.id === "cost-per-tech-fte"
          ? [38, 38, 40, 41, 43, 45]
          : t?.id === "cost-per-employee"
            ? [120, 122, 124, 128, 130, 134]
            : [100, 110, 120, 130, 140, 150];
    const csv = toCsv(
      ["period", valueCol],
      periods.map((p, i) => [p, sampleValues[i] ?? 0]),
    );
    downloadCsv(`samax-${slug}-sample.csv`, csv);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar denominador via CSV</DialogTitle>
          <DialogDescription>
            Carregue um CSV com pelo menos uma coluna de período (AAAA-MM) e uma de valor (volume).
            Mapeie as colunas, revise os erros e confirme.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <label className="cursor-pointer">
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {fileName ? "Trocar arquivo" : "Selecionar CSV"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  data-testid="csv-file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadSample}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar modelo
            </Button>
            {fileName && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> {fileName}
              </span>
            )}
          </div>

          {header.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Coluna de período</Label>
                  <Select value={periodCol} onValueChange={setPeriodCol}>
                    <SelectTrigger data-testid="csv-period-col">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {header.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Coluna de valor</Label>
                  <Select value={valueCol} onValueChange={setValueCol}>
                    <SelectTrigger data-testid="csv-value-col">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {header.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Modo</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as "merge" | "replace")}>
                    <SelectTrigger data-testid="csv-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge">Mesclar (sobrescreve por período)</SelectItem>
                      <SelectItem value="replace">Substituir tudo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Pré-visualização
                  </Label>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      {preview.rows.length} válida(s)
                    </Badge>
                    {preview.errors.length > 0 && (
                      <Badge variant="destructive" className="text-[11px]">
                        {preview.errors.length} erro(s)
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="rounded-md border max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.slice(0, 50).map((r) => (
                        <TableRow key={r.period}>
                          <TableCell>{r.period}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.value}</TableCell>
                        </TableRow>
                      ))}
                      {preview.rows.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={2}
                            className="text-center text-xs text-muted-foreground py-4"
                          >
                            Nenhuma linha válida com o mapeamento atual.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {preview.errors.length > 0 && (
                  <div className="mt-2 text-xs space-y-1">
                    <div className="flex items-center gap-1 text-destructive font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" /> Linhas ignoradas
                    </div>
                    <ul className="text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                      {preview.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>
                          Linha {e.rowIndex}: {e.reason}
                        </li>
                      ))}
                      {preview.errors.length > 20 && (
                        <li>… e mais {preview.errors.length - 20}.</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={preview.rows.length === 0}
            data-testid="csv-confirm"
          >
            Importar {preview.rows.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
