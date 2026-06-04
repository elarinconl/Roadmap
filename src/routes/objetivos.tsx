import { Suspense, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Target, Plus, Pencil, Loader2 } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import {
  PageHeader,
  PrimaryButton,
  EmptyState,
  StatusBadge,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  ObjectiveDialog,
  type ObjectiveDialogState,
} from "@/components/objectives/ObjectiveDialog";
import {
  KeyResultDialog,
  type KeyResultDialogState,
} from "@/components/objectives/KeyResultDialog";
import {
  keyResultsQuery,
  objectivesQuery,
  initiativesQuery,
  type Objective,
  type KeyResult,
} from "@/lib/roadmap-queries";

export const Route = createFileRoute("/objetivos")({
  head: () => ({ meta: [{ title: "Objetivos · FY2026" }] }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(objectivesQuery());
    context.queryClient.ensureQueryData(keyResultsQuery());
    context.queryClient.ensureQueryData(initiativesQuery());
  },
  component: ObjetivosPage,
});

function ObjetivosPage() {
  const [objDialog, setObjDialog] = useState<ObjectiveDialogState>(null);
  const [krDialog, setKrDialog] = useState<KeyResultDialogState>(null);

  return (
    <AppShell>
      <PageHeader
        icon={Target}
        title="Objetivos"
        subtitle="OKRs y key results por objetivo"
        actions={
          <PrimaryButton icon={Plus} onClick={() => setObjDialog({ mode: "create" })}>
            Nuevo objetivo
          </PrimaryButton>
        }
      />

      <Suspense fallback={<LoadingBlock />}>
        <ObjectivesList
          onEditObjective={(o) => setObjDialog({ mode: "edit", objective: o })}
          onAddKr={(objectiveId) => setKrDialog({ mode: "create", objectiveId })}
          onEditKr={(kr) => setKrDialog({ mode: "edit", keyResult: kr })}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ObjectiveDialog state={objDialog} onOpenChange={(o) => !o && setObjDialog(null)} />
      </Suspense>
      <Suspense fallback={null}>
        <KeyResultDialog state={krDialog} onOpenChange={(o) => !o && setKrDialog(null)} />
      </Suspense>
    </AppShell>
  );
}

function ObjectivesList({
  onEditObjective,
  onAddKr,
  onEditKr,
}: {
  onEditObjective: (o: Objective) => void;
  onAddKr: (objectiveId: string) => void;
  onEditKr: (kr: KeyResult) => void;
}) {
  const { data: objectives } = useSuspenseQuery(objectivesQuery());
  const { data: keyResults } = useSuspenseQuery(keyResultsQuery());
  const { data: initiatives } = useSuspenseQuery(initiativesQuery());

  if (objectives.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="Aún no hay objetivos"
        description="Crea tu primer objetivo para empezar a planear iniciativas y KRs."
      />
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {objectives.map((o) => {
        const krs = keyResults.filter((k) => k.objective_id === o.id);
        const initCount = initiatives.filter((i) => i.objective_id === o.id).length;
        return (
          <div
            key={o.id}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-3">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: o.color }}
              />
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {o.code}
              </span>
              <h3 className="truncate text-sm font-semibold text-foreground">
                {o.title}
              </h3>
              <span className="ml-2 text-[11px] text-muted-foreground">
                {krs.length} KR · {initCount} iniciativas
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddKr(o.id)}
                  className="h-8"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> KR
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditObjective(o)}
                  className="h-8"
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
              </div>
            </div>

            {o.description && (
              <p className="border-b border-border px-5 py-3 text-sm text-muted-foreground">
                {o.description}
              </p>
            )}

            {krs.length === 0 ? (
              <div className="px-5 py-6 text-sm text-muted-foreground">
                Sin key results. Añade uno para medir progreso.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {krs.map((k) => {
                  const target = k.target;
                  const current = k.current_value;
                  const pct =
                    target && target > 0 && current != null
                      ? Math.max(0, Math.min(100, (current / target) * 100))
                      : null;
                  return (
                    <li
                      key={k.id}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {k.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {current ?? "—"} / {target ?? "—"} {k.unit ?? ""}
                          {pct != null && ` · ${Math.round(pct)}%`}
                        </div>
                        {pct != null && (
                          <div className="mt-1.5 h-1 w-48 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-module"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <StatusBadge status={k.status ?? "planeado"} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEditKr(k)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="mt-6 flex items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
    </div>
  );
}
