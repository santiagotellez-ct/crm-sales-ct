import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  amigos: boolean;
  onChange: (amigos: boolean, note?: string) => void;
}

export function AmigosSelect({ amigos, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const cls = amigos
    ? "bg-score-high/15 text-score-high border-score-high/30"
    : "bg-muted text-muted-foreground border-border";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (amigos) {
      onChange(false);
    } else {
      setNote("");
      setOpen(true);
    }
  };

  const confirm = () => {
    onChange(true, note);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`${cls} border font-semibold h-7 px-2.5 text-xs rounded-md transition-colors hover:opacity-80`}
      >
        {amigos ? "Sí" : "No"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Marcar como amigos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Añade una nota sobre la relación (quién es el amigo, cómo se conecta, etc.)
          </p>
          <Textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Juan conoce al CTO desde 2019..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={confirm} disabled={!note.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}