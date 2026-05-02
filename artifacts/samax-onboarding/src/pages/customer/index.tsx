import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CalendarDays,
  Search,
  FileCheck,
  Target,
  Plug,
  Database,
  Server,
  Cloud,
  CircleDot,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useJourney } from "@/lib/journey-store";
import {
  CUSTOMER_STAGES,
  OPPORTUNITIES,
  PRE_CONTRACT_MILESTONES,
  PHASES,
} from "@/lib/constants";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const ownershipMeta: Record<string, { label: string; className: string }> = {
  voce: { label: "Sua ação", className: "bg-primary/15 text-primary border-primary/30" },
  samax: { label: "Samax fazendo", className: "bg-secondary text-secondary-foreground border-border" },
  ambos: { label: "Em conjunto", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  done: { label: "Concluído", className: "bg-muted text-muted-foreground border-border" },
};

function OwnershipBadge({ ownership }: { ownership: string }) {
  const m = ownershipMeta[ownership] ?? ownershipMeta.voce;
  return (
    <Badge variant="outline" className={cn("text-[11px] font-medium px-2 py-0.5", m.className)}>
      {m.label}
    </Badge>
  );
}

function daysSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateTimeBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================================================================
// Welcome Row
// =============================================================================
function WelcomeRow({ name }: { name: string }) {
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Olá, {name}</h1>
        <p className="text-muted-foreground mt-1.5 text-base">
          Sua jornada até o primeiro real comprovado de economia.
        </p>
      </div>
      <div className="text-sm text-muted-foreground capitalize hidden md:block">{today}</div>
    </div>
  );
}

