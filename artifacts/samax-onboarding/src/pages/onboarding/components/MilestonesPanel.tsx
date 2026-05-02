import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MILESTONES, PHASES } from "@/lib/constants";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface MilestonesPanelProps {
  completedTaskIds: string[];
}

export function MilestonesPanel({ completedTaskIds }: MilestonesPanelProps) {
  
  const isPhaseComplete = (phaseId: string) => {
    const phase = PHASES.find(p => p.id === phaseId);
    if (!phase) return false;
    return phase.tasks.every(t => completedTaskIds.includes(t.id));
  };

  const checkMilestoneReached = (milestoneId: number) => {
    // Logic as per requirement:
    // Marco 1 = after Fase 1.2
    if (milestoneId === 1) return isPhaseComplete("1.2");
    // Marco 2 = after Fase 4
    if (milestoneId === 2) return isPhaseComplete("4");
    // Marco 3 = after Fase 6
    if (milestoneId === 3) return isPhaseComplete("6");
    // Marco 4 = after Fase 8 starts (we consider it reached if at least 1 task of phase 8 is checked, or if phase 7 is fully complete)
    if (milestoneId === 4) return isPhaseComplete("7");
    // Marco 5 = after Fase 8 completes
    if (milestoneId === 5) return isPhaseComplete("8");
    return false;
  };

  return (
    <div className="space-y-6 sticky top-6">
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-lg">Marcos de percepção do valor</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {MILESTONES.map((milestone) => {
            const reached = checkMilestoneReached(milestone.id);
            return (
              <div key={milestone.id} className="flex gap-4">
                <div className="relative mt-1">
                  <motion.div 
                    animate={reached ? { scale: [1, 1.2, 1], rotate: [0, 10, 0] } : {}}
                    transition={{ duration: 0.5 }}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 z-10 relative",
                      reached 
                        ? "bg-primary border-primary text-primary-foreground shadow-[0_0_10px_rgba(74,222,128,0.5)]" 
                        : "bg-background border-muted text-muted-foreground"
                    )}
                  >
                    {reached ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <span className="text-[10px] font-bold">{milestone.id}</span>}
                  </motion.div>
                  {milestone.id !== MILESTONES.length && (
                    <div className={cn(
                      "absolute top-6 bottom-[-24px] left-1/2 -translate-x-1/2 w-0.5",
                      reached ? "bg-primary/30" : "bg-border"
                    )} />
                  )}
                </div>
                <div className="pb-2">
                  <p className={cn("text-sm font-semibold transition-colors", reached ? "text-foreground" : "text-muted-foreground")}>
                    {milestone.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {milestone.description}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm">Exemplo de oportunidades em 24h</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="text-[11px] leading-tight">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 px-3 font-medium">Oportunidade</th>
                  <th className="py-2 px-3 font-medium">Anualizada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2 px-3">Desligar dev fora do horário</td>
                  <td className="py-2 px-3 font-medium">R$ 72.000</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Reduzir retenção logs</td>
                  <td className="py-2 px-3 font-medium">R$ 48.000</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Remover volumes órfãos</td>
                  <td className="py-2 px-3 font-medium">R$ 30.000</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Lifecycle em bucket</td>
                  <td className="py-2 px-3 font-medium">R$ 36.000</td>
                </tr>
              </tbody>
            </table>
            <div className="p-3 bg-primary/5 text-primary-foreground font-medium flex justify-between border-t border-primary/10">
              <span className="text-primary font-bold">Total estimado:</span>
              <span className="text-primary font-bold">R$ 186.000 / ano</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
