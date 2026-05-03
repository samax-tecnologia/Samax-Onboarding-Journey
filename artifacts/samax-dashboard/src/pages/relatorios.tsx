import { useEffect, useMemo, useState } from "react";
import {
  useListOptimizationReports,
  useCreateOptimizationReport,
  useGetOptimizationReport,
  useDeleteOptimizationReport,
  useListBaselines,
  useCreateBaseline,
  useListAppliedChanges,
  useCreateAppliedChange,
  useUpdateAppliedChange,
  useDeleteAppliedChange,
  AppliedChangeUpdateStatus,
  useGetFocusFilters,
  useGetFocusSavings,
  getListOptimizationReportsQueryKey,
  getListBaselinesQueryKey,
  getListAppliedChangesQueryKey,
  type OptimizationReportSummary,
  type OptimizationReport,
  type Baseline,
  type AppliedChange,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/lib/tenant-store";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  Sparkles,
  FileDown,
  ArrowLeft,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  Layers,
} from "lucide-react";
import { customFetchUrl } from "@/lib/report-pdf-url";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function defaultPeriod(periodEndIso?: string): { start: string; end: string } {
  const end = periodEndIso ? new Date(periodEndIso) : new Date();
  // Last full month: start = first day of (end - 1 month), end = first day of end-month
  const firstOfEndMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const start = new Date(Date.UTC(firstOfEndMonth.getUTCFullYear(), firstOfEndMonth.getUTCMonth() - 1, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: firstOfEndMonth.toISOString().slice(0, 10),
  };
}

function defaultBaselineWindow(periodEndIso?: string): { start: string; end: string } {
  const end = periodEndIso ? new Date(periodEndIso) : new Date();
  const firstOfEndMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  // 3 months baseline ending one month before "current period"
  const baseEnd = new Date(Date.UTC(firstOfEndMonth.getUTCFullYear(), firstOfEndMonth.getUTCMonth() - 1, 1));
  const baseStart = new Date(Date.UTC(baseEnd.getUTCFullYear(), baseEnd.getUTCMonth() - 3, 1));
  return {
    start: baseStart.toISOString().slice(0, 10),
    end: baseEnd.toISOString().slice(0, 10),
  };
}

export default function RelatoriosPage() {
  const { tenantId } = useTenant();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"reports" | "baselines" | "changes">("reports");

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="relatorios-title">
            Relatórios de otimização
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compare o período atual com um baseline congelado, registre as mudanças aplicadas e
            exporte um PDF auditável. Tenant: <span className="font-medium text-foreground">{tenantId}</span>.
          </p>
        </div>
      </div>

      {openId ? (
        <ReportViewer reportId={openId} onBack={() => setOpenId(null)} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="reports" data-testid="tab-reports">
              <ClipboardList className="w-4 h-4 mr-1.5" /> Relatórios
            </TabsTrigger>
            <TabsTrigger value="baselines" data-testid="tab-baselines">
              <Layers className="w-4 h-4 mr-1.5" /> Baselines
            </TabsTrigger>
            <TabsTrigger value="changes" data-testid="tab-changes">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Mudanças aplicadas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="reports" className="mt-4">
            <ReportsTab onOpen={(id) => setOpenId(id)} />
          </TabsContent>
          <TabsContent value="baselines" className="mt-4">
            <BaselinesTab tenantId={tenantId} />
          </TabsContent>
          <TabsContent value="changes" className="mt-4">
            <AppliedChangesTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// =============================================================================
// Reports tab
// =============================================================================

function ReportsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { tenantId } = useTenant();
  const { data: reports, isLoading } = useListOptimizationReports();
  const { data: baselines } = useListBaselines(tenantId);
  const [wizardOpen, setWizardOpen] = useState(false);

  const hasBaseline = (baselines?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {reports ? `${reports.length} relatório(s)` : ""}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setWizardOpen(true)}
            disabled={!hasBaseline}
            data-testid="open-report-wizard"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Gerar relatório
          </Button>
        </div>
      </div>

      {!hasBaseline && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 text-sm flex items-start gap-3">
            <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600" />
            <div>
              Crie um <strong>baseline</strong> antes de gerar um relatório. Vá para a aba "Baselines" para registrar o estado de
              referência (ex.: meses anteriores ao início do trabalho com a Samax).
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (reports?.length ?? 0) === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum relatório gerado ainda</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Os relatórios congelam o snapshot do período e do baseline, e ficam disponíveis para download em PDF.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports!.map((r) => (
            <ReportRow key={r.id} report={r} onOpen={() => onOpen(r.id)} />
          ))}
        </div>
      )}

      <ReportWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} onCreated={(id) => onOpen(id)} />
    </div>
  );
}

