import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StatusKey } from "@/components/ui-kit";

export const FY_START = new Date(Date.UTC(2026, 0, 1));   // 1 Ene 2026
export const FY_END = new Date(Date.UTC(2026, 11, 31));   // 31 Dic 2026
export const FY_MONTHS = 12;

export type Area = {
  id: string;
  key: string | null;
  name: string;
  color: string;
  order_index: number;
};

export type Contribution = {
  id: string;
  initiative_id: string;
  area_id: string;
  title: string | null;
  description: string | null;
  status: string;
  start_date: string;
  end_date: string;
};

export type Objective = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  color: string;
  order_index: number;
};

export type KeyResult = {
  id: string;
  objective_id: string;
  title: string;
  target: number | null;
  current_value: number | null;
  baseline: number | null;
  unit: string | null;
  status: StatusKey | null;
  q1_target: string | null;
  q2_target: string | null;
  q3_target: string | null;
  q4_target: string | null;
  order_index: number;
};

export type Initiative = {
  id: string;
  objective_id: string;
  owner_area_id: string | null;
  title: string;
  description: string | null;
  status: StatusKey;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  order_index: number;
};

export type CompanyMetric = {
  id: string;
  key: string;
  label: string;
  value: number | null;
  target: number | null;
  unit: string | null;
  q1_target: number | null;
  q2_target: number | null;
  q3_target: number | null;
  q4_target: number | null;
  total_label: string | null;
  order_index: number;
};

export type Milestone = {
  id: string;
  name: string;
  date: string;
  objective_id: string | null;
  order_index: number;
};

export type Dependency = {
  id: string;
  from_initiative_id: string;
  to_initiative_id: string;
  type: "finish_to_start" | "start_to_start" | "finish_to_finish";
};

async function selectAll<T>(promise: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await promise;
  if (error) throw error;
  return (data ?? []) as T[];
}

// Bijective mapping between DB enum values (Spanish) and UI values (English).
// The DB initiative_status enum cannot be changed without a migration, so we map
// at the application layer instead: normalize on read, denormalize on write.
const FROM_DB: Record<string, string> = {
  planeado:    "to_do",
  en_curso:    "in_dev",
  en_riesgo:   "in_qa",
  bloqueado:   "in_design",
  hecho:       "completed",
  in_progress: "in_dev", // legacy fallback
};

const TO_DB: Record<string, string> = {
  to_do:       "planeado",
  in_dev:      "en_curso",
  in_qa:       "en_riesgo",
  in_design:   "bloqueado",
  completed:   "hecho",
  in_progress: "en_curso", // legacy fallback
};

export function normalizeStatus(s: string): string {
  return FROM_DB[s] ?? s;
}

export function denormalizeStatus(s: string): string {
  return TO_DB[s] ?? s;
}

export const areasQuery = () =>
  queryOptions({
    queryKey: ["areas"],
    queryFn: () => selectAll<Area>(supabase.from("areas").select("*").order("order_index")),
  });

export const objectivesQuery = () =>
  queryOptions({
    queryKey: ["objectives"],
    queryFn: () => selectAll<Objective>(supabase.from("objectives").select("*").order("order_index")),
  });

export const keyResultsQuery = () =>
  queryOptions({
    queryKey: ["key_results"],
    queryFn: () => selectAll<KeyResult>(supabase.from("key_results").select("*").order("order_index")),
  });

export const initiativesQuery = () =>
  queryOptions({
    queryKey: ["initiatives"],
    queryFn: async () => {
      const rows = await selectAll<Initiative>(supabase.from("initiatives").select("*").order("order_index"));
      return rows.map((i) => ({ ...i, status: normalizeStatus(i.status) as StatusKey }));
    },
  });

export const metricsQuery = () =>
  queryOptions({
    queryKey: ["company_metrics"],
    queryFn: () => selectAll<CompanyMetric>(supabase.from("company_metrics").select("*").order("order_index")),
  });

export const milestonesQuery = () =>
  queryOptions({
    queryKey: ["milestones"],
    queryFn: () => selectAll<Milestone>(supabase.from("milestones").select("*").order("date")),
  });

