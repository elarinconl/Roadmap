import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, Diamond, Plus, X, Trash2, Link2, Pencil, Code2, FlaskConical, CircleDashed, Clock3, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  areasQuery,
  initiativesQuery,
  objectivesQuery,
  dependenciesQuery,
  milestonesQuery,
  contributionsQuery,
  denormalizeStatus,
  dateToFraction,
  todayFraction,
  addDaysISO,
  clampDateISO,
  computeCriticalPath,
  FY_TOTAL_DAYS,
  MONTH_LABELS,
  type Initiative,
  type Objective,
  type Area,
  type Contribution,
} from "@/lib/roadmap-queries";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, statusMap, type StatusKey } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

const LEFT_COL = 420;
const ROW_H = 56;
const HEADER_H = 36;
const QUARTER_H = 22;
const MILESTONE_H = 32;
const AREA_ROW_MIN = 44;
const LANE_H = 24;
const LANE_GAP = 4;
const ADD_ACTIVITY_H = 34;
const MIN_MONTH_W = 220;
const MIN_TIMELINE_W = MIN_MONTH_W * 12;

const STATUS_BAR: Record<string, string> = {
  // English values
  to_do:       "bg-tint-gray-bg border-tint-gray-fg/35 text-tint-gray-fg",
  in_design:   "bg-tint-lavender-bg border-tint-lavender-fg/35 text-tint-lavender-fg",
  in_dev:      "bg-tint-blue-bg border-tint-blue-fg/35 text-tint-blue-fg",
  in_qa:       "bg-tint-amber-bg border-tint-amber-fg/45 text-tint-amber-fg",
  in_progress: "bg-tint-blue-bg border-tint-blue-fg/35 text-tint-blue-fg",
  completed:   "bg-tint-green-bg border-tint-green-fg/35 text-tint-green-fg",
  // Legacy Spanish fallbacks
  planeado:    "bg-tint-gray-bg border-tint-gray-fg/35 text-tint-gray-fg",
  en_curso:    "bg-tint-blue-bg border-tint-blue-fg/35 text-tint-blue-fg",
  en_riesgo:   "bg-tint-amber-bg border-tint-amber-fg/45 text-tint-amber-fg",
  bloqueado:   "bg-tint-red-bg border-tint-red-fg/45 text-tint-red-fg",
  hecho:       "bg-tint-green-bg border-tint-green-fg/35 text-tint-green-fg",
};

const CONTRIB_STATUS_BAR = STATUS_BAR;

import type { LucideIcon } from "lucide-react";
const CONTRIB_STATUS_ICON: Record<string, LucideIcon> = {
  to_do:      CircleDashed,
  in_design:  Pencil,
  in_dev:     Code2,
  in_qa:      FlaskConical,
  in_progress:Clock3,
  completed:  CheckCircle2,
  planeado:   CircleDashed,
  en_curso:   Clock3,
  en_riesgo:  Clock3,
  bloqueado:  CircleDashed,
  hecho:      CheckCircle2,
};

type DragMode = "move" | "resize-left" | "resize-right";
type DragKind = "init" | "contrib";

type DragState = {
  kind: DragKind;
  id: string;
  mode: DragMode;
  startPx: number;
  startStart: string;
  startEnd: string;
  pxPerDay: number;
  deltaDays: number;
};

export type GanttFilters = {
  objectiveId: string | "all";
  status: StatusKey | "all";
  showCriticalPath: boolean;
  colorBy: "area" | "status";
  viewMode: "objective" | "chronological";
};

