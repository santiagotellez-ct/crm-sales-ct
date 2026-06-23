import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useEventsData, EventRecord } from "@/hooks/useEventsData";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function EventsManagerDialog({ open, onOpenChange }: Props) {
  const { events, experiences, createEvent, updateEvent, deleteEvent, createExperience, updateExperience, deleteExperience } = useEventsData();
  const [newEvent, setNewEvent] = useState("");
  const [newExpName, setNewExpName] = useState<Record<string, string>>({});
  const [newExpSlots, setNewExpSlots] = useState<Record<string, string>>({});

  const handleCreateEvent = async () => {
    if (!newEvent.trim()) return;
    await createEvent(newEvent.trim());
    setNewEvent("");
    toast.success("Evento creado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Eventos y experiencias</DialogTitle>
          <DialogDescription>Configura slots disponibles por evento y administra experiencias (Fintech cocktail, VIP Lunch, VC Padel, etc.).</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 pb-2 border-b">
          <Input placeholder="Nombre del nuevo evento" value={newEvent} onChange={(e) => setNewEvent(e.target.value)} />
          <Button onClick={handleCreateEvent} disabled={!newEvent.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Crear evento
          </Button>
        </div>

        <div className="space-y-4 mt-3">
          {events.map((ev) => (
            <EventBlock
              key={ev.id}
              event={ev}
              experiences={experiences.filter((x) => x.event_id === ev.id)}
              newExpName={newExpName[ev.id] ?? ""}
              newExpSlots={newExpSlots[ev.id] ?? "10"}
              onChangeNewExpName={(v) => setNewExpName((p) => ({ ...p, [ev.id]: v }))}
              onChangeNewExpSlots={(v) => setNewExpSlots((p) => ({ ...p, [ev.id]: v }))}
              onUpdateEvent={(patch) => updateEvent(ev.id, patch)}
              onDeleteEvent={() => {
                if (confirm(`Eliminar evento "${ev.name}" y todas sus experiencias?`)) {
                  deleteEvent(ev.id);
                  toast.success("Evento eliminado");
                }
              }}
              onCreateExp={async () => {
                const name = (newExpName[ev.id] ?? "").trim();
                const slots = Number(newExpSlots[ev.id] ?? 10);
                if (!name || !slots) return;
                await createExperience(ev.id, name, slots);
                setNewExpName((p) => ({ ...p, [ev.id]: "" }));
                toast.success("Experiencia creada");
              }}
              onUpdateExp={updateExperience}
              onDeleteExp={(id) => { deleteExperience(id); toast.success("Experiencia eliminada"); }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EventBlock({
  event, experiences, newExpName, newExpSlots,
  onChangeNewExpName, onChangeNewExpSlots,
  onUpdateEvent, onDeleteEvent, onCreateExp, onUpdateExp, onDeleteExp,
}: {
  event: EventRecord;
  experiences: Array<{ id: string; event_id: string; name: string; total_slots: number }>;
  newExpName: string; newExpSlots: string;
  onChangeNewExpName: (v: string) => void;
  onChangeNewExpSlots: (v: string) => void;
  onUpdateEvent: (patch: Partial<EventRecord>) => void;
  onDeleteEvent: () => void;
  onCreateExp: () => void;
  onUpdateExp: (id: string, patch: Partial<{ name: string; total_slots: number }>) => void;
  onDeleteExp: (id: string) => void;
}) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Input className="font-semibold" value={event.name} onChange={(e) => onUpdateEvent({ name: e.target.value })} />
        <Button variant="ghost" size="sm" onClick={onDeleteEvent}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {([
          ["slots_main_stage", "Main stage"],
          ["slots_second_stage", "Second stage"],
          ["slots_workshop", "Workshops"],
          ["slots_stand", "Stands"],
        ] as const).map(([k, lbl]) => (
          <div key={k}>
            <Label className="text-xs">{lbl}</Label>
            <Input type="number" min="0" value={event[k]} onChange={(e) => onUpdateEvent({ [k]: Number(e.target.value) } as any)} />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">Experiencias</Label>
        {experiences.map((x) => (
          <div key={x.id} className="flex items-center gap-2">
            <Input value={x.name} onChange={(e) => onUpdateExp(x.id, { name: e.target.value })} />
            <Input type="number" min="0" className="w-24" value={x.total_slots} onChange={(e) => onUpdateExp(x.id, { total_slots: Number(e.target.value) })} />
            <Button variant="ghost" size="sm" onClick={() => onDeleteExp(x.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <Input placeholder="Nueva experiencia (ej: Fintech cocktail)" value={newExpName} onChange={(e) => onChangeNewExpName(e.target.value)} />
          <Input type="number" min="0" className="w-24" placeholder="Slots" value={newExpSlots} onChange={(e) => onChangeNewExpSlots(e.target.value)} />
          <Button size="sm" onClick={onCreateExp} disabled={!newExpName.trim()}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}