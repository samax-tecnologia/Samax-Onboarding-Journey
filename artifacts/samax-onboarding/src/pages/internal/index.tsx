import { useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Activity,
  Clock,
  Target as TargetIcon,
  Lock,
  FileCheck,
  MessageSquare,
  Bot,
  BarChart3,
  Calendar,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  useJourney,
  PhaseStatus,
  type PreActivationFlags,
  type EngagementMilestones,
  type ManualBaselineEntry,
} from "@/lib/journey-store";
import { useListBaselines } from "@workspace/api-client-react";
import { useTenant } from "@/lib/tenant-store";
import { PHASES, MILESTONES, OPPORTUNITIES } from "@/lib/constants";
import { MilestonesPanel } from "@/pages/onboarding/components/MilestonesPanel";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const statusMeta: Record<PhaseStatus, { label: string; className: string; dot: string }> = {
  "not-started": { label: "Não iniciada", className: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground/40" },
  "in-progress": { label: "Em andamento", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dot: "bg-amber-500" },
  "blocked": { label: "Bloqueada", className: "bg-destructive/10 text-destructive border-destructive/30", dot: "bg-destructive" },
  "done": { label: "Concluída", className: "bg-primary/15 text-primary border-primary/30", dot: "bg-primary" },
};

function deriveStatus(phaseId: string, completedTaskIds: string[], explicit?: PhaseStatus): PhaseStatus {
  if (explicit) return explicit;
  const phase = PHASES.find((p) => p.id === phaseId)!;
  const done = phase.tasks.filter((t) => completedTaskIds.includes(t.id)).length;
  if (done === phase.tasks.length) return "done";
  if (done > 0) return "in-progress";
  return "not-started";
}

function relativeTime(iso?: string) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.round(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

// =============================================================================
// Page header (customer selector + audience toggle)
// =============================================================================
function PageHeader() {
  const { state } = useJourney();
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Jornada Samax <span className="text-muted-foreground font-normal">·</span> <span className="text-foreground">{state.customerProfile.company}</span>
        </h1>
        <Badge variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10 gap-1">
          <Eye className="w-3 h-3" /> Visão interna · não exposta ao cliente
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card hover:border-primary/40 transition-colors min-w-[280px]"
          >
            <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
              {state.customerProfile.company.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{state.customerProfile.company}</p>
              <p className="text-xs text-muted-foreground truncate">Sponsor: {state.customerProfile.name}</p>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
          {open && (
            <div className="absolute z-20 top-full mt-1 w-full rounded-md border bg-popover shadow-md">
              <div className="p-2 border-b bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground">Seus clientes</p>
              </div>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50">
                <div className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-semibold">AC</div>
                <span className="text-sm">Acme Cloud</span>
                <Check className="w-3.5 h-3.5 text-primary ml-auto" />
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button disabled className="w-full flex items-center gap-2 px-3 py-2 text-left text-muted-foreground border-t opacity-60 cursor-not-allowed">
                    <Lock className="w-3.5 h-3.5" />
                    <span className="text-sm">+ Adicionar cliente</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Em breve</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        <Link href="/" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          Pré-visualizar como cliente →
        </Link>
      </div>
    </div>
  );
}

// =============================================================================
// PreActivation checklist helpers
// =============================================================================

function ChecklistItem({
  icon,
  checked,
  label,
  disabled = false,
  onCheckedChange,
  children,
}: {
  icon: ReactNode;
  checked: boolean;
  label: string;
  disabled?: boolean;
  onCheckedChange?: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 transition-colors",
        checked ? "bg-primary/5 border-primary/20" : "bg-background border-border"
      )}
    >
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onCheckedChange?.(!!v)}
          className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
        <span
          className={cn(
            "flex items-center gap-1.5 text-sm flex-1",
            checked ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {icon}
          {label}
        </span>
      </label>
      {children && <div className="ml-7 mt-1">{children}</div>}
    </div>
  );
}

function PreActivationChecklist() {
  const { state, actions } = useJourney();
  const { tenantId } = useTenant();
  const flags = state.preActivationFlags;
  const { data: baselines, isLoading: baselinesLoading } = useListBaselines(tenantId);
  const hasBaseline = (baselines?.length ?? 0) > 0;
  const latestBaseline = baselines?.[0];

  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const channelLabel =
    flags.channelType === "slack"
      ? "Slack"
      : flags.channelType === "teams"
        ? "Teams"
        : flags.channelType === "whatsapp"
          ? "WhatsApp"
          : flags.channelType === "other"
            ? "Outro"
            : null;

  return (
    <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3 border-b border-amber-500/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Pré-ativação</CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10 gap-1"
          >
            <Eye className="w-3 h-3" /> Apenas consultor
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {/* 1 — Contrato */}
        <ChecklistItem
          icon={<FileCheck className="w-4 h-4 text-muted-foreground" />}
          checked={flags.contractSigned}
          label="Contrato assinado"
          onCheckedChange={(v) =>
            actions.setPreActivationFlag({
              contractSigned: v,
              contractSignedAt: v ? new Date().toISOString() : null,
            })
          }
        >
          {flags.contractSigned && flags.contractSignedAt && (
            <p className="text-xs text-muted-foreground">
              Assinado em {fmtDate(flags.contractSignedAt)}
            </p>
          )}
        </ChecklistItem>

        {/* 2 — Canal */}
        <ChecklistItem
          icon={<MessageSquare className="w-4 h-4 text-muted-foreground" />}
          checked={flags.channelAccessGranted}
          label="Acesso ao canal de comunicação liberado"
          onCheckedChange={(v) =>
            actions.setPreActivationFlag({
              channelAccessGranted: v,
              channelAccessGrantedAt: v ? new Date().toISOString() : null,
            })
          }
        >
          {flags.channelAccessGranted && (
            <div onClick={(e) => e.stopPropagation()}>
              {channelLabel && flags.channelName ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px]">
                    {channelLabel} · {flags.channelName}
                  </Badge>
                  <button
                    className="text-[10px] text-muted-foreground underline"
                    onClick={() =>
                      actions.setPreActivationFlag({ channelType: null, channelName: null })
                    }
                  >
                    editar
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 mt-1">
                  <Select
                    value={flags.channelType ?? ""}
                    onValueChange={(v) =>
                      actions.setPreActivationFlag({
                        channelType: v as PreActivationFlags["channelType"],
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue placeholder="Plataforma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slack">Slack</SelectItem>
                      <SelectItem value="teams">Teams</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-7 text-xs"
                    placeholder="#finops-acme"
                    value={flags.channelName ?? ""}
                    onChange={(e) =>
                      actions.setPreActivationFlag({ channelName: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
          )}
        </ChecklistItem>

        {/* 3 — BobBot */}
        <ChecklistItem
          icon={<Bot className="w-4 h-4 text-muted-foreground" />}
          checked={flags.bobBotConnected}
          label="BobBot conectado ao canal"
          onCheckedChange={(v) =>
            actions.setPreActivationFlag({
              bobBotConnected: v,
              bobBotConnectedAt: v ? new Date().toISOString() : null,
            })
          }
        >
          {flags.bobBotConnected && (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px]">
                Ativo
              </Badge>
              {flags.bobBotConnectedAt && (
                <span className="text-xs text-muted-foreground">
                  desde {fmtDate(flags.bobBotConnectedAt)}
                </span>
              )}
            </div>
          )}
        </ChecklistItem>

        {/* 4 — Baseline (lê da API, não é togglável) */}
        <ChecklistItem
          icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
          checked={hasBaseline}
          label="Baseline criado"
          disabled
        >
          {baselinesLoading ? (
            <p className="text-xs text-muted-foreground">Verificando…</p>
          ) : hasBaseline ? (
            <p className="text-xs text-muted-foreground">{latestBaseline?.label}</p>
          ) : (
            <a
              href="/dashboard/relatorios"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline"
            >
              → Criar baseline no dashboard
            </a>
          )}
        </ChecklistItem>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Health summary
// =============================================================================
function HealthSummary() {
  const { state, selectors } = useJourney();
  const { completedPhases, totalPhases, currentPhase, lastActivity, daysSinceKickoff } = selectors.getJourneyHealth();
  const target = selectors.getMetaMinima();
  const total = selectors.getCapturedTotal();
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const currentPhaseObj = PHASES.find((p) => p.id === currentPhase);

  const items = [
    { label: "Fases concluídas", value: `${completedPhases}/${totalPhases}`, icon: CheckCircle2 },
    { label: "Fase atual", value: currentPhaseObj ? `${currentPhaseObj.id} · ${currentPhaseObj.title.split(":")[0]}` : "—", icon: Activity },
    { label: "Dias desde kickoff", value: daysSinceKickoff > 0 ? `${daysSinceKickoff} dias` : "—", icon: Clock },
    { label: "Última atividade", value: relativeTime(lastActivity), icon: Activity },
  ];

  return (
    <Card className="mb-6 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-background">
      <CardContent className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
          {items.map((it) => (
            <div key={it.label}>
              <div className="flex items-center gap-1.5 mb-1">
                <it.icon className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{it.label}</p>
              </div>
              <p className="text-base font-semibold text-foreground">{it.value}</p>
            </div>
          ))}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <TargetIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Capturado vs meta</p>
            </div>
            <p className="text-base font-semibold text-foreground">{formatBRL(total)} <span className="text-xs text-muted-foreground font-normal">/ {formatBRL(target)}</span></p>
            <Progress value={pct} className="h-1 mt-1.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Goal calculator (bound to store)
// =============================================================================
function ConfiguracaoEngajamento() {
  const { state, actions, selectors } = useJourney();
  const { customerProfile: p, engagementMilestones: m, manualBaseline: mb } = state;
  const target = selectors.getMetaMinima();
  const totalBaseline = mb.entries.reduce((acc, e) => acc + e.monthlyValue, 0);

  return (
    <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3 border-b border-amber-500/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Configuração do Engajamento</CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10 gap-1"
          >
            <Eye className="w-3 h-3" /> Apenas consultor
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs defaultValue="milestones">
          <TabsList className="mb-4">
            <TabsTrigger value="milestones" className="gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Datas Marco
            </TabsTrigger>
            <TabsTrigger value="profile">Perfil do Cliente</TabsTrigger>
            <TabsTrigger value="baseline">Baseline Manual</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Datas Marco ─────────────────────────────────────── */}
          <TabsContent value="milestones">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Diagnóstico realizado</Label>
                <Input
                  type="date"
                  value={m.diagnostico}
                  onChange={(e) => actions.setEngagementMilestones({ diagnostico: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assinatura do contrato</Label>
                <Input
                  type="date"
                  value={m.assinatura}
                  onChange={(e) => actions.setEngagementMilestones({ assinatura: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Kick-off</Label>
                <Input
                  type="date"
                  value={m.kickoff}
                  onChange={(e) => {
                    actions.setEngagementMilestones({ kickoff: e.target.value });
                    actions.updateCustomerProfile({ kickoffDate: e.target.value });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Definição do baseline</Label>
                <Input
                  type="date"
                  value={m.baselineDefinition}
                  onChange={(e) => actions.setEngagementMilestones({ baselineDefinition: e.target.value })}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Essas datas aparecem na tela do cliente em "Você chegou até aqui".
            </p>
          </TabsContent>

          {/* ── Tab 2: Perfil do Cliente ───────────────────────────────── */}
          <TabsContent value="profile">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Cliente
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do contato</Label>
                    <Input
                      value={p.name}
                      placeholder="Ex: Luana"
                      onChange={(e) => actions.updateCustomerProfile({ name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Empresa</Label>
                    <Input
                      value={p.company}
                      placeholder="Ex: Acme Cloud"
                      onChange={(e) => actions.updateCustomerProfile({ company: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Contrato e Meta
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contrato anual (R$)</Label>
                    <Input
                      type="number"
                      value={p.contractAnnual}
                      onChange={(e) =>
                        actions.updateCustomerProfile({ contractAnnual: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Spend anual (R$)</Label>
                    <Input
                      type="number"
                      value={p.spendAnnual}
                      onChange={(e) =>
                        actions.updateCustomerProfile({ spendAnnual: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <div className="mt-3 p-3 bg-muted/40 rounded-md border text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">10% do spend:</span>
                    <span className="tabular-nums">{formatBRL(p.spendAnnual * 0.1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">2× contrato:</span>
                    <span className="tabular-nums">{formatBRL(p.contractAnnual * 2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-primary border-t pt-1 mt-1">
                    <span>Meta mínima:</span>
                    <span className="tabular-nums">{formatBRL(target)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Consultor
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={p.consultant.name}
                      onChange={(e) =>
                        actions.updateCustomerProfile({
                          consultant: { ...p.consultant, name: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cargo</Label>
                    <Input
                      value={p.consultant.role}
                      onChange={(e) =>
                        actions.updateCustomerProfile({
                          consultant: { ...p.consultant, role: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Próxima reunião</Label>
                    <Input
                      type="datetime-local"
                      value={p.consultant.nextMeeting}
                      onChange={(e) =>
                        actions.updateCustomerProfile({
                          consultant: { ...p.consultant, nextMeeting: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Ambiente
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Conectado desde</Label>
                    <Input
                      type="date"
                      value={p.environment.connectedSince}
                      onChange={(e) =>
                        actions.updateCustomerProfile({
                          environment: { ...p.environment, connectedSince: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Recursos monitorados</Label>
                    <Input
                      type="number"
                      value={p.environment.resourcesMonitored}
                      onChange={(e) =>
                        actions.updateCustomerProfile({
                          environment: {
                            ...p.environment,
                            resourcesMonitored: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Spend mensal (R$)</Label>
                    <Input
                      type="number"
                      value={p.environment.monthlySpend}
                      onChange={(e) =>
                        actions.updateCustomerProfile({
                          environment: {
                            ...p.environment,
                            monthlySpend: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Provedores (separados por vírgula)</Label>
                    <Input
                      value={p.environment.providers.join(", ")}
                      placeholder="AWS, Azure, GCP"
                      onChange={(e) =>
                        actions.updateCustomerProfile({
                          environment: {
                            ...p.environment,
                            providers: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 3: Baseline Manual ─────────────────────────────────── */}
          <TabsContent value="baseline">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Período analisado
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Início</Label>
                    <Input
                      type="date"
                      value={mb.periodStart}
                      onChange={(e) => actions.setManualBaselinePeriod({ periodStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fim</Label>
                    <Input
                      type="date"
                      value={mb.periodEnd}
                      onChange={(e) => actions.setManualBaselinePeriod({ periodEnd: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Serviços / Categorias
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() =>
                      actions.addManualBaselineEntry({ provider: "", service: "", monthlyValue: 0 })
                    }
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar linha
                  </Button>
                </div>

                {mb.entries.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhum serviço cadastrado. Clique em "Adicionar linha" para começar.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_130px_36px] gap-2 px-1">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Provedor
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Serviço / Categoria
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground text-right pr-1">
                        Valor/mês (R$)
                      </span>
                      <span />
                    </div>
                    {mb.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="grid grid-cols-[1fr_1fr_130px_36px] gap-2 items-center"
                      >
                        <Input
                          className="h-8 text-sm"
                          placeholder="AWS"
                          value={entry.provider}
                          onChange={(e) =>
                            actions.updateManualBaselineEntry({ ...entry, provider: e.target.value })
                          }
                        />
                        <Input
                          className="h-8 text-sm"
                          placeholder="EC2 / Compute"
                          value={entry.service}
                          onChange={(e) =>
                            actions.updateManualBaselineEntry({ ...entry, service: e.target.value })
                          }
                        />
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs text-muted-foreground pointer-events-none">
                            R$
                          </span>
                          <Input
                            className="h-8 text-sm pl-8"
                            type="number"
                            placeholder="0"
                            value={entry.monthlyValue || ""}
                            onChange={(e) =>
                              actions.updateManualBaselineEntry({
                                ...entry,
                                monthlyValue: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => actions.removeManualBaselineEntry(entry.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {mb.entries.length > 0 && (
                <div className="rounded-md bg-primary/5 border border-primary/20 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total do baseline manual</p>
                    {mb.periodStart && mb.periodEnd && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {mb.periodStart} → {mb.periodEnd}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">{formatBRL(totalBaseline)}/mês</p>
                    <p className="text-xs text-muted-foreground">{formatBRL(totalBaseline * 12)}/ano</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Phase card with consultant fields
// =============================================================================
function PhaseCard({
  phase,
  expanded,
  onToggle,
}: {
  phase: typeof PHASES[number];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { state, actions } = useJourney();

  const completedTasks = phase.tasks.filter((t) => state.completedTaskIds.includes(t.id)).length;
  const totalTasks = phase.tasks.length;
  const status = deriveStatus(phase.id, state.completedTaskIds, state.phaseStatuses[phase.id]);
  const sm = statusMeta[status];

  // Map tasks to whether they're linked to an approved opportunity
  const approvedOppTaskIds = useMemo(() => {
    const ids = new Set<string>();
    OPPORTUNITIES.forEach((opp) => {
      if (state.opportunityDecisions[opp.id] === "approved") {
        // Phase 7 + 8 task ownership of opportunity execution
        ["7.5", "8.1", "8.3"].forEach((id) => ids.add(id));
      }
    });
    return ids;
  }, [state.opportunityDecisions]);

  return (
    <div className="relative pl-8">
      <div
        className={cn(
          "absolute -left-[11px] top-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors z-10",
          status === "done"
            ? "bg-primary border-primary text-primary-foreground"
            : status === "blocked"
              ? "bg-destructive border-destructive text-destructive-foreground"
              : status === "in-progress"
                ? "bg-amber-500 border-amber-500 text-white"
                : "bg-background border-muted-foreground"
        )}
      >
        {status === "done" && <Check className="w-3 h-3" strokeWidth={3} />}
        {status === "blocked" && <AlertTriangle className="w-3 h-3" />}
      </div>

      <Card className={cn("cursor-pointer transition-shadow hover:border-primary/50", expanded && "border-primary/40 shadow-sm")} onClick={onToggle}>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-semibold text-muted-foreground tabular-nums">Fase {phase.id}</span>
                <h3 className="font-semibold text-foreground text-base">{phase.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Objetivo:</span> {phase.objective}
              </p>
              <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className={cn("text-[11px] gap-1.5", sm.className)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", sm.dot)} /> {sm.label}
                </Badge>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {completedTasks}/{totalTasks} tarefas
                </span>
                {state.phaseUpdatedAt[phase.id] && (
                  <span className="text-xs text-muted-foreground">
                    Atualizado {relativeTime(state.phaseUpdatedAt[phase.id])} por Rafael Mendes
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform shrink-0", expanded && "rotate-180")} />
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-5 pt-5 border-t bg-muted/15 -mx-5 -mb-5 px-5 pb-5 rounded-b-lg">
                  <p className="text-sm mb-3">
                    <span className="font-medium">Resultado esperado:</span> {phase.outcome}
                  </p>

                  <div className="space-y-2 mb-5">
                    {phase.tasks.map((task) => {
                      const isChecked = state.completedTaskIds.includes(task.id);
                      const isApprovedOpp = approvedOppTaskIds.has(task.id);
                      return (
                        <label
                          key={task.id}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-md border transition-colors cursor-pointer",
                            isChecked ? "bg-primary/5 border-primary/20" : "bg-background border-border hover:border-border/80"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => actions.toggleTask(task.id)}
                            className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <span className={cn("flex-1 text-sm leading-relaxed", isChecked ? "text-muted-foreground line-through" : "text-foreground")}>
                            {task.title}
                          </span>
                          {isApprovedOpp && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] shrink-0">
                              Aprovado pelo cliente
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>

                  {phase.milestone && (
                    <div className="mb-5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground uppercase tracking-wider font-semibold">Entrega marco de valor</span>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Marco {phase.milestone}</Badge>
                    </div>
                  )}

                  {/* Consultant-only fields */}
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10 gap-1">
                        <Eye className="w-3 h-3" /> Apenas consultor
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-1">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Select
                          value={status}
                          onValueChange={(v) => actions.setPhaseStatus(phase.id, v as PhaseStatus, true)}
                        >
                          <SelectTrigger className="h-8 mt-1 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not-started">Não iniciada</SelectItem>
                            <SelectItem value="in-progress">Em andamento</SelectItem>
                            <SelectItem value="blocked">Bloqueada</SelectItem>
                            <SelectItem value="done">Concluída</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground">Notas internas</Label>
                        <Textarea
                          value={state.phaseNotes[phase.id] ?? ""}
                          onChange={(e) => actions.setPhaseNote(phase.id, e.target.value)}
                          placeholder="Anote contexto, alinhamentos e próximos passos"
                          className="mt-1 text-sm min-h-[60px]"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bloqueios e riscos</Label>
                      <Textarea
                        value={state.phaseBlockers[phase.id] ?? ""}
                        onChange={(e) => actions.setPhaseBlocker(phase.id, e.target.value)}
                        onBlur={(e) => actions.setPhaseBlocker(phase.id, e.target.value, true)}
                        placeholder="Algo travando o avanço dessa fase?"
                        className="mt-1 text-sm min-h-[50px]"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}

function ConsultantPhaseTimeline() {
  const [expanded, setExpanded] = useState<string | null>("3");
  return (
    <div className="relative border-l-2 border-muted ml-4 space-y-6 pb-8">
      {PHASES.map((phase) => (
        <PhaseCard
          key={phase.id}
          phase={phase}
          expanded={expanded === phase.id}
          onToggle={() => setExpanded(expanded === phase.id ? null : phase.id)}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Blockers panel
// =============================================================================
function HealthAndBlockers() {
  const { state } = useJourney();

  const blockedPhases = PHASES.filter((p) => {
    const status = deriveStatus(p.id, state.completedTaskIds, state.phaseStatuses[p.id]);
    return status === "blocked" || (state.phaseBlockers[p.id]?.trim().length ?? 0) > 0;
  });

  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          Saúde da jornada
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {blockedPhases.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span>Nenhum bloqueio registrado</span>
          </div>
        ) : (
          blockedPhases.map((p) => (
            <div key={p.id} className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-foreground">Fase {p.id}</p>
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">Bloqueada</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {state.phaseBlockers[p.id] || "Marcada como bloqueada — sem detalhes registrados."}
              </p>
            </div>
          ))
        )}

        <Separator />

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Tempo por fase</p>
          <div className="space-y-1.5">
            {PHASES.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">Fase {p.id}</span>
                <span className="text-foreground tabular-nums shrink-0 ml-2">
                  {state.phaseUpdatedAt[p.id] ? relativeTime(state.phaseUpdatedAt[p.id]) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Page
// =============================================================================
export default function InternalPage() {
  const { state } = useJourney();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader />
      <PreActivationChecklist />
      <HealthSummary />
      <ConfiguracaoEngajamento />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <ConsultantPhaseTimeline />
        </div>
        <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-6">
          <MilestonesPanel completedTaskIds={state.completedTaskIds} />
          <HealthAndBlockers />
        </div>
      </div>
    </div>
  );
}
