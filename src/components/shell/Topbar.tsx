import { useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown } from "lucide-react";

const labels: Record<string, string> = {
  roadmap: "Roadmap",
  objetivos: "Objetivos",
  metricas: "Métricas",
  dependencias: "Dependencias",
  ajustes: "Ajustes",
};

export function Topbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segs = pathname.split("/").filter(Boolean);
  const current = segs[0] && labels[segs[0]] ? labels[segs[0]] : "Roadmap";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-foreground">{current}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-sm text-foreground transition hover:bg-muted"
        >
          <span className="text-muted-foreground">Viendo:</span>
          <span className="font-medium">Todos</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        <button
          type="button"
          aria-label="Notificaciones"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
