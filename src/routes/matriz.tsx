import { Suspense, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Grid3X3, Loader2, Plus } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader, ContribStatusBadge } from "@/components/ui-kit";
import {
  areasQuery,
  contributionsQuery,
  initiativesQuery,
  objectivesQuery,
  type Area,
  type Contribution,
  type Initiative,
  type Objective,
} from "@/lib/roadmap-queries";
import {
  ContributionDialog,
  type ContributionDialogState,
} from "@/components/matrix/ContributionDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/matriz")({
  head: () => ({
    meta: [
      { title: "Matriz por área · FY2026" },
      {
        name: "description",
        content: "Vista cruzada de iniciativas por área de la compañía.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(objectivesQuery());
    context.queryClient.ensureQueryData(initiativesQuery());
    context.queryClient.ensureQueryData(areasQuery());
    context.queryClient.ensureQueryData(contributionsQuery());
  },
  component: MatrixPage,
});

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function MatrixPage() {
  const [dialog, setDialog] = useState<ContributionDialogState>(null);
  const [objectiveFilter, setObjectiveFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");

  return (
    <AppShell>
      <PageHeader
        icon={Grid3X3}
        title="Matriz por área"
        subtitle="Qué hace cada área en cada iniciativa · FY2026"
      />
      <Suspense fallback={<LoadingBlock />}>
        <MatrixBody
          dialog={dialog}
          setDialog={setDialog}
          objectiveFilter={objectiveFilter}
          setObjectiveFilter={setObjectiveFilter}
          areaFilter={areaFilter}
          setAreaFilter={setAreaFilter}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ContributionDialog
          state={dialog}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      </Suspense>
    </AppShell>
  );
}

function MatrixBody({
  dialog: _dialog,
  setDialog,
  objectiveFilter,
  setObjectiveFilter,
  areaFilter,
  setAreaFilter,
}: {
  dialog: ContributionDialogState;
  setDialog: (s: ContributionDialogState) => void;
  objectiveFilter: string;
  setObjectiveFilter: (s: string) => void;
  areaFilter: string;
  setAreaFilter: (s: string) => void;
}) {
  const { data: objectives } = useSuspenseQuery(objectivesQuery());
  const { data: initiatives } = useSuspenseQuery(initiativesQuery());
  const { data: areas } = useSuspenseQuery(areasQuery());
  const { data: contributions } = useSuspenseQuery(contributionsQuery());

  const filteredAreas = useMemo(
    () => (areaFilter === "all" ? areas : areas.filter((a) => a.id === areaFilter)),
    [areas, areaFilter],
  );

  const initsByObjective = useMemo(() => {
    const m = new Map<string, Initiative[]>();
    for (const i of initiatives) {
      if (objectiveFilter !== "all" && i.objective_id !== objectiveFilter) continue;
      if (!m.has(i.objective_id)) m.set(i.objective_id, []);
      m.get(i.objective_id)!.push(i);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.start_date.localeCompare(b.start_date));
    }
    return m;
  }, [initiatives, objectiveFilter]);

  const contribKey = (initId: string, areaId: string) => `${initId}::${areaId}`;
  const contribIdx = useMemo(() => {
    const m = new Map<string, Contribution>();
    for (const c of contributions) m.set(contribKey(c.initiative_id, c.area_id), c);
    return m;
  }, [contributions]);

  const visibleObjectives = objectives.filter(
    (o) => objectiveFilter === "all" || o.id === objectiveFilter,
  );

  return (
    <div className="mt-2">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2">
        <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
          <SelectTrigger className="h-9 w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los objetivos</SelectItem>
            {objectives.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.code} · {o.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="bg-muted/40">
              <th className="sticky left-0 z-10 w-[300px] border-b border-r border-border bg-muted/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Iniciativa
              </th>
              {filteredAreas.map((a) => (
                <th
                  key={a.id}
                  className="border-b border-r border-border px-3 py-3 text-[11px] font-semibold uppercase tracking-wide last:border-r-0"
                  style={{ color: a.color, borderTop: `3px solid ${a.color}` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: a.color }}
                    />
                    {a.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleObjectives.map((obj) => {
              const inits = initsByObjective.get(obj.id) ?? [];
              return (
                <ObjectiveBlock
                  key={obj.id}
                  objective={obj}
                  initiatives={inits}
                  areas={filteredAreas}
                  contribIdx={contribIdx}
                  contribKey={contribKey}
                  onOpenCell={(init, area, existing) => {
                    if (existing) {
                      setDialog({
                        mode: "edit",
                        contribution: existing,
                        initiativeLabel: init.title,
                        areaLabel: area.name,
                      });
                    } else {
                      setDialog({
                        mode: "create",
                        initiative_id: init.id,
                        area_id: area.id,
                        initiativeLabel: init.title,
                        areaLabel: area.name,
                      });
                    }
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ObjectiveBlock({
  objective,
  initiatives,
  areas,
  contribIdx,
  contribKey,
  onOpenCell,
}: {
  objective: Objective;
  initiatives: Initiative[];
  areas: Area[];
  contribIdx: Map<string, Contribution>;
  contribKey: (i: string, a: string) => string;
  onOpenCell: (i: Initiative, a: Area, existing: Contribution | undefined) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={areas.length + 1}
          className="border-b border-border bg-muted/20 px-4 py-2"
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: objective.color }}
            />
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {objective.code}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {objective.title}
            </span>
          </div>
        </td>
      </tr>
      {initiatives.length === 0 ? (
        <tr>
          <td
            colSpan={areas.length + 1}
            className="border-b border-border px-4 py-4 text-sm text-muted-foreground"
          >
            Sin iniciativas
          </td>
        </tr>
      ) : (
        initiatives.map((i) => (
          <tr key={i.id} className="group">
            <td className="sticky left-0 z-10 w-[300px] border-b border-r border-border bg-card px-4 py-3 align-top">
              <div className="text-sm font-medium text-foreground">{i.title}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {i.start_date} → {i.end_date}
              </div>
            </td>
            {areas.map((a) => {
              const c = contribIdx.get(contribKey(i.id, a.id));
              const isLeader = i.owner_area_id === a.id;
              return (
                <td
                  key={a.id}
                  className={cn(
                    "border-b border-r border-border align-top last:border-r-0",
                  )}
                  style={
                    isLeader
                      ? { borderLeft: `3px solid ${a.color}` }
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => onOpenCell(i, a, c)}
                    className="block w-full p-3 text-left transition hover:bg-muted/40"
                  >
                    {c ? (
                      <div className="space-y-1.5">
                        <div className="text-[12.5px] font-medium leading-snug text-foreground">
                          {c.title || c.description || (
                            <span className="font-normal text-muted-foreground italic">
                              Sin nombre
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ContribStatusBadge status={c.status} />
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums"
                            style={{
                              background: hexToRgba(a.color, 0.12),
                              color: a.color,
                            }}
                          >
                            {c.start_date.slice(5)} → {c.end_date.slice(5)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-12 items-center gap-1 text-sm text-muted-foreground/60 transition group-hover:text-muted-foreground">
                        <Plus className="h-3.5 w-3.5" /> —
                      </div>
                    )}
                  </button>
                </td>
              );
            })}
          </tr>
        ))
      )}
    </>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
    </div>
  );
}
