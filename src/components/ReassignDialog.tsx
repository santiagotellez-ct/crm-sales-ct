import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sdr, SDR_OPTIONS, ContactedFrom, CONTACTED_FROM_OPTIONS } from "@/types/company";

interface Props {
  open: boolean;
  companyName: string;
  currentSdr: Sdr | null;
  currentLinkedin: ContactedFrom | null;
  onOpenChange: (o: boolean) => void;
  onConfirm: (payload: { sdr: Sdr | null; linkedinAccount: ContactedFrom | null }) => Promise<void> | void;
}

const NONE = "__none";

export function ReassignDialog({ open, companyName, currentSdr, currentLinkedin, onOpenChange, onConfirm }: Props) {
  const [sdr, setSdr] = useState<string>(currentSdr ?? NONE);
  const [linkedin, setLinkedin] = useState<string>(currentLinkedin ?? NONE);

  // Reset when reopened
  const handleOpenChange = (o: boolean) => {
    if (o) {
      setSdr(currentSdr ?? NONE);
      setLinkedin(currentLinkedin ?? NONE);
    }
    onOpenChange(o);
  };

  const handleConfirm = async () => {
    await onConfirm({
      sdr: sdr === NONE ? null : (sdr as Sdr),
      linkedinAccount: linkedin === NONE ? null : (linkedin as ContactedFrom),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reasignar prospección</DialogTitle>
          <DialogDescription>
            Inicia una nueva secuencia para <strong>{companyName}</strong>. El historial del SDR anterior se conserva.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Nuevo SDR</label>
            <Select value={sdr} onValueChange={setSdr}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin asignar</SelectItem>
                {SDR_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Cuenta de LinkedIn</label>
            <Select value={linkedin} onValueChange={setLinkedin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin definir</SelectItem>
                {CONTACTED_FROM_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm}>Reasignar y volver a "Por contactar"</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}