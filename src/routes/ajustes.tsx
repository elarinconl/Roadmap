import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/ajustes")({
  head: () => ({ meta: [{ title: "Ajustes · FY2026" }] }),
  component: () => (
    <AppShell>
      <PageHeader
        icon={Settings}
        title="Ajustes"
        subtitle="Áreas, colores y preferencias del módulo"
      />
      <EmptyState
        icon={Settings}
        title="Ajustes en la Fase 6"
        description="Configura las 4 áreas, sus colores y otros parámetros del módulo de Planeación."
      />
    </AppShell>
  ),
});
