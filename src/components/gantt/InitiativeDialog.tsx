import { useEffect, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { supabase } from "@/integrations/supabase/client";
import {
  areasQuery,
  initiativesQuery,
  objectivesQuery,
  denormalizeStatus,
  type Initiative,
} from "@/lib/roadmap-queries";
import { STATUS_OPTIONS, statusMap, type StatusKey } from "@/components/ui-kit";

export type InitiativeDialogState =
  | { mode: "create"; objectiveId?: string }
  | { mode: "edit"; initiative: Initiative }
  | null;

type FormState = {
  title: string;
  description: string;
  objective_id: string;
  owner_area_id: string;
  status: StatusKey;
  start_date: string;
  end_date: string;
};

const EMPTY: FormState = {
  title: "",
  description: "",
  objective_id: "",
  owner_area_id: "",
  status: "to_do",
  start_date: "2026-01-01",
  end_date: "2026-03-31",
};

function fromInitiative(i: Initiative): FormState {
  return {
    title: i.title,
    description: i.description ?? "",
    objective_id: i.objective_id,
    owner_area_id: i.owner_area_id ?? "",
    status: i.status as StatusKey, // already normalized by initiativesQuery
    start_date: i.start_date,
    end_date: i.end_date,
  };
}

export function InitiativeDialog({
  state,
  onOpenChange,
}: {
  state: InitiativeDialogState;
  onOpenChange: (open: boolean) => void;
}) {
  const open = state !== null;
  const isEdit = state?.mode === "edit";
  const { data: objectives } = useSuspenseQuery(objectivesQuery());
  const { data: areas } = useSuspenseQuery(areasQuery());
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (state?.mode === "edit") setForm(fromInitiative(state.initiative));
    else if (state?.mode === "create") {
      setForm({
        ...EMPTY,
        objective_id: state.objectiveId ?? objectives[0]?.id ?? "",
      });
    }
  }, [state, objectives]);

  const upsert = useMutation({
    mutationFn: async (values: FormState) => {
      if (!values.title.trim()) throw new Error("El título es obligatorio");
      if (!values.objective_id) throw new Error("Selecciona un objetivo");
      if (values.end_date < values.start_date)
        throw new Error("La fecha fin debe ser posterior a la fecha inicio");

      const payload = {
        title: values.title.trim(),
        description: values.description.trim() || null,
        objective_id: values.objective_id,
        owner_area_id: values.owner_area_id || null,
        status: denormalizeStatus(values.status) as never,
        start_date: values.start_date,
        end_date: values.end_date,
      };

      if (isEdit && state?.mode === "edit") {
        const { error } = await supabase
          .from("initiatives")
          .update(payload)
          .eq("id", state.initiative.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("initiatives").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async (_data, values) => {
      if (isEdit && state?.mode === "edit") {
        queryClient.setQueryData<Initiative[]>(initiativesQuery().queryKey, (current) =>
          current?.map((item) =>
            item.id === state.initiative.id
              ? { ...item, ...values, owner_area_id: values.owner_area_id || null }
              : item,
          ),
        );
      }
      await queryClient.invalidateQueries({ queryKey: initiativesQuery().queryKey });
      toast.success(isEdit ? "Iniciativa actualizada" : "Iniciativa creada");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (state?.mode !== "edit") return;
      const { error } = await supabase
        .from("initiatives")
        .delete()
        .eq("id", state.initiative.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: initiativesQuery().queryKey });
      toast.success("Iniciativa eliminada");
      setConfirmDelete(false);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar iniciativa" : "Nueva iniciativa"}
            </DialogTitle>
            <DialogDescription>
              Asigna objetivo, área responsable, estado y duración.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej. Lanzar MVP B2C"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Breve contexto de la iniciativa…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Objetivo</Label>
                <Select
                  value={form.objective_id}
                  onValueChange={(v) => setForm({ ...form, objective_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {objectives.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.code} · {o.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Área responsable</Label>
                <Select
                  value={form.owner_area_id || "__none"}
                  onValueChange={(v) =>
                    setForm({ ...form, owner_area_id: v === "__none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sin asignar</SelectItem>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Estado</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as StatusKey })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => {
                      const Icon = statusMap[o.value].icon;
                      return (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                          {o.label}
                        </span>
                      </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="start">Inicio</Label>
                <Input
                  id="start"
                  type="date"
                  min="2026-01-01"
                  max="2026-12-31"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end">Fin</Label>
                <Input
                  id="end"
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
                  onClick={() => setConfirmDelete(true)}
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
                {isEdit ? "Guardar cambios" : "Crear iniciativa"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta iniciativa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán también sus
              contribuciones y dependencias asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
