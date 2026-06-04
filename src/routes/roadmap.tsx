import { Suspense, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  CalendarRange,
  Plus,
  ListChecks,
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Loader2,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import {
  PageHeader,
  StatCard,
  InfoBanner,
  PrimaryButton,
  type StatusKey,
} from "@/components/ui-kit";
import { GanttChart, type GanttFilters } from "@/components/gantt/GanttChart";
import {
  InitiativeDialog,
  type InitiativeDialogState,
} from "@/components/gantt/InitiativeDialog";
import {
  ContributionDialog,
  type ContributionDialogState,
} from "@/components/matrix/ContributionDialog";
import {
  initiativesQuery,
  objectivesQuery,
  dependenciesQuery,
  milestonesQuery,
  contributionsQuery,
  areasQuery,
} from "@/lib/roadmap-queries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap · FY2026" },
      { name: "description", content: "Planeación trimestral por objetivo." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(initiativesQuery());
    context.queryClient.ensureQueryData(objectivesQuery());
    context.queryClient.ensureQueryData(dependenciesQuery());
    context.queryClient.ensureQueryData(milestonesQuery());
    context.queryClient.ensureQueryData(contributionsQuery());
    context.queryClient.ensureQueryData(areasQuery());
  },
  component: RoadmapPage,
});

const STATUSES: { value: StatusKey | "all"; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "planeado", label: "Planeado" },
  { value: "en_curso", label: "En curso" },
  { value: "en_riesgo", label: "En riesgo" },
  { value: "bloqueado", label: "Bloqueado" },
  { value: "hecho", label: "Hecho" },
];

function RoadmapPage() {
  const [dialog, setDialog] = useState<InitiativeDialogState>(null);
  const [contribDialog, setContribDialog] = useState<ContributionDialogState>(null);
  const [filters, setFilters] = useState<GanttFilters>({
    objectiveId: "all",
    status: "all",
    showCriticalPath: false,
    colorBy: "status",
    viewMode: "chronological",
  });

  return (
    <AppShell>
      <PageHeader
        icon={CalendarRange}
        title="Roadmap"
        subtitle="Planeación trimestral por objetivo · FY2026"
        actions={
          <PrimaryButton icon={Plus} onClick={() => setDialog({ mode: "create" })}>
            Nueva iniciativa
          </PrimaryButton>
        }
      />

      <Suspense fallback={<LoadingBlock />}>
        <RoadmapStats />
      </Suspense>

      <div className="mt-6">
        <InfoBanner>
          Cada <strong>iniciativa</strong> pertenece a un <strong>objetivo</strong> y
          agrupa el trabajo de las <strong>5 áreas</strong> (Producto/IT, Growth,
          Sales, Educación, Operaciones). Pulsa el ▸ de una iniciativa para ver y
          editar lo que hace cada área.
        </InfoBanner>
      </div>

      <Suspense fallback={null}>
        <Toolbar filters={filters} onChange={setFilters} />
      </Suspense>

      <div className="mt-3">
        <Suspense fallback={<LoadingBlock />}>
          <GanttChart
            filters={filters}
            onEditInitiative={(i) => setDialog({ mode: "edit", initiative: i })}
            onCreateInitiative={(objectiveId) =>
              setDialog({ mode: "create", objectiveId })
            }
            onEditContribution={(c, initiativeLabel, areaLabel) =>
              setContribDialog({
                mode: "edit",
                contribution: c,
                initiativeLabel,
                areaLabel,
              })
            }
            onCreateContribution={(initiative_id, area_id, initiativeLabel, areaLabel) =>
              setContribDialog({
                mode: "create",
                initiative_id,
                area_id,
                initiativeLabel,
                areaLabel,
              })
            }
          />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <InitiativeDialog
          state={dialog}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ContributionDialog
          state={contribDialog}
          onOpenChange={(open) => !open && setContribDialog(null)}
        />
      </Suspense>
    </AppShell>
  );
}

function Toolbar({
  filters,
  onChange,
}: {
  filters: GanttFilters;
  onChange: (f: GanttFilters) => void;
}) {
  const { data: objectives } = useSuspenseQuery(objectivesQuery());
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2">
      <div className="flex overflow-hidden rounded-lg border border-border">
        <button
          type="button"
          onClick={() => onChange({ ...filters, viewMode: "objective" })}
          className={cn(
            "h-9 px-3 text-sm font-medium transition",
            filters.viewMode === "objective"
              ? "bg-foreground text-background"
              : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          Por objetivo
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...filters, viewMode: "chronological" })}
          className={cn(
            "h-9 border-l border-border px-3 text-sm font-medium transition",
            filters.viewMode === "chronological"
              ? "bg-foreground text-background"
              : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          Cronológico
        </button>
      </div>

      <Select
        value={filters.objectiveId}
        onValueChange={(v) => onChange({ ...filters, objectiveId: v })}
      >
        <SelectTrigger className="h-9 w-[240px]">
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

      <Select
        value={filters.status}
        onValueChange={(v) => onChange({ ...filters, status: v as StatusKey | "all" })}
      >
        <SelectTrigger className="h-9 w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1">
        <Label htmlFor="cb" className="text-xs text-muted-foreground">
          Colorear por
        </Label>
        <Select
          value={filters.colorBy}
          onValueChange={(v) =>
            onChange({ ...filters, colorBy: v as "area" | "status" })
          }
        >
          <SelectTrigger id="cb" className="h-7 w-[110px] border-0 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="area">Área</SelectItem>
            <SelectItem value="status">Estado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Zap className="h-4 w-4 text-destructive" />
        <Label htmlFor="cp" className="text-sm">Ruta crítica</Label>
        <Switch
          id="cp"
          checked={filters.showCriticalPath}
          onCheckedChange={(v) => onChange({ ...filters, showCriticalPath: v })}
        />
      </div>
    </div>
  );
}

function RoadmapStats() {
  const { data: initiatives } = useSuspenseQuery(initiativesQuery());
  const count = (s: string) => initiatives.filter((i) => i.status === s).length;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <StatCard icon={ListChecks} label="Iniciativas totales" value={initiatives.length} tint="module" />
      <StatCard icon={Activity} label="En curso" value={count("en_curso")} tint="blue" />
      <StatCard icon={AlertTriangle} label="En riesgo" value={count("en_riesgo")} tint="amber" />
      <StatCard icon={Ban} label="Bloqueadas" value={count("bloqueado")} tint="red" />
      <StatCard icon={CheckCircle2} label="Hechas" value={count("hecho")} tint="green" />
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
    </div>
  );
}
