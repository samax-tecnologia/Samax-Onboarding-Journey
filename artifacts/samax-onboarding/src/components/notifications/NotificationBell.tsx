import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Bell, Check, ShieldAlert, CheckCircle2, Sparkles, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useJourney, type NotificationKind } from "@/lib/journey-store";

const kindMeta: Record<NotificationKind, { label: string; icon: typeof Bell; tone: string }> = {
  "phase-status": { label: "Andamento", icon: Activity, tone: "text-amber-600" },
  "phase-blocker": { label: "Atenção", icon: ShieldAlert, tone: "text-destructive" },
  "phase-note": { label: "Nota", icon: Activity, tone: "text-muted-foreground" },
  milestone: { label: "Marco", icon: CheckCircle2, tone: "text-primary" },
  "next-action": { label: "Sua ação", icon: Sparkles, tone: "text-primary" },
  opportunity: { label: "Oportunidade", icon: Sparkles, tone: "text-primary" },
};

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.round(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export function NotificationBell() {
  const { state, actions, selectors } = useJourney();
  const [open, setOpen] = useState(false);
  const unread = selectors.getUnreadCount();

  const items = useMemo(
    () => [...state.notifications].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [state.notifications]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label={unread > 0 ? `${unread} novidades não lidas` : "Sem novidades"}
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center px-1 leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div>
            <p className="text-sm font-semibold">Novidades da sua jornada</p>
            <p className="text-xs text-muted-foreground">{unread > 0 ? `${unread} não ${unread === 1 ? "lida" : "lidas"}` : "Tudo em dia"}</p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={actions.markAllNotificationsRead}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="w-6 h-6 mx-auto mb-2 opacity-40" />
              Você será avisado aqui quando o time Samax atualizar a sua jornada.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const meta = kindMeta[n.kind];
                const Icon = meta.icon;
                const content = (
                  <div className={cn("p-3 flex gap-3 items-start hover:bg-muted/40 transition-colors cursor-pointer", !n.read && "bg-primary/5")}>
                    <div className={cn("w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0", meta.tone)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn("text-sm leading-snug", !n.read ? "font-semibold text-foreground" : "text-foreground")}>
                          {n.title}
                        </p>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{meta.label}</Badge>
                        <span className="text-[11px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
                const handleClick = () => {
                  if (!n.read) actions.markNotificationRead(n.id);
                  setOpen(false);
                };
                return (
                  <li key={n.id} onClick={handleClick}>
                    {n.link ? <Link href={n.link}>{content}</Link> : content}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="p-2 border-t bg-muted/20 flex items-center justify-center">
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Check className="w-3 h-3" /> Sincronizado entre suas abas
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
