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
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/lib/tenant-store";

type SidebarNavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  isNew?: boolean;
  isInternal?: boolean;
  /**
   * If set, the entry is a cross-app link to the dashboard. The string is the
   * dashboard path (e.g. `/` or `/conexoes`); the tenant query param is appended.
   */
  externalDashboardPath?: string;
};

const navItemsTop: SidebarNavItem[] = [
  { path: "/", label: "Comece por aqui", icon: PlayCircle, isNew: true },
  { path: "/inicio", label: "Início", icon: Home, externalDashboardPath: "/" },
  { path: "/financeiro", label: "Financeiro", icon: Wallet, externalDashboardPath: "/financeiro" },
  { path: "/otimizacao", label: "Otimização", icon: Sparkles, externalDashboardPath: "/savings" },
  { path: "/recursos", label: "Recursos", icon: Package, externalDashboardPath: "/recursos" },
  { path: "/tags", label: "Tags", icon: Tag, externalDashboardPath: "/tags" },
  { path: "/usuarios", label: "Usuários", icon: Users, externalDashboardPath: "/teams" },
];

const navItemsBottom: SidebarNavItem[] = [
  { path: "/jornada-samax", label: "Jornada Samax", icon: ClipboardCheck, isInternal: true },
  { path: "/conexoes", label: "Conexões", icon: Wallet, externalDashboardPath: "/conexoes" },
  { path: "/configuracoes", label: "Configurações", icon: Settings, externalDashboardPath: "/configuracoes" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { tenantId } = useTenant();

  const renderItem = (item: SidebarNavItem) => {
    const isActive = !item.externalDashboardPath && location === item.path;
    const cls = cn(
      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors group",
      isActive
        ? "bg-sidebar-accent text-sidebar-foreground font-medium"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
    );

    const inner = (
      <>
        <item.icon className={cn("w-5 h-5", isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")} />
        <span className="flex-1">{item.label}</span>
        {item.isNew && (
          <Badge variant="secondary" className="bg-primary text-primary-foreground hover:bg-primary border-transparent text-[10px] px-1.5 py-0">
            Novo
          </Badge>
        )}
        {item.isInternal && (
          <Badge variant="outline" className="text-amber-400 border-amber-400/30 text-[10px] px-1.5 py-0">
            Interno
          </Badge>
        )}
      </>
    );

    if (item.externalDashboardPath) {
      const href = `/dashboard${item.externalDashboardPath}?tenant=${encodeURIComponent(tenantId)}`;
      return (
        <a
          key={item.path}
          href={href}
          target="_blank"
          rel="noopener"
          className={cls}
          data-testid={`sidebar-dashboard-${item.path.replace(/\//g, "")}`}
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
    <aside className="w-64 bg-sidebar flex flex-col h-full flex-shrink-0 border-r border-sidebar-border">
      <div className="p-6 flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">
          S
        </div>
        <span className="text-xl font-semibold text-sidebar-foreground tracking-tight">Samax</span>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navItemsTop.map(renderItem)}
      </nav>

      <div className="px-4 py-4 space-y-1 border-t border-sidebar-border/20">
        {navItemsBottom.map(renderItem)}
      </div>
    </aside>
  );
}
