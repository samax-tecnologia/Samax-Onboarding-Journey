import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Sparkles,
  TrendingDown,
  PieChart,
  Sigma,
  Users,
  Package,
  Settings,
  Plug,
  ClipboardCheck,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/lib/tenant-store";

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  isNew?: boolean;
  disabled?: boolean;
  external?: boolean;
};

const navTop: NavItem[] = [
  { path: "/", label: "Visão geral", icon: LayoutDashboard },
  { path: "/unit-economics", label: "Custo unitário", icon: Sigma, isNew: true },
  { path: "/relatorios", label: "Relatórios", icon: FileText, isNew: true },
  { path: "/savings", label: "Oportunidades", icon: Sparkles, disabled: true },
  { path: "/trends", label: "Tendências", icon: TrendingDown, disabled: true },
  { path: "/breakdown", label: "Categorias FOCUS", icon: PieChart, disabled: true },
  { path: "/teams", label: "Times", icon: Users, disabled: true },
  { path: "/products", label: "Produtos", icon: Package, disabled: true },
];

const navBottom: NavItem[] = [
  { path: "/conexoes", label: "Conexões", icon: Plug },
  { path: "/?onboarding", label: "Onboarding", icon: ClipboardCheck, external: true },
  { path: "/configuracoes", label: "Configurações", icon: Settings, disabled: true },
];

export function Sidebar() {
  const [location] = useLocation();
  const { tenantId } = useTenant();

  const renderItem = (item: NavItem) => {
    const isActive = !item.external && location === item.path;
    const cls = cn(
      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors group",
      isActive
        ? "bg-sidebar-accent text-sidebar-foreground font-medium"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      item.disabled && "opacity-60 cursor-not-allowed",
    );

    const inner = (
      <>
        <item.icon
          className={cn(
            "w-5 h-5",
            isActive
              ? "text-sidebar-foreground"
              : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
          )}
        />
        <span className="flex-1">{item.label}</span>
        {item.isNew && (
          <Badge
            variant="secondary"
            className="bg-primary text-primary-foreground hover:bg-primary border-transparent text-[10px] px-1.5 py-0"
          >
            Novo
          </Badge>
        )}
      </>
    );

    if (item.disabled) {
      return (
        <div key={item.path} className={cls} aria-disabled>
          {inner}
        </div>
      );
    }

    if (item.external) {
      // Cross-app navigation: open the onboarding app on / preserving tenant.
      return (
        <a
          key={item.path}
          href={`/?tenant=${encodeURIComponent(tenantId)}`}
          target="_blank"
          rel="noopener"
          className={cls}
          data-testid="sidebar-onboarding-link"
        >
          {inner}
        </a>
      );
    }

    return (
      <Link key={item.path} href={item.path} className={cls}>
        {inner}
      </Link>
    );
  };

  return (
    <aside className="w-64 bg-sidebar flex flex-col h-full flex-shrink-0 border-r border-sidebar-border print:hidden">
      <div className="p-6 flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">
          S
        </div>
        <div className="flex flex-col">
          <span className="text-base font-semibold text-sidebar-foreground tracking-tight leading-tight">
            Samax
          </span>
          <span className="text-[11px] text-sidebar-foreground/60 leading-tight">
            FinOps Dashboard
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navTop.map(renderItem)}
      </nav>

      <div className="px-4 py-4 space-y-1 border-t border-sidebar-border/20">
        {navBottom.map(renderItem)}
      </div>
    </aside>
  );
}