function ReportRow({
  report,
  onOpen,
}: {
  report: OptimizationReportSummary;
  onOpen: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const del = useDeleteOptimizationReport();
  const savings = report.baselineProjectedCost - report.totalCost;
  const savingsPct = report.baselineProjectedCost > 0 ? savings / report.baselineProjectedCost : 0;
  const positive = savings >= 0;

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir o relatório "${report.title}"?`)) return;
    await del.mutateAsync({ id: report.id });
    qc.invalidateQueries({ queryKey: getListOptimizationReportsQueryKey() });
    toast({ title: "Relatório excluído" });
  };

  return (
    <Card
      className="hover:bg-muted/40 transition-colors cursor-pointer"
      onClick={onOpen}
      data-testid={`report-row-${report.id}`}
    >
      <CardContent className="p-5 flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{report.title}</span>
            {report.baselineLabel && (
              <Badge variant="outline" className="text-[11px]">vs {report.baselineLabel}</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Período: {fmtDate(report.periodStart)} → {fmtDate(report.periodEnd)} ·
            Gerado em {new Date(report.createdAt).toLocaleString("pt-BR")}
            {report.author ? ` · ${report.author}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Custo no período</div>
            <div className="text-base font-semibold tabular-nums">
              {formatCurrency(report.totalCost, report.currency)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Δ vs baseline</div>
            <div
              className={`text-base font-semibold tabular-nums inline-flex items-center gap-1 ${
                positive ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {positive ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              {formatCurrency(Math.abs(savings), report.currency)} ({formatPercent(Math.abs(savingsPct))})
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                window.open(customFetchUrl(report.pdfUrl ?? `/optimization-reports/${report.id}/pdf`, tenantId), "_blank");
              }}
              data-testid={`download-pdf-${report.id}`}
            >
              <FileDown className="w-3.5 h-3.5 mr-1" /> PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} title="Excluir relatório">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportWizardDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { tenantId } = useTenant();
  const { data: filters } = useGetFocusFilters();
  const { data: baselines } = useListBaselines(tenantId);
  const create = useCreateOptimizationReport();
  const qc = useQueryClient();
  const { toast } = useToast();

  const def = defaultPeriod(filters?.periodEnd);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(def.start);
  const [end, setEnd] = useState(def.end);
  const [baselineId, setBaselineId] = useState<string>("");
  const [author, setAuthor] = useState("");

  useEffect(() => {
    if (!open) return;
    const d = defaultPeriod(filters?.periodEnd);
    setStart(d.start);
    setEnd(d.end);
    if (!title) {
      setTitle(`Relatório ${new Date(d.start).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}`);
    }
    const active = baselines?.find((b) => b.isActive) ?? baselines?.[0];
    if (active && !baselineId) setBaselineId(active.id);
  }, [open, filters?.periodEnd, baselines]);

  const onSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Informe um título", variant: "destructive" });
      return;
    }
    try {
      const created = await create.mutateAsync({
        data: {
          title: title.trim(),
          periodStart: start,
          periodEnd: end,
          baselineId: baselineId || undefined,
          author: author.trim() || undefined,
        },
      });
      qc.invalidateQueries({ queryKey: getListOptimizationReportsQueryKey() });
      toast({ title: "Relatório gerado" });
      onOpenChange(false);
      onCreated(created.id);
    } catch (err) {
      toast({ title: "Falha ao gerar", description: String(err), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar relatório de otimização</DialogTitle>
          <DialogDescription>
            Compara o período escolhido com um baseline congelado e produz um PDF auditável.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Relatório fechamento Q1"
              data-testid="report-title"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Período · início</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                data-testid="report-period-start"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Período · fim (exclusivo)</Label>
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                data-testid="report-period-end"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Baseline</Label>
            <Select value={baselineId} onValueChange={setBaselineId}>
              <SelectTrigger data-testid="report-baseline">
                <SelectValue placeholder="Selecionar baseline" />
              </SelectTrigger>
              <SelectContent>
                {baselines?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label} ({fmtDate(b.periodStart)} → {fmtDate(b.periodEnd)})
                    {b.isActive ? " · ativo" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Autor (opcional)</Label>
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ex: Time FinOps"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={create.isPending} data-testid="submit-report">
            {create.isPending ? "Gerando…" : "Gerar relatório"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Report viewer
// =============================================================================

function ReportViewer({ reportId, onBack }: { reportId: string; onBack: () => void }) {
  const { tenantId } = useTenant();
  const { data, isLoading } = useGetOptimizationReport(reportId);
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data) return <div>Relatório não encontrado.</div>;
  const r = data as OptimizationReport;
  const summary = r.sections.executiveSummary;
  const positive = summary.savingsPercent >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
        </Button>
        <Button
          onClick={() => window.open(customFetchUrl(r.pdfUrl ?? `/optimization-reports/${r.id}/pdf`, tenantId), "_blank")}
          data-testid="viewer-download-pdf"
        >
          <FileDown className="w-4 h-4 mr-1.5" /> Baixar PDF
        </Button>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Período: {summary.periodLabel} · Baseline: {summary.baselineLabel}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mt-1">{r.title}</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Custo no período" value={formatCurrency(summary.totalCost, r.currency)} />
        <Stat label="Projeção do baseline" value={formatCurrency(summary.baselineProjectedCost, r.currency)} />
        <Stat
          label="Economia realizada"
          value={`${formatCurrency(Math.abs(summary.totalCost - summary.baselineProjectedCost), r.currency)} (${formatPercent(Math.abs(summary.savingsPercent))})`}
          tone={positive ? "good" : "bad"}
        />
        <Stat label="Mudanças aplicadas" value={String(summary.appliedChangesCount)} />
      </div>

      {r.sections.topWins && r.sections.topWins.length > 0 && (
        <Card data-testid="report-top-wins" className="border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/10">
          <CardHeader>
            <CardTitle className="text-base">Top 3 ganhos do período</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {r.sections.topWins.map((w, i) => (
                <li key={w.id} className="flex items-start gap-3" data-testid={`top-win-${i + 1}`}>
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{w.title}</div>
                    {w.scope && (
                      <div className="text-xs text-muted-foreground">{w.scope}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-semibold tabular-nums text-emerald-700">
                      {formatCurrency(w.realizedPeriodSavings, r.currency)}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {formatCurrency(w.realizedMonthlySavings, r.currency)} / mês
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {r.sections.timeSeries && r.sections.timeSeries.length > 0 && (
        <Card data-testid="report-timeseries">
          <CardHeader>
            <CardTitle className="text-base">Evolução: custo real vs projeção sem otimização</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeSeriesMiniChart points={r.sections.timeSeries} currency={r.currency} />
          </CardContent>
        </Card>
      )}

      {r.sections.efficiency && r.sections.efficiency.length > 0 && (
        <Card data-testid="report-efficiency">
          <CardHeader>
            <CardTitle className="text-base">Métricas de eficiência (FOCUS)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Métrica</TableHead>
                  <TableHead className="text-right">Período</TableHead>
                  <TableHead className="text-right">Baseline</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.sections.efficiency.map((m) => {
                  const fmt = (v: number | null | undefined) =>
                    v == null ? "—" : m.unit === "ratio" ? formatPercent(v) : formatCurrency(v, r.currency);
                  const dColor = (m.delta ?? 0) > 0 ? "text-red-600" : "text-emerald-600";
                  return (
                    <TableRow key={m.key}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(m.value)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {fmt(m.baselineValue)}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${dColor}`}>{fmt(m.delta)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.hint}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ComparisonCard title="Por categoria FOCUS" rows={r.sections.byCategory} currency={r.currency} />
      <ComparisonCard title="Por provedor" rows={r.sections.byProvider} currency={r.currency} />
      <ComparisonCard title="Top serviços (por variação)" rows={r.sections.byService.slice(0, 10)} currency={r.currency} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComparisonCard title="Por time" rows={r.sections.byTeam} currency={r.currency} />
        <ComparisonCard title="Por produto" rows={r.sections.byProduct} currency={r.currency} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mudanças aplicadas neste período</CardTitle>
        </CardHeader>
        <CardContent>
          {r.sections.appliedChanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma mudança ativa registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mudança</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aplicada em</TableHead>
                  <TableHead>Escopo</TableHead>
                  <TableHead className="text-right">Estimado / mês</TableHead>
                  <TableHead className="text-right">Realizado / mês</TableHead>
                  <TableHead className="text-right">No período</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.sections.appliedChanges.map((c) => (
                  <TableRow key={c.id} className={c.status === "reverted" ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "active" ? "default" : "outline"} className="text-xs">
                        {c.status === "active" ? "Ativa" : "Revertida"}
                      </Badge>
                    </TableCell>
                    <TableCell>{fmtDate(c.appliedAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[c.scopeProvider, c.scopeService, c.scopeCategory].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(c.estimatedMonthlySavings, r.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-emerald-600">
                      {formatCurrency(c.realizedMonthlySavings, r.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(c.realizedPeriodSavings, r.currency)}
                      <span className="text-[10px] ml-1">({c.activeMonths}m)</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Oportunidades em aberto (top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          {r.sections.openOpportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma oportunidade em aberto.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oportunidade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Provedor / Serviço</TableHead>
                  <TableHead className="text-right">Economia / mês</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.sections.openOpportunities.slice(0, 10).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.title}</TableCell>
                    <TableCell>{o.category}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.provider} · {o.service}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-emerald-600">
                      {formatCurrency(o.monthlySavings, r.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TimeSeriesMiniChart({
  points,
  currency,
}: {
  points: OptimizationReport["sections"]["timeSeries"];
  currency: string;
}) {
  const w = 720;
  const h = 180;
  const padL = 56;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const xs = points.length;
  const allValues = points.flatMap((p) => [p.actual, p.projectedNoOptimization]);
  const max = Math.max(1, ...allValues);
  const xFor = (i: number) =>
    padL + ((w - padL - padR) * i) / Math.max(1, xs - 1);
  const yFor = (v: number) => padT + (h - padT - padB) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => max * t);
  const linePath = (key: "actual" | "projectedNoOptimization") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(p[key]).toFixed(1)}`).join(" ");
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[200px]" role="img" aria-label="Evolução do custo">
        {ticks.map((tv, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={yFor(tv)} y2={yFor(tv)} stroke="#f3f4f6" strokeWidth={1} />
            <text x={padL - 6} y={yFor(tv) + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
              {formatCurrency(tv, currency)}
            </text>
          </g>
        ))}
        <path d={linePath("projectedNoOptimization")} stroke="#9ca3af" strokeWidth={1.4} strokeDasharray="4 4" fill="none" />
        <path d={linePath("actual")} stroke="hsl(var(--primary))" strokeWidth={2} fill="none" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xFor(i)} cy={yFor(p.actual)} r={2.5} fill="hsl(var(--primary))" />
            <text x={xFor(i)} y={h - 8} textAnchor="middle" fontSize={9} fill="#6b7280">
              {p.month}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex gap-4 text-xs text-muted-foreground mt-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-primary" /> Custo real
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 border-t border-dashed border-muted-foreground" /> Projeção sem otimização (baseline)
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-red-600"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-xl font-semibold tabular-nums mt-1 ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ComparisonCard({
  title,
  rows,
  currency,
}: {
  title: string;
  rows: OptimizationReport["sections"]["byCategory"];
  currency: string;
}) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Atual</TableHead>
              <TableHead className="text-right">Baseline*</TableHead>
              <TableHead className="text-right">Δ</TableHead>
              <TableHead className="text-right">Δ %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const positive = row.delta <= 0;
              return (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(row.current, currency)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(row.baseline, currency)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${positive ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {row.delta >= 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(row.delta), currency)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${positive ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {row.deltaPct >= 0 ? "+" : "−"}
                    {formatPercent(Math.abs(row.deltaPct))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="text-[11px] text-muted-foreground mt-2 italic">
          * Baseline projetado para o mesmo número de meses do período.
        </p>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Baselines tab
// =============================================================================

function BaselinesTab({ tenantId }: { tenantId: string }) {
  const { data: baselines, isLoading } = useListBaselines(tenantId);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Os baselines congelam métricas de um período de referência (média mensal, distribuição por serviço/provedor/time/etc.).
          Relatórios comparam o período atual contra esse snapshot.
        </div>
        <Button onClick={() => setOpen(true)} data-testid="open-baseline-wizard">
          <Plus className="w-4 h-4 mr-1.5" /> Novo baseline
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (baselines?.length ?? 0) === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum baseline ainda</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Sugestão: use os 3 meses anteriores ao início do trabalho com a Samax como baseline.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {baselines!.map((b) => <BaselineRow key={b.id} baseline={b} />)}
        </div>
      )}

      <BaselineWizardDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function BaselineRow({ baseline }: { baseline: Baseline }) {
  return (
    <Card>
      <CardContent className="p-5 flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{baseline.label}</span>
            {baseline.isActive && (
              <Badge variant="outline" className="text-[11px] border-emerald-300 text-emerald-700">
                Ativo
              </Badge>
            )}
            <Badge variant="outline" className="text-[11px]">{baseline.source}</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {fmtDate(baseline.periodStart)} → {fmtDate(baseline.periodEnd)} ·
            {baseline.months} {baseline.months === 1 ? "mês" : "meses"} · criado em {new Date(baseline.createdAt).toLocaleDateString("pt-BR")}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</div>
            <div className="text-base font-semibold tabular-nums">
              {formatCurrency(baseline.totalCost, baseline.currency)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Média / mês</div>
            <div className="text-base font-semibold tabular-nums">
              {formatCurrency(baseline.monthlyAvg, baseline.currency)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BaselineWizardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { tenantId } = useTenant();
  const { data: filters } = useGetFocusFilters();
  const create = useCreateBaseline();
  const qc = useQueryClient();
  const { toast } = useToast();
  const def = defaultBaselineWindow(filters?.periodEnd);
  const [label, setLabel] = useState("Baseline 3M");
  const [start, setStart] = useState(def.start);
  const [end, setEnd] = useState(def.end);

  useEffect(() => {
    if (!open) return;
    const d = defaultBaselineWindow(filters?.periodEnd);
    setStart(d.start);
    setEnd(d.end);
  }, [open, filters?.periodEnd]);

  const onSubmit = async () => {
    if (!label.trim()) {
      toast({ title: "Informe um nome", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        tenantId,
        data: {
          label: label.trim(),
          periodStart: start,
          periodEnd: end,
        },
      });
      qc.invalidateQueries({ queryKey: getListBaselinesQueryKey(tenantId) });
      toast({ title: "Baseline criado" });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Falha ao criar baseline", description: String(err), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo baseline</DialogTitle>
          <DialogDescription>
            Selecione o período de referência. Recomendado: 3 a 6 meses anteriores ao início da otimização.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Baseline pré-Samax"
              data-testid="baseline-label"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="baseline-start" />
            </div>
            <div className="space-y-1.5">
              <Label>Fim (exclusivo)</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="baseline-end" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={create.isPending} data-testid="submit-baseline">
            {create.isPending ? "Calculando…" : "Criar baseline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Applied changes tab
// =============================================================================

function AppliedChangesTab() {
  const { data: changes, isLoading } = useListAppliedChanges();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Registre cada otimização aplicada (rightsizing, idle, commitment, etc.). Os relatórios usam essa lista para
          atribuir economia comprovada.
        </div>
        <Button onClick={() => setOpen(true)} data-testid="open-change-dialog">
          <Plus className="w-4 h-4 mr-1.5" /> Registrar mudança
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (changes?.length ?? 0) === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma mudança registrada</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Você pode registrar manualmente ou a partir de uma oportunidade existente.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {changes!.map((c) => <AppliedChangeRow key={c.id} change={c} />)}
        </div>
      )}

      <AppliedChangeDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function AppliedChangeRow({ change }: { change: AppliedChange }) {
  const qc = useQueryClient();
  const del = useDeleteAppliedChange();
  const update = useUpdateAppliedChange();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [overrideStr, setOverrideStr] = useState<string>(
    change.realizedMonthlySavingsOverride == null
      ? ""
      : String(change.realizedMonthlySavingsOverride),
  );
  const [status, setStatus] = useState<string>(change.status);

  const onDelete = async () => {
    if (!window.confirm(`Excluir mudança "${change.title}"?`)) return;
    await del.mutateAsync({ id: change.id });
    qc.invalidateQueries({ queryKey: getListAppliedChangesQueryKey() });
    toast({ title: "Mudança removida" });
  };

  const onSave = async () => {
    let overrideValue: number | null = null;
    if (overrideStr.trim() !== "") {
      const n = Number(overrideStr.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        toast({ title: "Valor inválido", variant: "destructive" });
        return;
      }
      overrideValue = n;
    }
    await update.mutateAsync({
      id: change.id,
      data: {
        realizedMonthlySavingsOverride: overrideValue,
        status: status as (typeof AppliedChangeUpdateStatus)[keyof typeof AppliedChangeUpdateStatus],
      },
    });
    qc.invalidateQueries({ queryKey: getListAppliedChangesQueryKey() });
    toast({ title: "Mudança atualizada" });
    setEditing(false);
  };

  const onCancel = () => {
    setOverrideStr(
      change.realizedMonthlySavingsOverride == null
        ? ""
        : String(change.realizedMonthlySavingsOverride),
    );
    setStatus(change.status);
    setEditing(false);
  };

  return (
    <Card data-testid={`applied-change-row-${change.id}`}>
      <CardContent className="p-5 flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{change.title}</span>
            {change.opportunityId && (
              <Badge variant="outline" className="text-[11px]">{change.opportunityId}</Badge>
            )}
            <Badge variant="outline" className="text-[11px]">{change.status}</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Aplicada em {fmtDate(change.appliedAt)}
            {change.author ? ` por ${change.author}` : ""}
            {change.scopeProvider ? ` · ${change.scopeProvider}` : ""}
            {change.scopeService ? ` · ${change.scopeService}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6 flex-wrap">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimado / mês</div>
            <div className="text-base font-semibold tabular-nums">
              {formatCurrency(change.estimatedMonthlySavings)}
            </div>
          </div>
          {editing ? (
            <>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Realizado / mês (override)</div>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={overrideStr}
                  onChange={(e) => setOverrideStr(e.target.value)}
                  placeholder="auto"
                  className="h-8 w-32 text-right tabular-nums"
                  data-testid={`override-input-${change.id}`}
                />
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8 w-32" data-testid={`status-select-${change.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="reverted">reverted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  onClick={onSave}
                  disabled={update.isPending}
                  data-testid={`save-change-${change.id}`}
                >
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancel}>
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Realizado / mês</div>
                <div className="text-base font-semibold tabular-nums">
                  {change.realizedMonthlySavingsOverride == null
                    ? "auto"
                    : formatCurrency(change.realizedMonthlySavingsOverride)}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                data-testid={`edit-change-${change.id}`}
              >
                Editar
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete} title="Excluir">
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AppliedChangeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateAppliedChange();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: savings } = useGetFocusSavings({});

  const today = new Date().toISOString().slice(0, 10);
  const [opportunityId, setOpportunityId] = useState<string>("__custom__");
  const [title, setTitle] = useState("");
  const [appliedAt, setAppliedAt] = useState(today);
  const [author, setAuthor] = useState("");
  const [estimated, setEstimated] = useState<string>("0");
  const [scopeProvider, setScopeProvider] = useState("");
  const [scopeService, setScopeService] = useState("");
  const [scopeCategory, setScopeCategory] = useState("");

  const opps = savings?.opportunities ?? [];

  useEffect(() => {
    if (opportunityId === "__custom__") return;
    const o = opps.find((x) => x.id === opportunityId);
    if (!o) return;
    setTitle(o.title);
    setEstimated(String(o.monthlySavings));
    setScopeProvider(o.provider);
    setScopeService(o.service);
    setScopeCategory(o.category);
  }, [opportunityId, opps]);

  const onSubmit = async () => {
    const est = Number(estimated);
    if (!title.trim()) {
      toast({ title: "Informe o título", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(est)) {
      toast({ title: "Economia estimada inválida", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        data: {
          title: title.trim(),
          appliedAt,
          estimatedMonthlySavings: est,
          author: author.trim() || undefined,
          opportunityId: opportunityId === "__custom__" ? undefined : opportunityId,
          scopeProvider: scopeProvider || undefined,
          scopeService: scopeService || undefined,
          scopeCategory: scopeCategory || undefined,
        },
      });
      qc.invalidateQueries({ queryKey: getListAppliedChangesQueryKey() });
      toast({ title: "Mudança registrada" });
      onOpenChange(false);
      setOpportunityId("__custom__");
      setTitle("");
      setEstimated("0");
      setScopeProvider("");
      setScopeService("");
      setScopeCategory("");
    } catch (err) {
      toast({ title: "Falha ao registrar", description: String(err), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar mudança aplicada</DialogTitle>
          <DialogDescription>
            Vincule a uma oportunidade existente ou crie uma entrada manual.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Select value={opportunityId} onValueChange={setOpportunityId}>
              <SelectTrigger data-testid="change-opportunity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom__">Mudança manual (sem oportunidade)</SelectItem>
                {opps.slice(0, 30).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      {o.title} · {formatCurrency(o.monthlySavings)} / mês
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="change-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Aplicada em</Label>
              <Input type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Economia estimada (USD/mês)</Label>
              <Input
                type="number"
                step="0.01"
                value={estimated}
                onChange={(e) => setEstimated(e.target.value)}
                data-testid="change-estimated"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Provedor</Label>
              <Input value={scopeProvider} onChange={(e) => setScopeProvider(e.target.value)} placeholder="AWS" />
            </div>
            <div className="space-y-1.5">
              <Label>Serviço</Label>
              <Input value={scopeService} onChange={(e) => setScopeService(e.target.value)} placeholder="EC2" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={scopeCategory} onChange={(e) => setScopeCategory(e.target.value)} placeholder="rightsizing" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Autor</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Time FinOps" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={create.isPending} data-testid="submit-change">
            {create.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
