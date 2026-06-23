import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEventsData } from "@/hooks/useEventsData";

export interface CommitedFields {
  paquete_vendido: string;
  adicionales_paquete: string;
  sponsor_pain: string;
  sponsor_icp: string;
  commit_speaking_main: boolean;
  commit_speaking_second: boolean;
  commit_workshop: boolean;
  commit_stand: boolean;
  commit_experience_id: string | null;
}

interface Props {
  open: boolean;
  companyName: string;
  eventName?: string | null;
  initial?: Partial<CommitedFields>;
  onOpenChange: (o: boolean) => void;
  onConfirm: (fields: CommitedFields) => void;
}

export function CommitedFieldsDialog({ open, companyName, eventName, initial, onOpenChange, onConfirm }: Props) {
  const [paquete, setPaquete] = useState("");
  const [adicionales, setAdicionales] = useState("");
  const [pain, setPain] = useState("");
  const [icp, setIcp] = useState("");
  const [speakMain, setSpeakMain] = useState(false);
  const [speakSecond, setSpeakSecond] = useState(false);
  const [workshop, setWorkshop] = useState(false);
  const [stand, setStand] = useState(false);
  const [experienceId, setExperienceId] = useState<string>("");
  const { events, experiences } = useEventsData();
  const event = events.find((e) => e.name === eventName);
  const eventExperiences = event ? experiences.filter((x) => x.event_id === event.id) : [];

  useEffect(() => {
    if (open) {
      setPaquete(initial?.paquete_vendido ?? "");
      setAdicionales(initial?.adicionales_paquete ?? "");
      setPain(initial?.sponsor_pain ?? "");
      setIcp(initial?.sponsor_icp ?? "");
      setSpeakMain(!!initial?.commit_speaking_main);
      setSpeakSecond(!!initial?.commit_speaking_second);
      setWorkshop(!!initial?.commit_workshop);
      setStand(!!initial?.commit_stand);
      setExperienceId(initial?.commit_experience_id ?? "");
    }
  }, [open, initial]);

  const valid = paquete.trim() && pain.trim() && icp.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mover "{companyName}" a Commited</DialogTitle>
          <DialogDescription>
            Completa los campos del cierre antes de mover el deal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label className="text-xs">Paquete vendido *</Label>
            <Textarea value={paquete} onChange={(e) => setPaquete(e.target.value)} rows={2} placeholder="Ej: Gold Sponsor CTW2026" />
          </div>
          <div>
            <Label className="text-xs">Adicionales al paquete</Label>
            <Textarea value={adicionales} onChange={(e) => setAdicionales(e.target.value)} rows={2} placeholder="Ej: Stand premium, workshop, branding extra" />
          </div>
          <div className="border rounded-md p-2 space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Incluye</Label>
            {([
              ["speakMain", "Speaking slot en main stage", speakMain, setSpeakMain],
              ["speakSecond", "Speaking slot en second stage", speakSecond, setSpeakSecond],
              ["workshop", "Workshop", workshop, setWorkshop],
              ["stand", "Stand", stand, setStand],
            ] as const).map(([k, lbl, val, setter]) => (
              <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={val} onCheckedChange={(v) => (setter as (b: boolean) => void)(!!v)} />
                <span>{lbl}</span>
              </label>
            ))}
            <div className="pt-1.5">
              <Label className="text-xs">Experiencia {eventName ? `(${eventName})` : ""}</Label>
              <Select value={experienceId || "__none"} onValueChange={(v) => setExperienceId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecciona experiencia" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin experiencia</SelectItem>
                  {eventExperiences.map((x) => (
                    <SelectItem key={x.id} value={x.id}>{x.name} ({x.total_slots} slots)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {eventName && eventExperiences.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">No hay experiencias configuradas para este evento. Añádelas desde "Eventos".</p>
              )}
            </div>
          </div>
          <div>
            <Label className="text-xs">Pain / expectativa del sponsor *</Label>
            <Textarea value={pain} onChange={(e) => setPain(e.target.value)} rows={2} placeholder="¿Qué busca resolver o conseguir?" />
          </div>
          <div>
            <Label className="text-xs">ICP del sponsor *</Label>
            <Textarea value={icp} onChange={(e) => setIcp(e.target.value)} rows={2} placeholder="¿A quién quiere llegar?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!valid}
            onClick={() =>
              onConfirm({
                paquete_vendido: paquete.trim(),
                adicionales_paquete: adicionales.trim(),
                sponsor_pain: pain.trim(),
                sponsor_icp: icp.trim(),
                commit_speaking_main: speakMain,
                commit_speaking_second: speakSecond,
                commit_workshop: workshop,
                commit_stand: stand,
                commit_experience_id: experienceId || null,
              })
            }
          >
            Guardar y mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}