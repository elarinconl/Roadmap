import { Suspense, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { GitBranch, Plus, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader, PrimaryButton, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  dependenciesQuery,
  initiativesQuery,
  type Initiative,
} from "@/lib/roadmap-queries";
import { DependencyDialog } from "@/components/dependencies/DependencyDialog";

export const Route = createFileRoute("/dependencias")({
  head: () => ({ meta: [{ title: "Dependencias · FY2026" }] }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(dependenciesQuery());
    context.queryClient.ensureQueryData(initiativesQuery());
  },
  component: DependenciesPage,
});

function DependenciesPage() {
  const [open, setOpen] = useState(false);
  return (
    <AppShell>
      <PageHeader
        icon={GitBranch}
        title="Dependencias"
        subtitle="Relaciones predecesor → sucesor entre iniciativas"
        actions={
          <PrimaryButton icon={Plus} onClick={() => setOpen(true)}>
            Nueva dependencia
          </PrimaryButton>
        }
      />
      <Suspense fallback={<Loading />}>
        <DependencyList />
      </Suspense>
      <Suspense fallback={null}>
        <DependencyDialog open={open} onOpenChange={setOpen} />
      </Suspense>
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

function DependencyList() {
  const { data: deps } = useSuspenseQuery(dependenciesQuery());
  const { data: initiatives } = useSuspenseQuery(initiativesQuery());
  const queryClient = useQueryClient();
  const byId = new Map<string, Initiative>(initiatives.map((i) => [i.id, i]));

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dependencies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependenciesQuery().queryKey });
      toast.success("Dependencia eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (deps.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title="Sin dependencias"
        description="Aún no hay dependencias entre iniciativas. Crea la primera para reflejar el orden lógico del roadmap."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 text-left">Predecesora</th>
            <th className="px-4 py-2"></th>
            <th className="px-4 py-2 text-left">Sucesora</th>
            <th className="px-4 py-2 text-left">Tipo</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {deps.map((d) => {
            const from = byId.get(d.from_initiative_id);
            const to = byId.get(d.to_initiative_id);
            return (
              <tr key={d.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{from?.title ?? "—"}</td>
                <td className="px-1 py-3 text-muted-foreground"><ArrowRight className="h-4 w-4" /></td>
                <td className="px-4 py-3 font-medium text-foreground">{to?.title ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.type.replace(/_/g, " → ")}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove.mutate(d.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
