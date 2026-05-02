import { useState, useEffect } from "react";
import { HeroStrip } from "./components/HeroStrip";
import { PhaseTimeline } from "./components/PhaseTimeline";
import { MilestonesPanel } from "./components/MilestonesPanel";
import { PHASES } from "@/lib/constants";

export default function OnboardingPage() {
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>("1.1");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("samax-onboarding-progress");
    if (saved) {
      try {
        setCompletedTaskIds(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load progress");
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("samax-onboarding-progress", JSON.stringify(completedTaskIds));
    }
  }, [completedTaskIds, isLoaded]);

  const toggleTask = (taskId: string) => {
    setCompletedTaskIds(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const totalTasks = PHASES.reduce((acc, phase) => acc + phase.tasks.length, 0);

  if (!isLoaded) return null;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Comece por aqui</h1>
        <p className="text-muted-foreground mt-2 text-base">Sua jornada até o primeiro valor comprovado.</p>
      </div>

      <HeroStrip totalTasks={totalTasks} completedTasks={completedTaskIds.length} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
        <div className="lg:col-span-2">
          <PhaseTimeline 
            completedTaskIds={completedTaskIds} 
            toggleTask={toggleTask}
            expandedPhaseId={expandedPhaseId}
            setExpandedPhaseId={setExpandedPhaseId}
          />
        </div>
        
        <div className="lg:col-span-1">
          <MilestonesPanel completedTaskIds={completedTaskIds} />
        </div>
      </div>
    </div>
  );
}
