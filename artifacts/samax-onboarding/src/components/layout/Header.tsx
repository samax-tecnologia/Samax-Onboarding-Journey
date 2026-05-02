import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";

export function Header() {
  const [location] = useLocation();

  const isCustomer = location === "/";
  const isInternal = location === "/jornada-samax";

  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-8 flex-shrink-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Samax</span>
        <span>/</span>
        {isInternal && (
          <>
            <span>Interno</span>
            <span>/</span>
            <span className="text-foreground font-medium">Jornada Samax</span>
          </>
        )}
        {isCustomer && (
          <span className="text-foreground font-medium">Comece por aqui</span>
        )}
        {!isCustomer && !isInternal && (
          <span className="text-foreground font-medium">Onboarding</span>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {(isCustomer || isInternal) && (
          <div className="flex bg-muted rounded-md p-1">
            <Link href="/">
              <div className={`px-3 py-1 text-sm rounded-sm cursor-pointer transition-colors ${isCustomer ? 'bg-primary text-primary-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                Cliente
              </div>
            </Link>
            <Link href="/jornada-samax">
              <div className={`px-3 py-1 text-sm rounded-sm cursor-pointer transition-colors ${isInternal ? 'bg-primary text-primary-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                Interno
              </div>
            </Link>
          </div>
        )}
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Globe className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}