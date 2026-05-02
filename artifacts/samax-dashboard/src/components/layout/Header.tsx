import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-8 flex-shrink-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Samax</span>
        <span>/</span>
        <span>FinOps</span>
        <span>/</span>
        <span className="text-foreground font-medium">Visão geral</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Globe className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
