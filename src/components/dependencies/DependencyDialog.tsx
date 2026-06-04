import { useEffect, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  dependenciesQuery,
  initiativesQuery,
  wouldCreateCycle,
} from "@/lib/roadmap-queries";

const TYPES = [
  { value: "finish_to_start", label: "Finish → Start (default)" },
  { value: "start_to_start", label: "Start → Start" },
  { value: "finish_to_finish", label: "Finish → Finish" },
] as const;

export function DependencyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: initiatives } = useSuspenseQuery(initiativesQuery());
  const { data: deps } = useSuspenseQuery(dependenciesQuery());
  const queryClient = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<typeof TYPES[number]["value"]>("finish_to_start");

  useEffect(() => {
    if (open) {
      setFrom("");
      setTo("");
      setType("finish_to_start");
    }
  }, [open]);

  const create = useMutation({
    mutationFn: async () => {
      if (!from || !to) throw new Error("Selecciona predecesor y sucesor");
      if (from === to) throw new Error("No puede depender de sí misma");
      if (wouldCreateCycle(from, to, deps)) {
        throw new Error("Esa dependencia crearía un ciclo");
      }
      const exists = deps.some(
        (d) => d.from_initiative_id === from && d.to_initiative_id === to,
      );
      if (exists) throw new Error("Esa dependencia ya existe");
      const { error } = await supabase
        .from("dependencies")
        .insert({ from_initiative_id: from, to_initiative_id: to, type });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependenciesQuery().queryKey });
      toast.success("Dependencia creada");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Nueva dependencia</DialogTitle>
          <DialogDescription>
            La iniciativa sucesora no puede empezar (o terminar) hasta que la
            predecesora cumpla la condición.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Predecesora (from)</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {initiatives.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Sucesora (to)</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {initiatives.map((i) => (
                  <SelectItem key={i.id} value={i.id} disabled={i.id === from}>
                    {i.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