// Convert hex (#RRGGBB) to rgba string with given alpha.
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function GanttChart({
  onEditInitiative,
  onCreateInitiative,
  onEditContribution,
  onCreateContribution,
  filters,
}: {
  onEditInitiative?: (i: Initiative) => void;
  onCreateInitiative?: (objectiveId: string) => void;
  onEditContribution?: (c: Contribution, initiativeLabel: string, areaLabel: string) => void;
  onCreateContribution?: (
    initiativeId: string,
    areaId: string | null,
    initiativeLabel: string,
    areaLabel: string | null,
  ) => void;
  filters: GanttFilters;
}) {
  const { data: objectives } = useSuspenseQuery(objectivesQuery());
  const { data: initiatives } = useSuspenseQuery(initiativesQuery());
  const { data: areas } = useSuspenseQuery(areasQuery());
  const { data: deps } = useSuspenseQuery(dependenciesQuery());
  const { data: milestones } = useSuspenseQuery(milestonesQuery());
  const { data: contributions } = useSuspenseQuery(contributionsQuery());
  const queryClient = useQueryClient();

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [svgW, setSvgW] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [deleteDepState, setDeleteDepState] = useState<{ id: string; x: number; y: number } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [linkMode, setLinkMode] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [linkCursor, setLinkCursor] = useState<{ x: number; y: number } | null>(null);

  const toggleExpanded = (id: string) =>
    setExpanded((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    if (!linkMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setLinkMode(false); setLinkFrom(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [linkMode]);

  // Scroll to Q2 (April 1 = 25% of year) on first render
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = MIN_TIMELINE_W * 0.25 - 40;
    }
  }, []);

  const updateDates = useMutation({
    mutationFn: async (vals: { id: string; start_date: string; end_date: string }) => {
      const { error } = await supabase
        .from("initiatives")
        .update({ start_date: vals.start_date, end_date: vals.end_date })
        .eq("id", vals.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: initiativesQuery().queryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateContribDates = useMutation({
    mutationFn: async (vals: { id: string; start_date: string; end_date: string }) => {
      const { error } = await supabase
        .from("contributions")
        .update({ start_date: vals.start_date, end_date: vals.end_date })
        .eq("id", vals.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contributionsQuery().queryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeArea = useMutation({
    mutationFn: async (vals: { initiative_id: string; area_id: string }) => {
      const { error } = await supabase
        .from("contributions")
        .delete()
        .eq("initiative_id", vals.initiative_id)
        .eq("area_id", vals.area_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contributionsQuery().queryKey });
      toast.success("Área quitada de la iniciativa");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createDep = useMutation({
    mutationFn: async (vals: { from: string; to: string }) => {
      const { error } = await supabase.from("dependencies").insert({
        from_initiative_id: vals.from,
        to_initiative_id: vals.to,
        type: "finish_to_start",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependenciesQuery().queryKey });
      toast.success("Dependencia creada");
      setLinkFrom(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteDep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dependencies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependenciesQuery().queryKey });
      toast.success("Dependencia eliminada");
      setDeleteDepState(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Use a ref to avoid stale closures in the click handler.
  const linkFromRef = useRef<string | null>(null);
  linkFromRef.current = linkFrom;

  const handleBarLinkClick = (initiativeId: string) => {
    const current = linkFromRef.current;
    if (!current) {
      setLinkFrom(initiativeId);
      return;
    }
    if (current === initiativeId) {
      setLinkFrom(null);
      return;
    }
    const exists = deps.some(
      (d) => d.from_initiative_id === current && d.to_initiative_id === initiativeId,
    );
    if (exists) {
      toast.error("Esta dependencia ya existe");
      setLinkFrom(null);
      return;
    }
    createDep.mutate({ from: current, to: initiativeId });
  };

  const criticalSet = useMemo(
    () => computeCriticalPath(initiatives, deps),
    [initiatives, deps],
  );

  const filtered = useMemo(() => {
    return initiatives.filter((i) => {
      if (filters.objectiveId !== "all" && i.objective_id !== filters.objectiveId) return false;
      if (filters.status !== "all" && i.status !== filters.status) return false;
      return true;
    });
  }, [initiatives, filters]);

  const grouped = useMemo((): { objective: Objective | null; initiatives: Initiative[] }[] => {
    if (filters.viewMode === "chronological") {
      return [{
        objective: null,
        initiatives: [...filtered].sort((a, b) => a.start_date.localeCompare(b.start_date)),
      }];
    }
    const byObj = new Map<string, Initiative[]>();
    for (const i of filtered) {
      if (!byObj.has(i.objective_id)) byObj.set(i.objective_id, []);
      byObj.get(i.objective_id)!.push(i);
    }
    return objectives
      .filter((o) => filters.objectiveId === "all" || o.id === filters.objectiveId)
      .map((o) => ({
        objective: o,
        initiatives: (byObj.get(o.id) ?? []).sort((a, b) =>
          a.start_date.localeCompare(b.start_date),
        ),
      }));
  }, [objectives, filtered, filters.objectiveId, filters.viewMode]);

  const areaById = useMemo(() => {
    const m = new Map<string, Area>();
    for (const a of areas) m.set(a.id, a);
    return m;
  }, [areas]);

  const objectiveById = useMemo(() => {
    const m = new Map<string, Objective>();
    for (const o of objectives) m.set(o.id, o);
    return m;
  }, [objectives]);

  // Group contributions by initiative then by area, with lane packing.
  const contribsByInit = useMemo(() => {
    const m = new Map<string, Map<string, { c: Contribution; lane: number }[]>>();
    for (const c of contributions) {
      if (!m.has(c.initiative_id)) m.set(c.initiative_id, new Map());
      const byArea = m.get(c.initiative_id)!;
      if (!byArea.has(c.area_id)) byArea.set(c.area_id, []);
      byArea.get(c.area_id)!.push({ c, lane: 0 });
    }
    // Lane-pack each area: sort by start, assign first lane whose last end < new start
    for (const byArea of m.values()) {
      for (const list of byArea.values()) {
        list.sort((a, b) => a.c.start_date.localeCompare(b.c.start_date));
        const laneEnds: string[] = [];
        for (const item of list) {
          let lane = laneEnds.findIndex((end) => end < item.c.start_date);
          if (lane === -1) {
            lane = laneEnds.length;
            laneEnds.push(item.c.end_date);
          } else {
            laneEnds[lane] = item.c.end_date;
          }
          item.lane = lane;
        }
      }
    }
    return m;
  }, [contributions]);

  // Returns height needed for one area sub-row given the lanes used.
  const areaRowHeight = (initId: string, areaId: string) => {
    const lanes =
      (contribsByInit.get(initId)?.get(areaId)?.reduce((m, x) => Math.max(m, x.lane + 1), 0)) ?? 0;
    return Math.max(AREA_ROW_MIN, lanes * (LANE_H + LANE_GAP) + LANE_GAP + 14);
  };

  // Active areas for an initiative = areas with at least one activity, in
  // the canonical area order.
  const activeAreasFor = (initId: string): Area[] => {
    const byArea = contribsByInit.get(initId);
    if (!byArea) return [];
    return areas.filter((a) => byArea.has(a.id));
  };

  // Row position map (initiative id → y center). When expanded, only the
  // active areas (those with at least one activity) get a sub-row. Each area
  // row hosts its own inline "+ Actividad" CTA on the left column.

  const layout = useMemo(() => {
    const rowOf = new Map<string, number>();
    let y = 0;
    for (const g of grouped) {
      if (g.objective !== null) y += ROW_H; // objective header row
      for (const i of g.initiatives) {
        rowOf.set(i.id, y + ROW_H / 2);
        y += ROW_H;
        if (expanded.has(i.id)) {
          for (const a of activeAreasFor(i.id)) y += areaRowHeight(i.id, a.id);
          y += ADD_ACTIVITY_H;
        }

      }
    }
    return { rowOf, totalHeight: y };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, expanded, areas, contribsByInit]);

  const today = todayFraction();

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSvgW(el.clientWidth));
    ro.observe(el);
    setSvgW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const dragHappenedRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, i: Initiative, mode: DragMode) => {
      if (!timelineRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      dragHappenedRef.current = false;
      const rect = timelineRef.current.getBoundingClientRect();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      setDrag({
        kind: "init",
        id: i.id,
        mode,
        startPx: e.clientX,
        startStart: i.start_date,
        startEnd: i.end_date,
        pxPerDay: rect.width / FY_TOTAL_DAYS,
        deltaDays: 0,
      });
    },
    [],
  );

  const handleContribPointerDown = useCallback(
    (e: React.PointerEvent, c: Contribution, mode: DragMode) => {
      if (!timelineRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = timelineRef.current.getBoundingClientRect();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      setDrag({
        kind: "contrib",
        id: c.id,
        mode,
        startPx: e.clientX,
        startStart: c.start_date,
        startEnd: c.end_date,
        pxPerDay: rect.width / FY_TOTAL_DAYS,
        deltaDays: 0,
      });
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const deltaDays = Math.round((e.clientX - drag.startPx) / drag.pxPerDay);
      if (deltaDays !== 0) dragHappenedRef.current = true;
      if (deltaDays !== drag.deltaDays) {
        setDrag({ ...drag, deltaDays });
      }
    },
    [drag],
  );

  const computeDragDates = (d: DragState) => {
    let start = d.startStart;
    let end = d.startEnd;
    if (d.mode === "move") {
      start = clampDateISO(addDaysISO(d.startStart, d.deltaDays));
      end = clampDateISO(addDaysISO(d.startEnd, d.deltaDays));
    } else if (d.mode === "resize-left") {
      const candidate = addDaysISO(d.startStart, d.deltaDays);
      start = clampDateISO(candidate >= d.startEnd ? d.startEnd : candidate);
    } else {
      const candidate = addDaysISO(d.startEnd, d.deltaDays);
      end = clampDateISO(candidate <= d.startStart ? d.startStart : candidate);
    }
    return { start, end };
  };

  const handlePointerUp = useCallback(() => {
    if (!drag) return;
    const { start, end } = computeDragDates(drag);
    const changed = start !== drag.startStart || end !== drag.startEnd;
    const kind = drag.kind;
    const id = drag.id;
    setDrag(null);
    if (changed) {
      if (kind === "init") updateDates.mutate({ id, start_date: start, end_date: end });
      else updateContribDates.mutate({ id, start_date: start, end_date: end });
    }
  }, [drag, updateDates, updateContribDates]);

  const arrows = useMemo(() => {
    if (!svgW) return [];
    const initById = new Map<string, Initiative>(filtered.map((i) => [i.id, i]));
    return deps
      .filter(
        (d) =>
          layout.rowOf.has(d.from_initiative_id) &&
          layout.rowOf.has(d.to_initiative_id),
      )
      .map((d) => {
        const from = initById.get(d.from_initiative_id)!;
        const to = initById.get(d.to_initiative_id)!;
        const isCritical =
          filters.showCriticalPath &&
          criticalSet.has(d.from_initiative_id) &&
          criticalSet.has(d.to_initiative_id);
        return {
          id: d.id,
          x1: dateToFraction(from.end_date) * svgW,
          y1: layout.rowOf.get(from.id)!,
          x2: dateToFraction(to.start_date) * svgW,
          y2: layout.rowOf.get(to.id)!,
          critical: isCritical,
        };
      });
  }, [deps, filtered, layout, criticalSet, filters.showCriticalPath, svgW]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex">

        {/* ── FROZEN LEFT COLUMN (outside the horizontal scroll) ── */}
        <div className="shrink-0 border-r border-border bg-card" style={{ width: LEFT_COL }}>
          {/* Milestones label */}
          {milestones.length > 0 && (
            <div
              className="flex items-center border-b border-border bg-card px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ height: MILESTONE_H }}
            >
              Hitos
            </div>
          )}
          {/* Quarter row (empty, just for height alignment) */}
          <div className="border-b border-border bg-muted/20" style={{ height: QUARTER_H }} />
          {/* Months header label */}
          <div
            className="flex items-center justify-between border-b border-border bg-muted/40 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ height: HEADER_H }}
          >
            <span>{filters.viewMode === "chronological" ? "Iniciativa" : "Objetivo · Iniciativa"}</span>
            <button
              type="button"
              onClick={() => { setLinkMode((m) => !m); setLinkFrom(null); }}
              title={linkMode ? "Salir del modo conexión (Esc)" : "Crear dependencias entre iniciativas"}
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded transition",
                linkMode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Link2 className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>
          {/* Row labels */}
          {grouped.length === 0 ? (
            <div style={{ height: 200 }} />
          ) : (
            grouped.map((g) => (
              <div key={g.objective?.id ?? "chronological"}>
                {g.objective !== null && (
                  <ObjectiveRowLeft
                    objective={g.objective}
                    onAdd={onCreateInitiative ? () => onCreateInitiative(g.objective!.id) : undefined}
                  />
                )}
                {g.initiatives.map((i) => (
                  <div key={i.id}>
                    <InitiativeRowLeft
                      initiative={i}
                      critical={filters.showCriticalPath && criticalSet.has(i.id)}
                      expanded={expanded.has(i.id)}
                      onToggle={() => toggleExpanded(i.id)}
                      onEdit={() => onEditInitiative?.(i)}
                    />
                    {expanded.has(i.id) && (
                      <>
                        {activeAreasFor(i.id).map((area) => {
                          const h = areaRowHeight(i.id, area.id);
                          return (
                            <div
                              key={area.id}
                              className="flex items-center gap-2 border-b border-border bg-muted/15 px-4 pl-10"
                              style={{ height: h }}
                            >
                              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: area.color }} />
                              <span className="text-[12px] font-medium text-foreground">{area.name}</span>
                              <div className="ml-auto flex items-center gap-1.5">
                                <InlineCreateActivity initiativeId={i.id} areaId={area.id} />
                                <InlineConfirm
                                  message={`Quitar a ${area.name} de "${i.title}" eliminará sus actividades.`}
                                  onConfirm={() => removeArea.mutate({ initiative_id: i.id, area_id: area.id })}
                                  triggerClassName="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                                  title={`Quitar ${area.name} de la iniciativa`}
                                >
                                  <X className="h-3 w-3" strokeWidth={2} />
                                </InlineConfirm>
                              </div>
                            </div>
                          );
                        })}
                        <div
                          className="flex items-center border-b border-border bg-muted/10 px-4 pl-10"
                          style={{ height: ADD_ACTIVITY_H }}
                        >
                          <InlineCreateActivityWithArea initiativeId={i.id} areas={areas} />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* ── SCROLLABLE RIGHT SIDE ── */}
        <div ref={scrollContainerRef} className="overflow-x-auto flex-1">
          {/* Quarter labels row */}
          <div className="border-b border-border bg-muted/20" style={{ height: QUARTER_H, minWidth: MIN_TIMELINE_W }}>
            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(4, minmax(0,1fr))` }}>
              {(["Q1", "Q2", "Q3", "Q4"] as const).map((q, idx) => (
                <div
                  key={q}
                  className={cn(
                    "flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 border-l border-border/60",
                    idx === 0 && "border-l-0",
                  )}
                >
                  {q}
                </div>
              ))}
            </div>
          </div>
          {/* Milestones timeline row */}
          {milestones.length > 0 && (
            <div className="relative border-b border-border bg-card" style={{ height: MILESTONE_H, minWidth: MIN_TIMELINE_W }}>
              {milestones.map((m) => {
                const f = dateToFraction(m.date);
                return (
                  <div
                    key={m.id}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                    style={{ left: `${f * 100}%` }}
                    title={`${m.name} · ${m.date}`}
                  >
                    <Diamond className="h-4 w-4 fill-module text-module" strokeWidth={1.5} />
                    <span className="pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background opacity-0 group-hover:opacity-100">
                      {m.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Months header */}
          <div className="border-b border-border bg-muted/40" style={{ height: HEADER_H, minWidth: MIN_TIMELINE_W }}>
            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(12, minmax(0,1fr))` }}>
              {MONTH_LABELS.map((m, idx) => (
                <div
                  key={m + idx}
                  className={cn(
                    "flex items-center justify-center border-l border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                    idx === 0 && "border-l-0",
                    idx % 3 === 0 && idx !== 0 && "border-l-foreground/20",
                  )}
                >
                  {m}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline body */}
          {grouped.length === 0 ? (
            <div className="flex items-center justify-center px-6 py-16 text-sm text-muted-foreground" style={{ minWidth: MIN_TIMELINE_W }}>
              No hay iniciativas que coincidan con los filtros.
            </div>
          ) : (
            <div
              ref={timelineRef}
              className={cn("relative", drag && "cursor-grabbing select-none", linkMode && !drag && "cursor-crosshair")}
              style={{ height: layout.totalHeight, minWidth: MIN_TIMELINE_W }}
              onPointerMove={(e) => {
                handlePointerMove(e);
                if (linkMode && timelineRef.current) {
                  const rect = timelineRef.current.getBoundingClientRect();
                  setLinkCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }
              }}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {/* Link mode hint banner */}
              {linkMode && (
                <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex justify-center">
                  <div className="rounded-b-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground shadow-md">
                    {linkFrom
                      ? "Clic en la iniciativa destino · Esc para cancelar"
                      : "Clic en la iniciativa origen · Esc para cancelar"}
                  </div>
                </div>
              )}

              {/* Month / quarter grid */}
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(12, minmax(0,1fr))` }}>
                {MONTH_LABELS.map((m, idx) => (
                  <div
                    key={m + idx}
                    className={cn("border-l border-border", idx === 0 && "border-l-0", idx % 3 === 0 && idx !== 0 && "border-l-foreground/20")}
                  />
                ))}
              </div>

              {/* Today line */}
              {today > 0 && today < 1 && (
                <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-module/60" style={{ left: `${today * 100}%` }}>
                  <span className="absolute -top-px -left-[6px] inline-block h-2 w-2 rounded-full bg-module" />
                </div>
              )}

              {/* Rows + bars */}
              <div className="relative">
                {grouped.map((g) => (
                  <div key={g.objective?.id ?? "chronological"}>
                    {g.objective !== null && (
                      <div className="border-b border-border bg-muted/30" style={{ height: ROW_H }} />
                    )}
                    {g.initiatives.map((i) => {
                      const isDragging = drag?.kind === "init" && drag.id === i.id;
                      const effective = isDragging && drag ? computeDragDates(drag) : { start: i.start_date, end: i.end_date };
                      const start = dateToFraction(effective.start);
                      const end = dateToFraction(effective.end);
                      const width = Math.max(0.008, end - start);
                      const isCritical = filters.showCriticalPath && criticalSet.has(i.id);
                      const leaderArea = i.owner_area_id ? areaById.get(i.owner_area_id) : undefined;
                      const areasUsed = Array.from(contribsByInit.get(i.id)?.keys() ?? []);
                      const useArea = filters.colorBy === "area" && leaderArea?.color;
                      const InitiativeStatusIcon = (statusMap[i.status] ?? statusMap.to_do).icon;
                      const barStyle: React.CSSProperties = useArea
                        ? { left: `${start * 100}%`, width: `${width * 100}%`, height: 26, background: hexToRgba(leaderArea!.color, 0.18), borderColor: hexToRgba(leaderArea!.color, 0.55), color: leaderArea!.color }
                        : { left: `${start * 100}%`, width: `${width * 100}%`, height: 26 };

                      return (
                        <div key={i.id}>
                          <div className="relative border-b border-border" style={{ height: ROW_H }}>
                            <div
                              className={cn(
                                "group absolute top-1/2 -translate-y-1/2 rounded-lg border text-[11px] font-semibold leading-[22px] truncate flex items-stretch transition",
                                !useArea && (STATUS_BAR[i.status] ?? STATUS_BAR.to_do),
                                isDragging ? "shadow-md ring-2 ring-ring/40" : "hover:brightness-95 hover:shadow-sm",
                                isCritical && !linkMode && "ring-2 ring-destructive/70",
                                linkFrom === i.id && "ring-2 ring-primary",
                                linkMode && linkFrom !== i.id && "hover:ring-2 hover:ring-primary/50",
                              )}
                              style={barStyle}
                              title={linkMode ? (linkFrom ? `Conectar hacia "${i.title}"` : `Iniciar desde "${i.title}"`) : `${i.title} · ${effective.start} → ${effective.end}`}
                            >
                              <span onPointerDown={!linkMode ? (e) => handlePointerDown(e, i, "resize-left") : undefined} className="w-1.5 shrink-0 cursor-ew-resize rounded-l-lg opacity-0 group-hover:opacity-100 bg-foreground/20" />
                              <button
                                type="button"
                                onPointerDown={!linkMode ? (e) => handlePointerDown(e, i, "move") : undefined}
                                onClick={linkMode
                                  ? (e) => { e.stopPropagation(); handleBarLinkClick(i.id); }
                                  : (e) => { e.stopPropagation(); if (!dragHappenedRef.current) toggleExpanded(i.id); }
                                }
                                onDoubleClick={(e) => { if (!linkMode) { e.stopPropagation(); onEditInitiative?.(i); } }}
                                className={cn("flex min-w-0 flex-1 items-center gap-1.5 px-2 text-left focus:outline-none", !linkMode && "cursor-grab active:cursor-grabbing")}
                                title={!linkMode ? `${i.title} — clic para expandir · arrastrar para mover · doble clic para detalles` : undefined}
                              >
                                <InitiativeStatusIcon className="h-3 w-3 shrink-0" strokeWidth={2.25} />
                                <span className="truncate">{i.title}</span>
                              </button>
                              {areasUsed.length > 0 && (
                                <span className="flex shrink-0 items-center gap-0.5 pr-1.5">
                                  {areasUsed.map((aid) => {
                                    const a = areaById.get(aid);
                                    return <span key={aid} title={a?.name ?? ""} className="inline-block h-1.5 w-1.5 rounded-full ring-1 ring-card" style={{ background: a?.color ?? "#888" }} />;
                                  })}
                                </span>
                              )}
                              <span onPointerDown={!linkMode ? (e) => handlePointerDown(e, i, "resize-right") : undefined} className="w-1.5 shrink-0 cursor-ew-resize rounded-r-lg opacity-0 group-hover:opacity-100 bg-foreground/20" />
                            </div>
                          </div>

                          {expanded.has(i.id) && (
                            <>
                              {activeAreasFor(i.id).map((area) => {
                                const cs = contribsByInit.get(i.id)?.get(area.id) ?? [];
                                const color = area.color;
                                const h = areaRowHeight(i.id, area.id);
                                return (
                                  <div
                                    key={area.id}
                                    className="group/sub relative border-b border-border bg-muted/5"
                                    style={{ height: h }}
                                    onDoubleClick={() => onCreateContribution?.(i.id, area.id, i.title, area.name)}
                                    title={`Doble click para añadir otra actividad de ${area.name}`}
                                  >
                                    {cs.map(({ c, lane }) => {
                                      const isCDrag = drag?.kind === "contrib" && drag.id === c.id;
                                      const eff = isCDrag && drag ? computeDragDates(drag) : { start: c.start_date, end: c.end_date };
                                      const x1 = dateToFraction(eff.start);
                                      const x2 = dateToFraction(eff.end);
                                      const cw = Math.max(0.006, x2 - x1);
                                      const top = LANE_GAP + lane * (LANE_H + LANE_GAP);
                                      return (
                                        <InlineEditActivityBar
                                          key={c.id}
                                          contribution={c}
                                          color={color}
                                          colorBy={filters.colorBy}
                                          isDragging={isCDrag}
                                          style={{ left: `${x1 * 100}%`, width: `${cw * 100}%`, top, height: LANE_H }}
                                          onPointerDownDrag={(e, mode) => handleContribPointerDown(e, c, mode)}
                                          onOpenDetails={() => onEditContribution?.(c, i.title, area.name)}
                                        />
                                      );
                                    })}
                                  </div>
                                );
                              })}
                              <div className="border-b border-border bg-muted/5" style={{ height: ADD_ACTIVITY_H }} />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Dependency arrows — rendered after bars so they display on top; pointer-events-none keeps bars interactive */}
              <svg
                className="pointer-events-none absolute inset-0 z-10 overflow-visible"
                style={{ width: "100%", height: "100%" }}
              >
                <defs>
                  <marker id="arrow-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-500" />
                  </marker>
                  <marker id="arrow-critical" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-destructive" />
                  </marker>
                </defs>
                {arrows.map((a) => (
                  <ArrowPath key={a.id} arrow={a} />
                ))}
                {linkMode && linkFrom && linkCursor && (() => {
                  const fromInit = filtered.find((i) => i.id === linkFrom);
                  if (!fromInit) return null;
                  const lx1 = dateToFraction(fromInit.end_date) * svgW;
                  const ly1 = layout.rowOf.get(linkFrom) ?? 0;
                  return (
                    <line
                      x1={lx1}
                      y1={ly1}
                      x2={linkCursor.x}
                      y2={linkCursor.y}
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                    />
                  );
                })()}
              </svg>

              {/* Arrow hit areas — z-30 so they sit above the SVG layer */}
              {!linkMode && arrows.map((a) => {
                const midX = (a.x1 + a.x2) / 2;
                const handleDelete = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setDeleteDepState({ id: a.id, x: e.clientX, y: e.clientY + 8 });
                };
                return (
                  <Fragment key={a.id}>
                    <div
                      role="button"
                      tabIndex={-1}
                      title="Eliminar dependencia"
                      className="group/dep absolute z-30 cursor-pointer"
                      style={{
                        left: Math.min(a.x1, midX),
                        width: Math.max(8, Math.abs(a.x1 - midX)),
                        top: a.y1 - 7,
                        height: 14,
                      }}
                      onClick={handleDelete}
                    >
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-px text-[10px] font-medium text-destructive opacity-0 shadow-sm transition-opacity group-hover/dep:opacity-100 whitespace-nowrap">
                        <X className="h-2.5 w-2.5" /> Eliminar
                      </span>
                    </div>
                    {Math.abs(a.y2 - a.y1) > 4 && (
                      <div
                        role="button"
                        tabIndex={-1}
                        title="Eliminar dependencia"
                        className="group/dep absolute z-30 cursor-pointer"
                        style={{
                          left: midX - 7,
                          width: 14,
                          top: Math.min(a.y1, a.y2),
                          height: Math.abs(a.y2 - a.y1),
                        }}
                        onClick={handleDelete}
                      >
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-px text-[10px] font-medium text-destructive opacity-0 shadow-sm transition-opacity group-hover/dep:opacity-100 whitespace-nowrap">
                          <X className="h-2.5 w-2.5" /> Eliminar
                        </span>
                      </div>
                    )}
                    <div
                      role="button"
                      tabIndex={-1}
                      title="Eliminar dependencia"
                      className="group/dep absolute z-30 cursor-pointer"
                      style={{
                        left: Math.min(midX, a.x2),
                        width: Math.max(8, Math.abs(midX - a.x2)),
                        top: a.y2 - 7,
                        height: 14,
                      }}
                      onClick={handleDelete}
                    >
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-px text-[10px] font-medium text-destructive opacity-0 shadow-sm transition-opacity group-hover/dep:opacity-100 whitespace-nowrap">
                        <X className="h-2.5 w-2.5" /> Eliminar
                      </span>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Legend
        showCriticalPath={filters.showCriticalPath}
        milestoneCount={milestones.length}
        areas={areas}
        colorBy={filters.colorBy}
      />

      {/* Dependency delete confirmation popover */}
      {deleteDepState && (
        <div
          className="fixed z-[9999] w-52 rounded-xl border border-border bg-card p-3 shadow-xl"
          style={{ left: deleteDepState.x, top: deleteDepState.y }}
        >
          <p className="mb-3 text-[12px] font-medium text-foreground">¿Eliminar esta dependencia?</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteDepState(null)}
              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => deleteDep.mutate(deleteDepState.id)}
              className="rounded-lg bg-destructive px-2.5 py-1 text-[11px] font-medium text-destructive-foreground"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MilestonesHeader({
  milestones,
}: {
  milestones: { id: string; name: string; date: string }[];
}) {
  if (milestones.length === 0) return null;
  return (
    <div className="flex border-b border-border bg-card">
      <div
        className="sticky left-0 z-20 shrink-0 bg-card px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        style={{ width: LEFT_COL }}
      >
        Hitos
      </div>
      <div className="relative flex-1" style={{ height: MILESTONE_H, minWidth: MIN_TIMELINE_W }}>
        {milestones.map((m) => {
          const f = dateToFraction(m.date);
          return (
            <div
              key={m.id}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
              style={{ left: `${f * 100}%` }}
              title={`${m.name} · ${m.date}`}
            >
              <Diamond className="h-4 w-4 fill-module text-module" strokeWidth={1.5} />
              <span className="pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background opacity-0 group-hover:opacity-100">
                {m.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArrowPath({
  arrow,
}: {
  arrow: { x1: number; y1: number; x2: number; y2: number; critical: boolean };
}) {
  const { x1, y1, x2, y2, critical } = arrow;
  const strokeClass = critical ? "stroke-destructive" : "stroke-slate-500";
  const dotClass = critical ? "fill-destructive" : "fill-slate-500";
  const sw = critical ? 2.2 : 1.7;
  const markerId = critical ? "arrow-critical" : "arrow-default";
  // Cubic bezier: exits rightward from pill end (x1), enters rightward at pill start (x2).
  // dx drives the curve tightness — large enough to visually separate the exit/entry tangents.
  const dx = Math.min(160, Math.max(40, Math.abs(x2 - x1) * 0.5));
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  return (
    <g>
      <circle cx={x1} cy={y1} r={3.5} className={dotClass} />
      <path d={d} fill="none" strokeWidth={sw} className={strokeClass} markerEnd={`url(#${markerId})`} />
    </g>
  );
}

function Legend({
  showCriticalPath,
  milestoneCount,
  areas,
  colorBy,
}: {
  showCriticalPath: boolean;
  milestoneCount: number;
  areas: Area[];
  colorBy: "area" | "status";
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-module" /> Hoy
      </span>
      {milestoneCount > 0 && (
        <span className="flex items-center gap-1">
          <Diamond className="h-3 w-3 fill-module text-module" strokeWidth={1.5} /> Hito
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-4 rounded-sm bg-muted-foreground/60" /> Dependencia
      </span>
      {showCriticalPath && (
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-destructive" /> Ruta crítica
        </span>
      )}
      {colorBy === "status" && (
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {Object.entries(statusMap).map(([status, meta]) => {
            const Icon = meta.icon;
            return (
              <span key={status} className={cn("flex items-center gap-1", STATUS_BAR[status] ?? STATUS_BAR.to_do)}>
                <Icon className="h-3 w-3" strokeWidth={2} />
                {meta.label}
              </span>
            );
          })}
        </span>
      )}
      {colorBy === "area" && (
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {areas.map((a) => (
            <span key={a.id} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: a.color }}
              />
              {a.name}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function ObjectiveRowLeft({
  objective,
  onAdd,
}: {
  objective: Objective;
  onAdd?: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(objective.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const updateTitle = useMutation({
    mutationFn: async (newTitle: string) => {
      const { error } = await supabase
        .from("objectives")
        .update({ title: newTitle })
        .eq("id", objective.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: objectivesQuery().queryKey });
      toast.success("Objetivo actualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createInit = useMutation({
    mutationFn: async (t: string) => {
      const today = clampDateISO(new Date().toISOString().slice(0, 10));
      const end = clampDateISO(addDaysISO(today, 14));
      const { data: existing } = await supabase
        .from("initiatives")
        .select("order_index")
        .eq("objective_id", objective.id)
        .order("order_index", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;
      const { error } = await supabase.from("initiatives").insert({
        objective_id: objective.id,
        title: t,
        status: denormalizeStatus("to_do") as never,
        start_date: today,
        end_date: end,
        order_index: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: initiativesQuery().queryKey });
      setNewTitle("");
      setCreating(false);
      toast.success("Iniciativa creada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (!editing) setTitle(objective.title);
  }, [objective.title, editing]);

  const commit = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== objective.title) updateTitle.mutate(trimmed);
    else setTitle(objective.title);
    setEditing(false);
  };

  const submitCreate = () => {
    const t = newTitle.trim();
    if (!t) {
      setCreating(false);
      return;
    }
    createInit.mutate(t);
  };

  return (
    <div
      className="flex items-center gap-2 border-b border-border bg-muted/30 px-4"
      style={{ height: ROW_H }}
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: objective.color }}
      />
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {objective.code}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setTitle(objective.title);
              setEditing(false);
            }
          }}
          className="flex-1 rounded-md border border-primary/40 bg-card px-2 py-1 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/30"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={objective.title}
          className="flex-1 truncate text-left text-sm font-semibold text-foreground transition hover:text-primary"
        >
          {objective.title}
        </button>
      )}
      {creating ? (
        <input
          autoFocus
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onBlur={submitCreate}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitCreate();
            if (e.key === "Escape") {
              setNewTitle("");
              setCreating(false);
            }
          }}
          placeholder="Nombre de iniciativa…"
          className="w-44 rounded-md border border-primary/40 bg-card px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-primary/30"
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          title="Añadir iniciativa a este objetivo"
          className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-card px-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
          Iniciativa
        </button>
      )}
    </div>
  );
}

function InitiativeRowLeft({
  initiative,
  critical,
  expanded,
  onToggle,
  onEdit,
}: {
  initiative: Initiative;
  critical: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
}) {
  const queryClient = useQueryClient();
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initiative.title);

  const updateTitle = useMutation({
    mutationFn: async (t: string) => {
      const { error } = await supabase
        .from("initiatives")
        .update({ title: t })
        .eq("id", initiative.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: initiativesQuery().queryKey });
      toast.success("Iniciativa actualizada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("initiatives")
        .delete()
        .eq("id", initiative.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: initiativesQuery().queryKey });
      queryClient.invalidateQueries({ queryKey: contributionsQuery().queryKey });
      queryClient.invalidateQueries({ queryKey: dependenciesQuery().queryKey });
      toast.success("Iniciativa eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (!editing) setTitle(initiative.title);
  }, [initiative.title, editing]);

  const commit = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== initiative.title) updateTitle.mutate(trimmed);
    else setTitle(initiative.title);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "group/init relative flex items-start gap-2 overflow-hidden border-b border-border px-4 pl-3 py-1.5",
        critical && "bg-destructive/5",
      )}
      style={{ height: ROW_H }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title={expanded ? "Contraer áreas" : "Expandir áreas y actividades"}
      >
        <Chevron className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setTitle(initiative.title);
              setEditing(false);
            }
          }}
          className="flex-1 rounded-md border border-primary/40 bg-card px-2 py-1 text-[13px] font-medium text-foreground outline-none focus:ring-1 focus:ring-primary/30"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          onDoubleClick={onEdit}
          className="flex-1 text-left text-[13px] font-medium leading-tight text-foreground hover:text-primary"
          title={`${initiative.title} — clic para renombrar · doble clic para detalles`}
        >
          {initiative.title}
        </button>
      )}
      <InlineConfirm
        message={`¿Eliminar "${initiative.title}"? No se puede deshacer.`}
        onConfirm={() => remove.mutate()}
        title="Eliminar iniciativa"
        triggerClassName="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover/init:opacity-100"
      >
        <Trash2 className="h-3 w-3" strokeWidth={2} />
      </InlineConfirm>
    </div>
  );
}

const FY_YEAR = 2026;
function monthStartISO(m: number) {
  return `${FY_YEAR}-${String(m + 1).padStart(2, "0")}-01`;
}
function monthEndISO(m: number) {
  const last = new Date(Date.UTC(FY_YEAR, m + 1, 0)).getUTCDate();
  return `${FY_YEAR}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}
function defaultMonthIndex(): number {
  const now = new Date();
  if (now.getUTCFullYear() !== FY_YEAR) return 0;
  return now.getUTCMonth();
}

function InlineCreateActivity({
  initiativeId,
  areaId,
}: {
  initiativeId: string;
  areaId: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState<number>(defaultMonthIndex());

  const create = useMutation({
    mutationFn: async (vals: { title: string; month: number }) => {
      const start = clampDateISO(monthStartISO(vals.month));
      const end = clampDateISO(monthEndISO(vals.month));
      const { error } = await supabase.from("contributions").insert({
        initiative_id: initiativeId,
        area_id: areaId,
        title: vals.title,
        status: denormalizeStatus("to_do") as never,
        start_date: start,
        end_date: end,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contributionsQuery().queryKey });
      setTitle("");
      setMonth(defaultMonthIndex());
      setOpen(false);
      toast.success("Actividad creada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancel = () => {
    setTitle("");
    setOpen(false);
  };

  const submit = () => {
    const t = title.trim();
    if (!t) {
      cancel();
      return;
    }
    create.mutate({ title: t, month });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Añadir actividad a esta área"
        className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-card px-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
      >
        <Plus className="h-3 w-3" strokeWidth={2} />
        Actividad
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          submit();
        }
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") cancel();
        }}
        placeholder="Nombre de actividad…"
        className="w-40 rounded-md border border-primary/40 bg-card px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-primary/30"
      />
      <select
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        title="Mes (duración por defecto: 1 mes)"
        className="rounded-md border border-border bg-card px-1.5 py-1 text-[11px] outline-none focus:border-primary/40"
      >
        {MONTH_LABELS.map((m, idx) => (
          <option key={m} value={idx}>
            {m}
          </option>
        ))}
      </select>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          cancel();
        }}
        title="Cancelar"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-3 w-3" strokeWidth={2} />
      </button>
    </div>
  );
}

function InlineCreateActivityWithArea({
  initiativeId,
  areas,
}: {
  initiativeId: string;
  areas: Area[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState<string>(areas[0]?.id ?? "");
  const [month, setMonth] = useState<number>(defaultMonthIndex());

  const create = useMutation({
    mutationFn: async (vals: { title: string; month: number; areaId: string }) => {
      const start = clampDateISO(monthStartISO(vals.month));
      const end = clampDateISO(monthEndISO(vals.month));
      const { error } = await supabase.from("contributions").insert({
        initiative_id: initiativeId,
        area_id: vals.areaId,
        title: vals.title,
        status: denormalizeStatus("to_do") as never,
        start_date: start,
        end_date: end,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contributionsQuery().queryKey });
      setTitle("");
      setMonth(defaultMonthIndex());
      setOpen(false);
      toast.success("Actividad creada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancel = () => {
    setTitle("");
    setOpen(false);
  };

  const submit = () => {
    const t = title.trim();
    if (!t || !areaId) {
      cancel();
      return;
    }
    create.mutate({ title: t, month, areaId });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          if (!areaId && areas[0]) setAreaId(areas[0].id);
          setOpen(true);
        }}
        title="Añadir actividad"
        className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-border bg-card px-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
      >
        <Plus className="h-3 w-3" strokeWidth={2} />
        Añadir actividad
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          submit();
        }
      }}
    >
      <select
        value={areaId}
        onChange={(e) => setAreaId(e.target.value)}
        title="Área"
        className="rounded-md border border-border bg-card px-1.5 py-1 text-[11px] outline-none focus:border-primary/40"
      >
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") cancel();
        }}
        placeholder="Nombre de actividad…"
        className="w-36 rounded-md border border-primary/40 bg-card px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-primary/30"
      />
      <select
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        title="Mes"
        className="rounded-md border border-border bg-card px-1.5 py-1 text-[11px] outline-none focus:border-primary/40"
      >
        {MONTH_LABELS.map((m, idx) => (
          <option key={m} value={idx}>
            {m}
          </option>
        ))}
      </select>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          cancel();
        }}
        title="Cancelar"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-3 w-3" strokeWidth={2} />
      </button>
    </div>
  );
}


function InlineEditActivityBar({
  contribution,
  color,
  colorBy,
  style,
  isDragging,
  onPointerDownDrag,
  onOpenDetails,
}: {
  contribution: Contribution;
  color: string;
  colorBy: "area" | "status";
  style: React.CSSProperties;
  isDragging: boolean;
  onPointerDownDrag: (e: React.PointerEvent, mode: DragMode) => void;
  onOpenDetails: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const initial = contribution.title || contribution.description || "";
  const [title, setTitle] = useState(initial);

  const update = useMutation({
    mutationFn: async (t: string) => {
      const { error } = await supabase
        .from("contributions")
        .update({ title: t })
        .eq("id", contribution.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contributionsQuery().queryKey });
      toast.success("Actividad actualizada");
    },
    onError: (err: Error) => toast.error(err.message),
  });


  const commit = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== initial) update.mutate(trimmed);
    else setTitle(initial);
    setEditing(false);
  };

  const baseStyle: React.CSSProperties = {
    ...style,
    background: hexToRgba(color, 0.16),
    borderColor: hexToRgba(color, 0.55),
    color,
  };
  const useStatusColor = colorBy === "status";
  const StatusIcon = CONTRIB_STATUS_ICON[contribution.status] ?? CircleDashed;
  const contribBarClass = CONTRIB_STATUS_BAR[contribution.status] ?? CONTRIB_STATUS_BAR.to_do;

  if (editing) {
    return (
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setTitle(initial);
            setEditing(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "absolute rounded-md border px-2 text-[11px] font-medium leading-[20px] outline-none focus:ring-1 focus:ring-primary/30",
          useStatusColor && contribBarClass,
        )}
        style={useStatusColor ? style : baseStyle}
      />
    );
  }

  const label = initial || "Sin título";
  return (
    <div
      className={cn(
        "group/bar absolute flex items-stretch rounded-md border text-[11px] font-medium leading-[20px] transition",
        useStatusColor && contribBarClass,
        isDragging ? "shadow-md ring-2 ring-ring/40" : "hover:brightness-95 hover:shadow-sm",
      )}
      style={useStatusColor ? style : baseStyle}
      title={`${label} · ${contribution.start_date} → ${contribution.end_date} · clic = renombrar · doble clic = detalles · arrastrar = mover`}
    >
      <span
        onPointerDown={(e) => onPointerDownDrag(e, "resize-left")}
        className="w-1.5 shrink-0 cursor-ew-resize rounded-l-md opacity-0 group-hover/bar:opacity-100 bg-foreground/20"
      />
      <button
        type="button"
        onPointerDown={(e) => onPointerDownDrag(e, "move")}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditing(false);
          onOpenDetails();
        }}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-1.5 px-1.5 text-left active:cursor-grabbing focus:outline-none"
      >
        <StatusIcon className="h-3 w-3 shrink-0" strokeWidth={2.25} />
        <span className="truncate">{label}</span>
      </button>
      <span
        onPointerDown={(e) => onPointerDownDrag(e, "resize-right")}
        className="w-1.5 shrink-0 cursor-ew-resize rounded-r-md opacity-0 group-hover/bar:opacity-100 bg-foreground/20"
      />
    </div>
  );
}

function InlineConfirm({
  message,
  onConfirm,
  triggerClassName,
  title,
  children,
}: {
  message: string;
  onConfirm: () => void;
  triggerClassName?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element)?.closest("[data-inline-confirm]")) setPos(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pos]);

  const handleClick = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ x: rect.left, y: rect.bottom + 4 });
  };

  return (
    <div data-inline-confirm="" className="relative inline-flex">
      <button ref={btnRef} type="button" onClick={handleClick} className={triggerClassName} title={title}>
        {children}
      </button>
      {pos && (
        <div
          className="fixed z-[9999] w-52 rounded-xl border border-border bg-card p-3 shadow-xl"
          style={{ left: pos.x, top: pos.y }}
        >
          <p className="mb-3 text-[12px] font-medium text-foreground">{message}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPos(null)}
              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => { onConfirm(); setPos(null); }}
              className="rounded-lg bg-destructive px-2.5 py-1 text-[11px] font-medium text-destructive-foreground"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

