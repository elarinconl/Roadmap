import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarRange,
  Target,
  LineChart,
  GitBranch,
  Grid3X3,
  Settings,
  Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: LucideIcon };

const items: NavItem[] = [
  { to: "/roadmap", label: "Roadmap", icon: CalendarRange },
  { to: "/matriz", label: "Matriz por área", icon: Grid3X3 },
  { to: "/objetivos", label: "Objetivos", icon: Target },
  { to: "/metricas", label: "Métricas", icon: LineChart },
  { to: "/dependencias", label: "Dependencias", icon: GitBranch },
];

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-6">
        {/* Brand */}
        <Link to="/roadmap" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <CalendarRange className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-semibold text-foreground">Roadmap</span>
            <span className="text-[10px] text-muted-foreground">FY2026</span>
          </div>
        </Link>

        {/* Tabs */}
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {items.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            const isEnabled = item.to === "/roadmap";
            if (isEnabled) {
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition whitespace-nowrap",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            }
            return (
              <span
                key={item.to}
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground/40"
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {item.label}
                <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold tracking-wide text-muted-foreground/60">
                  Coming soon
                </span>
              </span>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <Link
            to="/ajustes"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground",
              pathname === "/ajustes" && "bg-muted text-foreground",
            )}
            aria-label="Ajustes"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Link>
          <button
            type="button"
            aria-label="Notificaciones"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}
