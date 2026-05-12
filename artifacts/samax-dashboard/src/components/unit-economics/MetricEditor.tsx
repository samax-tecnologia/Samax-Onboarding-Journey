import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TEMPLATES, type TemplateId } from "@/lib/unit-economics-templates";
import {
  useUnitEconomics,
  type MetricCategory,
  type MetricFormat,
  type UnitMetric,
} from "@/lib/unit-economics-store";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When provided, the dialog edits this metric. Otherwise it creates a new one. */
  editing?: UnitMetric | null;
  onSaved?: (metric: UnitMetric) => void;
};

const CATEGORIES: { value: MetricCategory; label: string }[] = [
  { value: "resource_efficiency", label: "Eficiência de recurso" },
  { value: "business", label: "Negócio" },
];

const FORMATS: { value: MetricFormat; label: string }[] = [
  { value: "currency", label: "Moeda por unidade (ex: $/cliente)" },
  { value: "percent", label: "Percentual (ex: % da receita)" },
];

function csvList(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function MetricEditor({ open, onOpenChange, editing, onSaved }: Props) {
  const { upsertMetric } = useUnitEconomics();
  const { toast } = useToast();

  const [templateId, setTemplateId] = useState<TemplateId | "custom">("custom");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<MetricCategory>("business");
  const [unitLabel, setUnitLabel] = useState("");
  const [format, setFormat] = useState<MetricFormat>("currency");
  const [granularity, setGranularity] = useState<"month" | "day">("month");
  const [providers, setProviders] = useState("");
  const [teams, setTeams] = useState("");
  const [products, setProducts] = useState("");
  const [thresholdTarget, setThresholdTarget] = useState("");
  const [thresholdUpper, setThresholdUpper] = useState("");
  const [thresholdLower, setThresholdLower] = useState("");

  // Reset whenever the dialog opens or the "editing" target changes.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTemplateId(editing.templateId ?? "custom");
      setName(editing.name);
      setDescription(editing.description ?? "");
      setCategory(editing.category);
      setUnitLabel(editing.unitLabel);
      setFormat(editing.format);
      setGranularity(editing.granularity ?? "month");
      setProviders((editing.numerator.providers ?? []).join(", "));
      setTeams((editing.numerator.teams ?? []).join(", "));
      setProducts((editing.numerator.products ?? []).join(", "));
      const t = editing.thresholds;
      setThresholdTarget(t?.target != null ? String(t.target) : "");
      setThresholdUpper(t?.upperBound != null ? String(t.upperBound) : "");
      setThresholdLower(t?.lowerBound != null ? String(t.lowerBound) : "");
    } else {
      setTemplateId("custom");
      setName("");
      setDescription("");
      setCategory("business");
      setUnitLabel("");
      setFormat("currency");
      setGranularity("month");
      setProviders("");
      setTeams("");
      setProducts("");
      setThresholdTarget("");
      setThresholdUpper("");
      setThresholdLower("");
    }
  }, [open, editing]);

  const applyTemplate = (id: TemplateId | "custom") => {
    setTemplateId(id);
    if (id === "custom") return;
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setName(t.name);
    setDescription(t.description);
    setCategory(t.category);
    setUnitLabel(t.unitLabel);
    setFormat(t.format);
  };

  const onSubmit = () => {
    if (!name.trim()) {
      toast({ title: "Informe um nome para a métrica", variant: "destructive" });
      return;
    }
    if (!unitLabel.trim()) {
      toast({ title: "Informe o rótulo da unidade", variant: "destructive" });
      return;
    }
    const parseOpt = (s: string, label: string): number | undefined | "invalid" => {
      const trimmed = s.trim();
      if (!trimmed) return undefined;
      const n = Number(trimmed.replace(",", "."));
      if (!Number.isFinite(n)) {
        toast({
          title: `Valor inválido em "${label}"`,
          description: "Use apenas números (ex.: 12,5 ou 0.18).",
          variant: "destructive",
        });
        return "invalid";
      }
      return n;
    };
    const target = parseOpt(thresholdTarget, "Alvo");
    const upperBound = parseOpt(thresholdUpper, "Limite superior");
    const lowerBound = parseOpt(thresholdLower, "Limite inferior");
    if (target === "invalid" || upperBound === "invalid" || lowerBound === "invalid") return;
    if (
      typeof lowerBound === "number" &&
      typeof upperBound === "number" &&
      lowerBound > upperBound
    ) {
      toast({
        title: "Limites inválidos",
        description: "O limite inferior precisa ser menor ou igual ao limite superior.",
        variant: "destructive",
      });
      return;
    }
    if (
      typeof target === "number" &&
      ((typeof lowerBound === "number" && target < lowerBound) ||
        (typeof upperBound === "number" && target > upperBound))
    ) {
      toast({
        title: "Alvo fora dos limites",
        description: "O alvo precisa estar entre os limites inferior e superior.",
        variant: "destructive",
      });
      return;
    }
    const t = target as number | undefined;
    const u = upperBound as number | undefined;
    const l = lowerBound as number | undefined;
    const thresholds =
      t === undefined && u === undefined && l === undefined
        ? undefined
        : { target: t, upperBound: u, lowerBound: l };
    const saved = upsertMetric({
      id: editing?.id,
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      unitLabel: unitLabel.trim(),
      format,
      granularity,
      templateId: templateId === "custom" ? undefined : templateId,
      numerator: {
        providers: csvList(providers),
        teams: csvList(teams),
        products: csvList(products),
      },
      thresholds,
    });
    toast({ title: editing ? "Métrica atualizada" : "Métrica criada" });
    onOpenChange(false);
    onSaved?.(saved);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar métrica" : "Nova métrica de Unit Economics"}
          </DialogTitle>
          <DialogDescription>
            Defina como o custo será dividido por uma unidade de negócio para acompanhar custo unitário ao
            longo do tempo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!editing && (
            <div className="space-y-1.5">
              <Label>Começar a partir de um modelo</Label>
              <Select
                value={templateId}
                onValueChange={(v) => applyTemplate(v as TemplateId | "custom")}
              >
                <SelectTrigger data-testid="metric-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Personalizada</SelectItem>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Os modelos pré-preenchem os campos abaixo — você só precisa fornecer o denominador depois.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Custo por colaborador"
              data-testid="metric-name"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Quando e por que essa métrica importa"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as MetricCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rótulo da unidade</Label>
              <Input
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="ex: cliente, transação, GB, token, FTE"
                data-testid="metric-unit"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Formato de exibição</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as MetricFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Granularidade do período</Label>
              <Select
                value={granularity}
                onValueChange={(v) => setGranularity(v as "month" | "day")}
              >
                <SelectTrigger data-testid="metric-granularity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mensal (AAAA-MM)</SelectItem>
                  <SelectItem value="day">Diária (AAAA-MM-DD)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Métricas diárias rateiam o custo mensal pelos dias do mês para calcular o custo unitário
                por dia.
              </p>
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <div>
              <div className="text-sm font-medium">Limites e alvo</div>
              <p className="text-xs text-muted-foreground">
                Defina valores de referência para o custo unitário. Quando o último período ultrapassar
                o limite superior ou cair abaixo do limite inferior, a métrica é marcada como
                <em> fora do alvo</em> e uma notificação é disparada.
                {format === "percent" && (
                  <> Para métricas percentuais, informe o valor como razão (ex.: 0,18 = 18%).</>
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Limite inferior</Label>
                <Input
                  value={thresholdLower}
                  onChange={(e) => setThresholdLower(e.target.value)}
                  placeholder={format === "percent" ? "0,05" : "10"}
                  inputMode="decimal"
                  data-testid="metric-threshold-lower"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Alvo</Label>
                <Input
                  value={thresholdTarget}
                  onChange={(e) => setThresholdTarget(e.target.value)}
                  placeholder={format === "percent" ? "0,12" : "20"}
                  inputMode="decimal"
                  data-testid="metric-threshold-target"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Limite superior</Label>
                <Input
                  value={thresholdUpper}
                  onChange={(e) => setThresholdUpper(e.target.value)}
                  placeholder={format === "percent" ? "0,18" : "30"}
                  inputMode="decimal"
                  data-testid="metric-threshold-upper"
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <div>
              <div className="text-sm font-medium">Escopo do numerador</div>
              <p className="text-xs text-muted-foreground">
                Por padrão usa o filtro ativo do dashboard. Restrinja ainda mais por provedor, time ou
                produto (separados por vírgula). Deixe em branco para não restringir.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Provedores</Label>
                <Input
                  value={providers}
                  onChange={(e) => setProviders(e.target.value)}
                  placeholder="aws, azure, gcp"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Times</Label>
                <Input
                  value={teams}
                  onChange={(e) => setTeams(e.target.value)}
                  placeholder="data, plataforma"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Produtos</Label>
                <Input
                  value={products}
                  onChange={(e) => setProducts(e.target.value)}
                  placeholder="checkout, billing"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} data-testid="metric-save">
            {editing ? "Salvar alterações" : "Criar métrica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