// =============================================================================
// Next Action Hero
// =============================================================================
function NextActionHero() {
  const { state, actions } = useJourney();
  const [open, setOpen] = useState(false);

  const next = useMemo(() => {
    // Compute next concrete customer step
    for (const stage of CUSTOMER_STAGES) {
      for (const step of stage.customerSteps) {
        if (step.ownership === "samax") continue;
        const isDone = step.linkedTaskIds.every((t) => state.completedTaskIds.includes(t));
        if (!isDone) {
          return { stage, step };
        }
      }
    }
    return null;
  }, [state.completedTaskIds]);

  if (!next) {
    return (
      <Card className="mb-8 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-primary font-semibold">Tudo em dia</p>
              <h2 className="text-xl font-semibold mt-1">Nenhuma ação pendente do seu lado agora</h2>
              <p className="text-sm text-muted-foreground mt-1">
                A Samax está executando as próximas etapas. Vamos te avisar quando precisar de você.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleConfirm = () => {
    next.step.linkedTaskIds.forEach((id) => {
      if (!state.completedTaskIds.includes(id)) actions.toggleTask(id);
    });
    setOpen(false);
  };

  return (
    <Card className="mb-8 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-sm">
      <CardContent className="p-6 md:p-7">
        <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">
              Próxima ação sua · Etapa {next.stage.number} · {next.stage.title}
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-tight">
              {next.step.label}
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              Quando você concluir, a Samax avança automaticamente para os próximos passos desta etapa.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shrink-0 gap-2">
                Avançar agora <ArrowRight className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{next.step.label}</DialogTitle>
                <DialogDescription>
                  Confirme a conclusão para registrarmos no seu progresso e seguirmos com as próximas ações da etapa "{next.stage.title}".
                </DialogDescription>
              </DialogHeader>
              <div className="bg-muted/50 rounded-md p-4 text-sm">
                <p className="font-medium mb-1">O que acontece em seguida</p>
                <p className="text-muted-foreground">
                  A Samax marca esta ação como concluída no seu painel e no painel do seu consultor. Você recebe um e-mail de
                  confirmação com o resumo do progresso.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleConfirm} className="gap-2">
                  <Check className="w-4 h-4" /> Marcar como concluída
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Pre-contract Recap
// =============================================================================
function PreContractRecap() {
  return (
    <div className="mb-8">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
        Você chegou até aqui
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PRE_CONTRACT_MILESTONES.map((m) => {
          const Icon = m.icon === "search" ? Search : m.icon === "file-check" ? FileCheck : Target;
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3 rounded-md border bg-card"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.label}</p>
                <p className="text-xs text-muted-foreground">{formatDateBR(m.date)}</p>
              </div>
              <Check className="w-4 h-4 text-primary shrink-0 ml-auto" strokeWidth={3} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Environment Signals
// =============================================================================
function EnvironmentSignals() {
  const { state } = useJourney();
  const env = state.customerProfile.environment;
  const days = daysSince(env.connectedSince);

  const items = [
    { icon: Plug, label: "Conectado há", value: `${days} ${days === 1 ? "dia" : "dias"}` },
    { icon: Database, label: "Recursos monitorados", value: env.resourcesMonitored.toLocaleString("pt-BR") },
    { icon: Server, label: "Spend monitorado", value: `${formatBRL(env.monthlySpend)}/mês` },
    { icon: Cloud, label: "Provedores", value: env.providers.join(", ") },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center gap-3 p-3 rounded-md border bg-card">
          <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
            <it.icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{it.label}</p>
            <p className="text-sm font-semibold text-foreground truncate">{it.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Goal Tracker
// =============================================================================
function GoalTracker() {
  const { state, selectors } = useJourney();
  const target = selectors.getMetaMinima();
  const total = selectors.getCapturedTotal();
  const pct = Math.min(100, target > 0 ? Math.round((total / target) * 100) : 0);

  const segments: Array<{ key: keyof typeof state.capturedValue; label: string; color: string }> = [
    { key: "realizada", label: "Realizada", color: "bg-primary" },
    { key: "aprovada", label: "Aprovada", color: "bg-primary/70" },
    { key: "evitada", label: "Evitada", color: "bg-primary/45" },
    { key: "governanca", label: "Governança", color: "bg-primary/25" },
  ];

  return (
    <Card className="mb-8 border-border shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Sua meta de 1º valor
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">{formatBRL(target)} / ano</h2>
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                  <HelpCircle className="w-3 h-3" /> Como sua meta é calculada?
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-sm">
                <p className="font-medium mb-2">Cálculo da meta mínima</p>
                <p className="text-muted-foreground leading-relaxed">
                  A meta é o <strong>menor valor</strong> entre 10% do seu spend anual de cloud e 2x o contrato anual com a Samax.
                  Isso garante uma prova econômica relevante e proporcional ao seu investimento.
                </p>
                <div className="mt-3 pt-3 border-t text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">10% do spend anual:</span><span>{formatBRL(state.customerProfile.spendAnnual * 0.1)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">2x contrato anual:</span><span>{formatBRL(state.customerProfile.contractAnnual * 2)}</span></div>
                  <div className="flex justify-between font-semibold text-foreground pt-1 border-t"><span>Meta mínima:</span><span>{formatBRL(target)}</span></div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Capturado</p>
            <p className="text-2xl font-semibold text-primary">{formatBRL(total)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{pct}% da meta</p>
          </div>
        </div>

        <Progress value={pct} className="h-3 mb-5" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {segments.map((s) => (
            <div key={s.key} className="rounded-md border p-3">
              <div className="flex items-center gap-2">
                <span className={cn("w-2.5 h-2.5 rounded-full", s.color)} />
                <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
              </div>
              <p className="text-base font-semibold text-foreground mt-1.5">{formatBRL(state.capturedValue[s.key])}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Stages Journey
// =============================================================================
function StageCard({
  stage,
  index,
  expanded,
  onToggle,
}: {
  stage: typeof CUSTOMER_STAGES[number];
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { state, actions } = useJourney();

  const isStepDone = (step: typeof stage.customerSteps[number]) =>
    step.linkedTaskIds.length > 0 && step.linkedTaskIds.every((id) => state.completedTaskIds.includes(id));

  const completedSteps = stage.customerSteps.filter(isStepDone).length;
  const totalSteps = stage.customerSteps.length;
  const stageDone = completedSteps === totalSteps;
  const stagePct = Math.round((completedSteps / totalSteps) * 100);

  const toggleStep = (step: typeof stage.customerSteps[number]) => {
    const done = isStepDone(step);
    if (done) {
      // Untoggle: uncheck all linked tasks currently completed
      step.linkedTaskIds.forEach((id) => {
        if (state.completedTaskIds.includes(id)) actions.toggleTask(id);
      });
    } else {
      // Mark all linked tasks complete
      step.linkedTaskIds.forEach((id) => {
        if (!state.completedTaskIds.includes(id)) actions.toggleTask(id);
      });
    }
  };

  return (
    <div className="relative pl-10">
      <div
        className={cn(
          "absolute left-0 top-5 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold transition-colors z-10",
          stageDone
            ? "bg-primary border-primary text-primary-foreground"
            : completedSteps > 0
              ? "bg-background border-primary text-primary"
              : "bg-background border-muted-foreground text-muted-foreground"
        )}
      >
        {stageDone ? <Check className="w-4 h-4" strokeWidth={3} /> : stage.number}
      </div>

      <Card
        className={cn(
          "cursor-pointer transition-shadow hover:border-primary/50",
          expanded && "border-primary/40 shadow-sm"
        )}
        onClick={onToggle}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <h3 className="font-semibold text-foreground text-base">{stage.title}</h3>
                <OwnershipBadge ownership={stageDone ? "done" : stage.ownership} />
              </div>
              <p className="text-sm text-muted-foreground">{stage.summary}</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 max-w-xs">
                  <Progress value={stagePct} className="h-1.5" />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {completedSteps}/{totalSteps}
                </span>
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
                <div className="mt-5 pt-5 border-t space-y-2.5">
                  {stage.customerSteps.map((step) => {
                    const done = isStepDone(step);
                    const isCustomerOwned = step.ownership === "voce" || step.ownership === "ambos";
                    return (
                      <label
                        key={step.id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-md border transition-colors",
                          done ? "bg-primary/5 border-primary/20" : "bg-background border-border",
                          isCustomerOwned ? "cursor-pointer hover:border-border/80" : "cursor-default"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={done}
                          disabled={!isCustomerOwned}
                          onCheckedChange={() => isCustomerOwned && toggleStep(step)}
                          className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <span className={cn("text-sm leading-relaxed", done ? "text-muted-foreground line-through" : "text-foreground")}>
                              {step.label}
                            </span>
                            <OwnershipBadge ownership={step.ownership} />
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}

function StagesJourney() {
  const [expanded, setExpanded] = useState<string | null>(CUSTOMER_STAGES[0].id);
  return (
    <div className="mb-8">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Sua jornada em 4 etapas</h2>
          <p className="text-sm text-muted-foreground mt-1">Cada etapa mostra claramente quem faz o quê e o que vem a seguir.</p>
        </div>
      </div>
      <div className="relative space-y-5">
        <div className="absolute left-3.5 top-7 bottom-7 w-0.5 bg-border" />
        {CUSTOMER_STAGES.map((stage, idx) => (
          <StageCard
            key={stage.id}
            stage={stage}
            index={idx}
            expanded={expanded === stage.id}
            onToggle={() => setExpanded(expanded === stage.id ? null : stage.id)}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Opportunities Table
// =============================================================================
function OpportunitiesTable() {
  const { state, actions } = useJourney();

  const decisionMeta: Record<string, { label: string; className: string; icon: LucideIcon }> = {
    approved: { label: "Aprovada", className: "bg-primary/15 text-primary border-primary/30", icon: CheckCircle2 },
    rejected: { label: "Rejeitada", className: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
    deferred: { label: "Adiada", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", icon: Clock },
    pending: { label: "Pendente", className: "bg-muted text-muted-foreground border-border", icon: CircleDot },
  };

  return (
    <Card className="mb-8">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg">Suas oportunidades de quick win</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Aprove para que a Samax registre o impacto na sua meta. Você decide o ritmo.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Potencial total</p>
            <p className="text-lg font-semibold text-primary">
              {formatBRL(OPPORTUNITIES.reduce((sum, o) => sum + o.annual, 0))}/ano
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4 font-semibold">Oportunidade</th>
                <th className="py-3 px-3 font-semibold">Categoria</th>
                <th className="py-3 px-3 font-semibold text-right">Mensal</th>
                <th className="py-3 px-3 font-semibold text-right">Anualizada</th>
                <th className="py-3 px-3 font-semibold">Risco</th>
                <th className="py-3 px-4 font-semibold text-right">Decisão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {OPPORTUNITIES.map((opp) => {
                const decision = state.opportunityDecisions[opp.id] ?? "pending";
                const m = decisionMeta[decision];
                return (
                  <tr key={opp.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-medium text-foreground">{opp.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opp.action}</p>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="outline" className="text-[11px]">{opp.category}</Badge>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">{formatBRL(opp.monthly)}</td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-primary">{formatBRL(opp.annual)}</td>
                    <td className="py-3 px-3">
                      <span className={cn(
                        "text-xs font-medium",
                        opp.risk === "Baixo" && "text-primary",
                        opp.risk === "Médio" && "text-amber-600 dark:text-amber-400",
                        opp.risk === "Alto" && "text-destructive"
                      )}>{opp.risk}</span>
                    </td>
                    <td className="py-3 px-4">
                      {decision === "pending" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" className="h-7 text-xs px-2.5" onClick={() => actions.setOppDecision(opp.id, "approved")}>
                            Aprovar
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => actions.setOppDecision(opp.id, "deferred")}>
                            Adiar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2.5 text-muted-foreground" onClick={() => actions.setOppDecision(opp.id, "rejected")}>
                            Rejeitar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant="outline" className={cn("text-[11px] gap-1", m.className)}>
                            <m.icon className="w-3 h-3" /> {m.label}
                          </Badge>
                          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-muted-foreground" onClick={() => actions.setOppDecision(opp.id, "pending")}>
                            Reverter
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Consultant Panel
// =============================================================================
function ConsultantPanel() {
  const { state } = useJourney();
  const c = state.customerProfile.consultant;
  const [open, setOpen] = useState(false);

  return (
    <Card className="mb-8">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="w-14 h-14 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/15 text-primary font-semibold">{c.photoInitials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Seu time Samax
            </p>
            <p className="text-base font-semibold text-foreground">{c.name}</p>
            <p className="text-sm text-muted-foreground">{c.role}</p>
            <div className="flex items-center gap-2 mt-2 text-sm">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Próxima reunião:</span>
              <span className="font-medium text-foreground">{formatDateTimeBR(c.nextMeeting)}</span>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="shrink-0">Falar com seu consultor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Falar com {c.name}</DialogTitle>
                <DialogDescription>Escolha a forma de contato que prefere.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {[
                  { label: "Agendar reunião de 30 min", desc: "Próximas janelas: hoje às 16h, amanhã às 10h" },
                  { label: "Tirar dúvida rápida por chat", desc: "Resposta típica em até 2 horas úteis" },
                  { label: "Enviar e-mail", desc: `${c.name.toLowerCase().replace(" ", ".")}@samax.io` },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    className="w-full text-left p-3 rounded-md border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Methodology Reveal
// =============================================================================
function MethodologyReveal() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full p-5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Quer entender melhor?
              </p>
              <p className="text-base font-medium text-foreground">
                A ciência por trás da sua jornada de 1º valor
              </p>
            </div>
            <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-5 pt-2 border-t bg-muted/20">
            <p className="text-sm text-muted-foreground mb-4">
              Cada uma das 4 etapas é construída sobre passos detalhados que garantem que o valor entregue seja
              mensurável, defensável e reconhecido pelo seu time técnico e financeiro.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PHASES.map((p) => (
                <div key={p.id} className="flex items-start gap-3 p-3 rounded-md border bg-card">
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums shrink-0 mt-0.5">
                    {p.id}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.objective}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// =============================================================================
// Page
// =============================================================================
export default function CustomerPage() {
  const { state } = useJourney();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <WelcomeRow name={state.customerProfile.name} />
      <NextActionHero />
      <PreContractRecap />
      <EnvironmentSignals />
      <GoalTracker />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <StagesJourney />
        </div>
        <div className="lg:col-span-1 lg:sticky lg:top-6">
          <ConsultantPanel />
        </div>
      </div>

      <OpportunitiesTable />
      <MethodologyReveal />
    </div>
  );
}
