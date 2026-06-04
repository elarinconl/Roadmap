import { Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LineChart, Target, Loader2 } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader, StatusBadge, type StatusKey } from "@/components/ui-kit";
import {
  metricsQuery,
  objectivesQuery,
  keyResultsQuery,
  QUARTER_LABELS,
  type CompanyMetric,
  type KeyResult,
  type Objective,
} from "@/lib/roadmap-queries";

export const Route = createFileRoute("/metricas")({
  head: () => ({ meta: [{ title: "Métricas · FY2026" }] }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(metricsQuery());
    context.queryClient.ensureQueryData(objectivesQuery());
    context.queryClient.ensureQueryData(keyResultsQuery());
  },
  component: MetricsPage,
});

function MetricsPage() {
  return (
    <AppShell>
      <PageHeader
        icon={LineChart}
        title="Métricas"
        subtitle="Top-line de empresa y key results por objetivo · FY2026"
      />
      <Suspense fallback={<Loading />}>
        <CompanyMetricsTable />
      </Suspense>
      <div className="mt-8">
        <Suspense fallback={<Loading />}>
          <KRsByObjective />
        </Suspense>
      </div>
    </AppShell>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
    </div>
  );
}

function fmt(n: number | null, unit: string | null) {
  if (n === null || n === undefined) return "—";
  const str = Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${str} ${unit}` : str;
}

function CompanyMetricsTable() {
  const { data: metrics } = useSuspenseQuery(metricsQuery());
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Métricas top-line</h2>
          <p className="text-sm text-muted-foreground">Plan trimestral por métrica de empresa.</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left">Métrica</th>
              {QUARTER_LABELS.map((q) => (
                <th key={q} className="px-4 py-2 text-right tabular-nums">{q}</th>
              ))}
              <th className="px-4 py-2 text-right">Total FY</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m: CompanyMetric) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{m.label}</div>
                  {m.unit && (
                    <div className="text-[11px] text-muted-foreground">{m.unit}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(m.q1_target, m.unit)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(m.q2_target, m.unit)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(m.q3_target, m.unit)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(m.q4_target, m.unit)}</td>
                <td className="px-4 py-3 text-right text-foreground font-semibold tabular-nums">
                  {m.total_label ?? fmt(m.target, m.unit)}
                </td>
              </tr>
            ))}
            {metrics.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Aún no hay métricas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KRsByObjective() {
  const { data: objectives } = useSuspenseQuery(objectivesQuery());
  const { data: krs } = useSuspenseQuery(keyResultsQuery());

  const byObj = new Map<string, KeyResult[]>();
  for (const k of krs) {
    if (!byObj.has(k.objective_id)) byObj.set(k.objective_id, []);
    byObj.get(k.objective_id)!.push(k);
  }

  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Key results por objetivo</h2>
          <p className="text-sm text-muted-foreground">Avance medible que sostiene cada objetivo.</p>
        </div>
      </div>
      <div className="space-y-4">
        {objectives.map((o: Objective) => (
          <div key={o.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{o.code}</span>
              <span className="text-sm font-semibold text-foreground">{o.title}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left">Key result</th>
                  <th className="px-4 py-2 text-right tabular-nums">Base</th>
                  <th className="px-4 py-2 text-right tabular-nums">Actual</th>
                  <th className="px-4 py-2 text-right tabular-nums">Meta</th>
                  <th className="px-4 py-2 text-right">Progreso</th>
                  <th className="px-4 py-2 text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(byObj.get(o.id) ?? []).map((k) => {
                  const base = k.baseline ?? 0;
                  const target = k.target ?? 0;
                  const cur = k.current_value ?? 0;
                  const denom = target - base;
                  const pct = denom !== 0 ? Math.max(0, Math.min(1, (cur - base) / denom)) : 0;
                  return (
                    <tr key={k.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{k.title}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmt(k.baseline, k.unit)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(k.current_value, k.unit)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(k.target, k.unit)}</td>
                      <td className="px-4 py-3">
                        <div className="ml-auto flex w-40 items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-module" style={{ width: `${pct * 100}%` }} />
                          </div>
                          <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                            {Math.round(pct * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {k.status ? <StatusBadge status={k.status as StatusKey} /> : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {(byObj.get(o.id) ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Sin key results aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
        {objectives.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-12">
            <Target className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No hay objetivos.</p>
          </div>
        )}
      </div>
    </section>
  );
}
