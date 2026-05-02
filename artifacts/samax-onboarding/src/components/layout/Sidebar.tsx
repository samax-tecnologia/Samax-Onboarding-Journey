import { Link, useLocation } from "wouter";
import { 
  PlayCircle, 
  Home, 
  Wallet, 
  Sparkles, 
  Package, 
  Tag, 
  Users, 
  Settings,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { path: "/", label: "Comece por aqui", icon: PlayCircle, isNew: true },
  { path: "/inicio", label: "Início", icon: Home },
  { path: "/financeiro", label: "Financeiro", icon: Wallet },
  { path: "/otimizacao", label: "Otimização", icon: Sparkles },
  { path: "/recursos", label: "Recursos", icon: Package },
  { path: "/tags", label: "Tags", icon: Tag },
  { path: "/usuarios", label: "Usuários", icon: Users },
  { path: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 bg-sidebar flex flex-col h-full flex-shrink-0 border-r border-sidebar-border">
      <div className="p-6 flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">
          S
        </div>
        <span className="text-xl font-semibold text-sidebar-foreground tracking-tight">Samax</span>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors group",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-foreground font-medium" 
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")} />
              <span className="flex-1">{item.label}</span>
              {item.isNew && (
                <Badge variant="secondary" className="bg-primary text-primary-foreground hover:bg-primary border-transparent text-[10px] px-1.5 py-0">
                  Novo
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