export const dependenciesQuery = () =>
  queryOptions({
    queryKey: ["dependencies"],
    queryFn: () => selectAll<Dependency>(supabase.from("dependencies").select("*")),
  });

export const contributionsQuery = () =>
  queryOptions({
    queryKey: ["contributions"],
    queryFn: async () => {
      const rows = await selectAll<Contribution>(supabase.from("contributions").select("*"));
      return rows.map((c) => ({ ...c, status: normalizeStatus(c.status) }));
    },
  });

// Helpers for Gantt positioning (0..1 across FY)
const DAY_MS = 86_400_000;
export const FY_TOTAL_MS = FY_END.getTime() - FY_START.getTime();
export const FY_TOTAL_DAYS = Math.round(FY_TOTAL_MS / DAY_MS);

export function dateToFraction(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z").getTime();
  return Math.max(0, Math.min(1, (d - FY_START.getTime()) / FY_TOTAL_MS));
}

export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z").getTime() + days * DAY_MS;
  return new Date(d).toISOString().slice(0, 10);
}

export function clampDateISO(dateStr: string): string {
  const t = new Date(dateStr + "T00:00:00Z").getTime();
  const clamped = Math.max(FY_START.getTime(), Math.min(FY_END.getTime(), t));
  return new Date(clamped).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / DAY_MS,
  );
}

export const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"];

export function todayFraction(): number {
  return dateToFraction(new Date().toISOString().slice(0, 10));
}

/**
 * Compute the critical path: longest chain (by total duration in days) through
 * the DAG of initiatives connected by dependencies (from → to = predecessor → successor).
 * Returns a Set of initiative IDs that participate in that longest path.
 */
export function computeCriticalPath(
  initiatives: Initiative[],
  deps: Dependency[],
): Set<string> {
  const byId = new Map(initiatives.map((i) => [i.id, i]));
  const successors = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const i of initiatives) {
    successors.set(i.id, []);
    inDeg.set(i.id, 0);
  }
  for (const d of deps) {
    if (!byId.has(d.from_initiative_id) || !byId.has(d.to_initiative_id)) continue;
    successors.get(d.from_initiative_id)!.push(d.to_initiative_id);
    inDeg.set(d.to_initiative_id, (inDeg.get(d.to_initiative_id) ?? 0) + 1);
  }
  // topo sort
  const order: string[] = [];
  const queue: string[] = [];
  for (const [id, deg] of inDeg) if (deg === 0) queue.push(id);
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of successors.get(id) ?? []) {
      const nd = (inDeg.get(s) ?? 0) - 1;
      inDeg.set(s, nd);
      if (nd === 0) queue.push(s);
    }
  }
  // longest path
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  for (const i of initiatives) {
    dist.set(i.id, daysBetween(i.start_date, i.end_date));
    prev.set(i.id, null);
  }
  for (const id of order) {
    const cur = dist.get(id) ?? 0;
    for (const s of successors.get(id) ?? []) {
      const dur = daysBetween(byId.get(s)!.start_date, byId.get(s)!.end_date);
      if (cur + dur > (dist.get(s) ?? 0)) {
        dist.set(s, cur + dur);
        prev.set(s, id);
      }
    }
  }
  let endId: string | null = null;
  let best = -1;
  for (const [id, d] of dist) {
    if (d > best) {
      best = d;
      endId = id;
    }
  }
  const path = new Set<string>();
  let cur: string | null = endId;
  while (cur) {
    path.add(cur);
    cur = prev.get(cur) ?? null;
  }
  return path;
}

/** Detect if adding (from → to) would create a cycle in the dependency graph. */
export function wouldCreateCycle(
  from: string,
  to: string,
  deps: Dependency[],
): boolean {
  if (from === to) return true;
  const adj = new Map<string, string[]>();
  for (const d of deps) {
    if (!adj.has(d.from_initiative_id)) adj.set(d.from_initiative_id, []);
    adj.get(d.from_initiative_id)!.push(d.to_initiative_id);
  }
  // BFS from `to` — if we can reach `from`, adding from→to closes a cycle.
  const visited = new Set<string>();
  const queue = [to];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === from) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const n of adj.get(cur) ?? []) queue.push(n);
  }
  return false;
}
