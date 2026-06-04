import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { objectivesQuery, type Objective } from "@/lib/roadmap-queries";

export type ObjectiveDialogState =
  | { mode: "create" }
  | { mode: "edit"; objective: Objective }
  | null;

const COLORS = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

type FormState = {
  code: string;
  title: string;
  description: string;
  color: string;
};

const EMPTY: FormState = { code: "", title: "", description: "", color: COLORS[0] };

export function ObjectiveDialog({
  state,
  onOpenChange,
}: {
  state: ObjectiveDialogState;
  onOpenChange: (open: boolean) => void;
}) {
  const open = state !== null;
  const isEdit = state?.mode === "edit";
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (state?.mode === "edit") {
      const o = state.objective;
      setForm({
        code: o.code,
        title: o.title,
        description: o.description ?? "",
        color: o.color,
      });
    } else if (state?.mode === "create") {
      setForm(EMPTY);
    }
  }, [state]);

  const upsert = useMutation({
    mutationFn: async (values: FormState) => {
      if (!values.code.trim()) throw new Error("El código es obligatorio");
      if (!values.title.trim()) throw new Error("El título es obligatorio");
      const payload = {
        code: values.code.trim(),
        title: values.title.trim(),
        description: values.description.trim() || null,
        color: values.color,
      };
      if (isEdit && state?.mode === "edit") {
        const { error } = await supabase
          .from("objectives")
          .update(payload)
          .eq("id", state.objective.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("objectives").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: objectivesQuery().queryKey });
      toast.success(isEdit ? "Objetivo actualizado" : "Objetivo creado");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (state?.mode !== "edit") return;
      const { error } = await supabase
        .from("objectives")
        .delete()
        .eq("id", state.objective.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: objectivesQuery().queryKey });
      toast.success("Objetivo eliminado");
      setConfirmDelete(false);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar objetivo" : "Nuevo objetivo"}</DialogTitle>
            <DialogDescription>
              Los objetivos agrupan iniciativas y key results.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div className="grid gap-2">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="O1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Lanzar MVP B2C"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="desc">Descripción</Label>
              <Textarea
                id="desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-7 w-7 rounded-full border-2 transition ${
                      form.color === c ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
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
            <AlertDialogTitle>¿Eliminar este objetivo?</AlertDialogTitle>
            <AlertDialogDescription>
              También se eliminarán sus key results e iniciativas asociadas.
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
