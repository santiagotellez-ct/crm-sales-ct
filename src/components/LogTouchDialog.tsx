import { useEffect, useState } from "react";
import { Contact, Sdr } from "@/types/company";
import { useCatalog } from "@/hooks/useCatalog";
import { useTeamMemberNames } from "@/hooks/useTeamMembers";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const STAGE_LABELS: Record<string, string> = {
  por_contactar: "Por contactar",
  contactado: "Contactado",
  follow_up_1: "Follow Up 1",
  follow_up_2: "Follow Up 2",
  en_conversacion: "En conversación",
  touch_point_2: "Touch point 2",
  touch_point_3: "Touch point 3",
  touch_point_4: "Touch point 4",
  touch_point_5: "Touch point 5",
  touch_point_6: "Touch point 6",
  caliente: "Caliente",
  reunion_agendada: "Reunión agendada",
  agendado: "Agendado",
  reagendar: "Reagendar",
  no_answer: "No Answer",
  no_interesado: "No interesado",
  unqualified: "Unqualified",
  unqualified_post_meeting: "Unqualified Post-Reunión",
  en_nutricion: "En nutrición",
};

interface Props {
  open: boolean;
  contact: Contact | null;
  defaultSdr?: Sdr | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    channel?: string;
    account_used?: string;
    sdr?: string;
    note?: string;
  }) => Promise<{ from_status?: string; to_status?: string; advanced?: boolean } | null | undefined>;
}

export function LogTouchDialog({ open, contact, defaultSdr, onOpenChange, onSubmit }: Props) {
  const { options: channels } = useCatalog("channel");
  const { options: seats } = useCatalog("linkedin_seat");
  const { sdrNames } = useTeamMemberNames();
  const [channel, setChannel] = useState<string>("");
  const [accountUsed, setAccountUsed] = useState<string>("");
  const [sdr, setSdr] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChannel("");
    setNote("");
    setSdr(defaultSdr ?? contact?.sdr ?? "");
    const fromSeat = contact?.contacted_from?.[0];
    if (fromSeat) {
      const match = seats.find(
        (s) => s.label.toLowerCase() === fromSeat.toLowerCase() || s.code === fromSeat.toLowerCase(),
      );
      setAccountUsed(match?.code ?? "");
    } else {
      setAccountUsed("");
    }
  }, [open, contact, defaultSdr, seats]);

  const handleSave = async () => {
    if (!contact?.id) {
      toast.error("Este contacto no tiene id; recarga la página.");
      return;
    }
    setSaving(true);
    try {
      const result = await onSubmit({
        channel: channel || undefined,
        account_used: accountUsed || undefined,
        sdr: sdr || undefined,
        note: note.trim() || undefined,
      });
      const fromLabel = STAGE_LABELS[result?.from_status ?? ""] ?? result?.from_status;
      const toLabel = STAGE_LABELS[result?.to_status ?? ""] ?? result?.to_status;
      if (result?.advanced) {
        toast.success(`Touch registrado · ${fromLabel} → ${toLabel}`);
      } else {
        toast.success(
          result?.to_status
            ? `Touch registrado · etapa sin cambio (${toLabel})`
            : "Touch registrado",
        );
      }
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo registrar el touch");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar touch</DialogTitle>
          <DialogDescription>
            {contact ? `${contact.name}${contact.role ? ` · ${contact.role}` : ""}` : "Contacto"}
            {contact?.status ? (
              <span className="block mt-1 text-xs">
                Etapa actual: {STAGE_LABELS[contact.status] ?? contact.status}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Canal</label>
            <Select value={channel || undefined} onValueChange={setChannel}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleccionar canal" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((o) => (
                  <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Cuenta LinkedIn</label>
            <Select value={accountUsed || undefined} onValueChange={setAccountUsed}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {seats.map((o) => (
                  <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">SDR</label>
            <Select value={sdr || undefined} onValueChange={setSdr}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {sdrNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Nota</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opcional"
              className="min-h-[72px] text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !contact?.id}>
            {saving ? "Guardando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { STAGE_LABELS as TOUCH_STAGE_LABELS };
