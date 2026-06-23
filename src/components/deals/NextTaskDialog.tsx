import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  reason: string;
  onOpenChange: (o: boolean) => void;
  onConfirm: (title: string, dueAt: number) => void;
}

export function NextTaskDialog({ open, reason, onOpenChange, onConfirm }: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  });

  useEffect(() => {
    if (open) {
      setTitle("");
      const d = new Date();
      d.setDate(d.getDate() + 2);
      setDate(d.toISOString().split("T")[0]);
    }
  }, [open]);

  const valid = title.trim() && date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Define la siguiente tarea</DialogTitle>
          <DialogDescription>{reason}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tarea</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Enviar contrato" />
          </div>
          <div>
            <Label className="text-xs">Vence</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!valid}
            onClick={() => onConfirm(title.trim(), new Date(`${date}T09:00`).getTime())}
          >
            Crear tarea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}