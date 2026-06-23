import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DealStage } from "@/types/deal";
import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  stages: DealStage[];
  onOpenChange: (o: boolean) => void;
  onSave: (updates: { id: string; name: string; probability: number }[]) => Promise<void> | void;
}

export function StagesConfigDialog({ open, stages, onOpenChange, onSave }: Props) {
  const [local, setLocal] = useState(stages);
  useEffect(() => {
    if (open) setLocal(stages);
  }, [open, stages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar stages</DialogTitle>
          <DialogDescription>
            La probabilidad de cada stage se usa para calcular el forecast (valor × probabilidad).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {local.map((s, i) => (
            <div key={s.id} className="grid grid-cols-[1fr_100px] gap-2 items-center">
              <Input
                value={s.name}
                onChange={(e) =>
                  setLocal((prev) => prev.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))
                }
              />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={s.probability}
                  onChange={(e) =>
                    setLocal((prev) =>
                      prev.map((x, idx) =>
                        idx === i ? { ...x, probability: Math.max(0, Math.min(100, Number(e.target.value))) } : x
                      )
                    )
                  }
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={async () => {
              await onSave(local.map((s) => ({ id: s.id, name: s.name, probability: s.probability })));
              onOpenChange(false);
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}