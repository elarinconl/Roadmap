import { useEffect, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
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
  keyResultsQuery,
  objectivesQuery,
  type KeyResult,
} from "@/lib/roadmap-queries";
import type { StatusKey } from "@/components/ui-kit";

export type KeyResultDialogState =
  | { mode: "create"; objectiveId?: string }
  | { mode: "edit"; keyResult: KeyResult }
  | null;

const STATUS_OPTIONS: { value: StatusKey; label: string }[] = [
  { value: "planeado", label: "Planeado" },
  { value: "en_curso", label: "En curso" },
  { value: "en_riesgo", label: "En riesgo" },
  { value: "bloqueado", label: "Bloqueado" },
  { value: "hecho", label: "Hecho" },
];

type FormState = {
  objective_id: string;
  title: string;
  unit: string;
  baseline: string;
  target: string;
  current_value: string;
  status: StatusKey;
};

const EMPTY: FormState = {
  objective_id: "",
  title: "",
  unit: "",
  baseline: "",
  target: "",
  current_value: "",
  status: "planeado",
};

export function KeyResultDialog({
  state,
  onOpenChange,
}: {
  state: KeyResultDialogState;
  onOpenChange: (open: boolean) => void;
}) {
  const open = state !== null;
  const isEdit = state?.mode === "edit";
  const { data: objectives } = useSuspenseQuery(objectivesQuery());
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (state?.mode === "edit") {
      const k = state.keyResult;
      setForm({
        objective_id: k.objective_id,
        title: k.title,
        unit: k.unit ?? "",
        baseline: k.baseline?.toString() ?? "",
        target: k.target?.toString() ?? "",
        current_value: k.current_value?.toString() ?? "",
        status: (k as KeyResult & { status?: StatusKey }).status ?? "planeado",
      });
    } else if (state?.mode === "create") {
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
      const toNum = (s: string) => (s.trim() === "" ? null : Number(s));
      const payload = {
        objective_id: values.objective_id,
        title: values.title.trim(),
        unit: values.unit.trim() || null,
        baseline: toNum(values.baseline),
        target: toNum(values.target),
        current_value: toNum(values.current_value),
        status: values.status,
      };
      if (isEdit && state?.mode === "edit") {
        const { error } = await supabase
          .from("key_results")
          .update(payload)
          .eq("id", state.keyResult.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("key_results").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyResultsQuery().queryKey });
      toast.success(isEdit ? "Key result actualizado" : "Key result creado");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (state?.mode !== "edit") return;
      const { error } = await supabase
        .from("key_results")
        .delete()
        .eq("id", state.keyResult.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyResultsQuery().queryKey });
      toast.success("Key result eliminado");
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
            <DialogTitle>{isEdit ? "Editar key result" : "Nuevo key result"}</DialogTitle>
            <DialogDescription>
              Métrica medible asociada a un objetivo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
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
              <Label htmlFor="krtitle">Título</Label>
              <Input
                id="krtitle"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej. 10k usuarios activos"
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="unit">Unidad</Label>
                <Input
                  id="unit"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="%, MXN…"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="baseline">Base</Label>
                <Input
                  id="baseline"
                  type="number"
                  value={form.baseline}
                  onChange={(e) => setForm({ ...form, baseline: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="current">Actual</Label>
                <Input
                  id="current"
                  type="number"
                  value={form.current_value}
                  onChange={(e) => setForm({ ...form, current_value: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="target">Meta</Label>
                <Input
                  id="target"
                  type="number"
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as StatusKey })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => upsert.mutate(form)} disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Guardar" : "Crear"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este key result?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
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
