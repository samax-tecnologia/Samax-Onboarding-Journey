import { Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PHASES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface PhaseTimelineProps {
  completedTaskIds: string[];
  toggleTask: (taskId: string) => void;
  expandedPhaseId: string | null;
  setExpandedPhaseId: (id: string | null) => void;
}

export function PhaseTimeline({ completedTaskIds, toggleTask, expandedPhaseId, setExpandedPhaseId }: PhaseTimelineProps) {
  
  const isPhaseComplete = (phaseId: string) => {
    const phase = PHASES.find(p => p.id === phaseId);
    if (!phase) return false;
    return phase.tasks.every(t => completedTaskIds.includes(t.id));
  };

  return (
    <div className="relative border-l-2 border-muted ml-4 space-y-6 pb-8">
      {PHASES.map((phase, index) => {
        const completed = isPhaseComplete(phase.id);
        const expanded = expandedPhaseId === phase.id;

        return (
          <div key={phase.id} className="relative pl-8">
            <div 
              className={cn(
                "absolute -left-[11px] top-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                completed 
                  ? "bg-primary border-primary text-primary-foreground" 
                  : "bg-background border-muted-foreground"
              )}
            >
              {completed && <Check className="w-3 h-3" strokeWidth={3} />}
            </div>

            <Card 
              className={cn(
                "cursor-pointer transition-shadow hover:border-primary/50",
                expanded ? "border-primary/50 shadow-sm" : ""
              )}
              onClick={() => setExpandedPhaseId(expanded ? null : phase.id)}
            >
              <div className="p-5 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-semibold text-muted-foreground">Fase {phase.id}</span>
                    <h3 className="font-semibold text-foreground text-base">{phase.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Objetivo:</span> {phase.objective}
                  </p>
                </div>
                <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", expanded && "rotate-180")} />
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
                    <div className="px-5 pb-5 pt-2 border-t bg-muted/20">
                      <div className="mb-4">
                        <p className="text-sm">
                          <span className="font-medium">Resultado esperado:</span> {phase.outcome}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {phase.tasks.map((task) => {
                          const isChecked = completedTaskIds.includes(task.id);
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
                                onCheckedChange={() => toggleTask(task.id)}
                                className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <span className={cn(
                                "text-sm leading-relaxed",
                                isChecked ? "text-muted-foreground line-through" : "text-foreground"
                              )}>
                                {task.title}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      
                      {phase.milestone && (
                        <div className="mt-4 pt-4 border-t flex items-center justify-between">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Entrega marco de valor</span>
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            Marco {phase.milestone}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
