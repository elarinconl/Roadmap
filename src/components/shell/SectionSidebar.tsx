import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarRange,
  Target,
  LineChart,
  GitBranch,
  Settings,
  Grid3X3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const items: NavItem[] = [
  { to: "/roadmap", label: "Roadmap", icon: CalendarRange },
  { to: "/matriz", label: "Matriz por área", icon: Grid3X3 },
  { to: "/objetivos", label: "Objetivos", icon: Target },
  { to: "/metricas", label: "Métricas", icon: LineChart },
  { to: "/dependencias", label: "Dependencias", icon: GitBranch },
];

const footerItems: NavItem[] = [
  { to: "/ajustes", label: "Ajustes", icon: Settings },
];

export function SectionSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-border bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <CalendarRange className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground leading-tight">Roadmap</span>
          <span className="text-[11px] text-muted-foreground leading-tight">FY2026</span>
        </div>
      </div>

      {/* Items */}
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="my-2 h-px bg-border" />

        {footerItems.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground-2">
        v0.1 · Sin autenticación
      </div>
    </aside>
  );
}
