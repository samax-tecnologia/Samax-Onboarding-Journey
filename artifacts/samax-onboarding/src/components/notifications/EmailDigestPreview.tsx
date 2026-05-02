import { useState } from "react";
import { Mail, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJourney } from "@/lib/journey-store";
import { CUSTOMER_STAGES, OPPORTUNITIES } from "@/lib/constants";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export function EmailDigestPreview() {
  const { state, selectors } = useJourney();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [cadence, setCadence] = useState<"daily" | "weekly">("weekly");

  const target = selectors.getMetaMinima();
  const total = selectors.getCapturedTotal();
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;

  const completedSteps = CUSTOMER_STAGES.flatMap((s) => s.customerSteps).filter((step) =>
    step.linkedTaskIds.every((id) => state.completedTaskIds.includes(id))
  ).length;
  const totalSteps = CUSTOMER_STAGES.flatMap((s) => s.customerSteps).length;
  const approvedOpps = OPPORTUNITIES.filter((o) => state.opportunityDecisions[o.id] === "approved").length;
  const recent = state.notifications.slice(0, 4);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Mail className="w-4 h-4" /> Resumo por e-mail
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resumo da sua jornada por e-mail</DialogTitle>
          <DialogDescription>
            Receba um e-mail com tudo o que aconteceu na sua jornada e o que precisa da sua atenção.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label className="text-sm">Quero receber resumo por e-mail</Label>
          </div>
          <Select value={cadence} onValueChange={(v) => setCadence(v as "daily" | "weekly")} disabled={!enabled}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Diário</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border bg-background overflow-hidden">
          <div className="bg-muted/40 border-b px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">De: time@samax.io</span>
            <Badge variant="outline" className="text-[10px]">Pré-visualização</Badge>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-xs text-muted-foreground">Para: luana@acmecloud.com.br</p>
            <p className="text-base font-semibold">Olá, {state.customerProfile.name} — sua jornada Samax desta semana</p>

            <div className="grid grid-cols-3 gap-3 py-3 border-y">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground font-semibold">Capturado</p>
                <p className="text-base font-semibold text-primary">{formatBRL(total)}</p>
                <p className="text-[11px] text-muted-foreground">{pct}% da meta</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground font-semibold">Etapas concluídas</p>
                <p className="text-base font-semibold">{completedSteps}/{totalSteps}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground font-semibold">Quick wins aprovadas</p>
                <p className="text-base font-semibold">{approvedOpps}</p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Novidades desde o último resumo
              </p>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atualização registrada ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((n) => (
                    <li key={n.id} className="text-sm">
                      <p className="font-medium leading-tight">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pt-2 border-t text-xs text-muted-foreground">
              Você está recebendo porque é sponsor da jornada Acme Cloud na Samax.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          <Button onClick={() => setOpen(false)}>Salvar preferência</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
