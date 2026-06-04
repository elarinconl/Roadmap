import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  contributionsQuery,
  areasQuery,
  denormalizeStatus,
  type Contribution,
} from "@/lib/roadmap-queries";

export type ContributionDialogState =
  | {
      mode: "create";
      initiative_id: string;
      area_id: string | null;
      initiativeLabel: string;
      areaLabel: string | null;
    }
  | { mode: "edit"; contribution: Contribution; initiativeLabel: string; areaLabel: string }
  | null;

type FormState = {
  area_id: string;
  title: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
};

const EMPTY: FormState = {
  area_id: "",
  title: "",
  description: "",
  status: "to_do",
  start_date: "2026-01-01",
  end_date: "2026-03-31",
};


const STATUS_DOT: Record<string, string> = {
  to_do:     "bg-gray-400",
  in_design: "bg-purple-500",
  in_dev:    "bg-blue-500",
  in_qa:     "bg-amber-500",
  completed: "bg-green-500",
};

const ACTIVITY_STATUSES = [
  { value: "to_do",      label: "To Do" },
  { value: "in_design",  label: "In Design" },
  { value: "in_dev",     label: "In Dev" },
  { value: "in_qa",      label: "In QA" },
  { value: "completed",  label: "Completed" },
];

export function ContributionDialog({
  state,
  onOpenChange,
}: {
  state: ContributionDialogState;
  onOpenChange: (open: boolean) => void;
}) {
  const open = state !== null;
  const isEdit = state?.mode === "edit";
  const queryClient = useQueryClient();
  const { data: areas } = useSuspenseQuery(areasQuery());
  const [form, setForm] = useState<FormState>(EMPTY);

  const statusOptions = ACTIVITY_STATUSES;

  useEffect(() => {
    if (state?.mode === "edit") {
      setForm({
        area_id: state.contribution.area_id,
        title: state.contribution.title ?? "",
        description: state.contribution.description ?? "",
        status: state.contribution.status, // already normalized by contributionsQuery
        start_date: state.contribution.start_date,
        end_date: state.contribution.end_date,
      });
    } else if (state?.mode === "create") {
      setForm({ ...EMPTY, area_id: state.area_id ?? "" });
    }
  }, [state]);

  const handleAreaChange = (areaId: string) => {
    setForm({ ...form, area_id: areaId });
  };

  const upsert = useMutation({
    mutationFn: async (values: FormState) => {
      if (values.end_date < values.start_date)
        throw new Error("La fecha fin debe ser posterior a la fecha inicio");
      if (!values.title.trim())
        throw new Error("Dale un nombre corto a la actividad");
      if (!values.area_id)
        throw new Error("Elige a qué área pertenece la actividad");

      const dbStatus = denormalizeStatus(values.status) as never;
      if (state?.mode === "edit") {
        const { error } = await supabase
          .from("contributions")
          .update({
            area_id: values.area_id,
            title: values.title.trim(),
            description: values.description.trim() || null,
            status: dbStatus,
            start_date: values.start_date,
            end_date: values.end_date,
          })
          .eq("id", state.contribution.id);
        if (error) throw error;
      } else if (state?.mode === "create") {
        const { error } = await supabase.from("contributions").insert({
          initiative_id: state.initiative_id,
          area_id: values.area_id,
          title: values.title.trim(),
          description: values.description.trim() || null,
          status: dbStatus,
          start_date: values.start_date,
          end_date: values.end_date,
        });
        if (error) throw error;
      }
    },
    onSuccess: async (_data, values) => {
      if (state?.mode === "edit") {
        queryClient.setQueryData<Contribution[]>(contributionsQuery().queryKey, (current) =>
          current?.map((item) =>
            item.id === state.contribution.id
              ? { ...item, ...values, title: values.title.trim(), description: values.description.trim() || null }
              : item,
          ),
        );
      }
      await queryClient.invalidateQueries({ queryKey: contributionsQuery().queryKey });
      toast.success(isEdit ? "Actividad actualizada" : "Actividad creada");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (state?.mode !== "edit") return;
      const { error } = await supabase
        .from("contributions")
        .delete()
        .eq("id", state.contribution.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contributionsQuery().queryKey });
      toast.success("Actividad eliminada");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!state) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar actividad" : "Nueva actividad"}
          </DialogTitle>
          <DialogDescription>
            {state.initiativeLabel}
            {state.mode === "edit" && state.areaLabel ? ` · ${state.areaLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="area">Área responsable</Label>
              <Select
                value={form.area_id}
                onValueChange={handleAreaChange}
              >
                <SelectTrigger id="area">
                  <SelectValue placeholder="Elegir área…" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: a.color }}
                        />
                        {a.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="title">Nombre de la actividad</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej. Migración a CRM v2"
                autoFocus
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="desc">Detalle (opcional)</Label>
            <Textarea
              id="desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Notas, entregables o alcance…"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="inline-flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[o.value] ?? "bg-gray-400"}`} />
                        {o.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-start">Inicio</Label>
              <Input
                id="c-start"
                type="date"
                min="2026-01-01"
                max="2026-12-31"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-end">Fin</Label>
              <Input
                id="c-end"
                type="date"
                min="2026-01-01"
                max="2026-12-31"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between">
          <div>
            {isEdit && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => upsert.mutate(form)}
              disabled={upsert.isPending}
            >
              {upsert.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEdit ? "Guardar cambios" : "Crear"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
