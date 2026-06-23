import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AE_OPTIONS, AccountExecutive } from "@/types/meeting";
import { getIsoWeek } from "@/lib/week";
import { AE_EMAILS } from "@/lib/aeEmails";
import { Checkbox } from "@/components/ui/checkbox";
import { Contact } from "@/types/company";

interface Props {
  open: boolean;
  companyName: string;
  contacts?: Contact[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    scheduledAt: number;
    accountExecutive: AccountExecutive;
    notes: string;
    aeEmail: string;
    contactEmails: string[];
    skipCalendar: boolean;
    alreadyHappened?: boolean;
  }) => void;
  onCancel: () => void;
}

function defaultDate() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function toDateInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function toTimeInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ScheduleMeetingDialog({ open, companyName, contacts = [], onOpenChange, onConfirm, onCancel }: Props) {
  const initial = defaultDate();
  const [date, setDate] = useState(toDateInput(initial));
  const [time, setTime] = useState(toTimeInput(initial));
  const [ae, setAe] = useState<AccountExecutive | "">("");
  const [notes, setNotes] = useState("");
  const [otherAeEmail, setOtherAeEmail] = useState("");
  const contactsWithEmail = contacts.filter((c) => !!c.email);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [skipCalendar, setSkipCalendar] = useState(false);
  const [alreadyHappened, setAlreadyHappened] = useState(false);

  useEffect(() => {
    if (open) {
      const d = defaultDate();
      setDate(toDateInput(d));
      setTime(toTimeInput(d));
      setAe("");
      setNotes("");
      setOtherAeEmail("");
      setSelectedEmails(new Set(contacts.filter((c) => !!c.email).map((c) => c.email!)));
      setSkipCalendar(false);
      setAlreadyHappened(false);
    }
  }, [open, contacts]);

  const combined = new Date(`${date}T${time}`);
  const aeEmail = ae === "Otro AE" ? otherAeEmail.trim() : ae ? AE_EMAILS[ae] : "";
  const validEmail = aeEmail === "" || /\S+@\S+\.\S+/.test(aeEmail);
  const valid = alreadyHappened
    ? !!ae
    : !isNaN(combined.getTime()) &&
      !!ae &&
      (skipCalendar || ae !== "Otro AE" || /\S+@\S+\.\S+/.test(otherAeEmail.trim())) &&
      (skipCalendar || validEmail);
  const wk = !isNaN(combined.getTime()) ? getIsoWeek(combined) : null;

  const submit = () => {
    if (!valid) return;
    if (alreadyHappened) {
      onConfirm({
        scheduledAt: Date.now(),
        accountExecutive: ae as AccountExecutive,
        notes: notes.trim(),
        aeEmail: "",
        contactEmails: [],
        skipCalendar: true,
        alreadyHappened: true,
      });
      return;
    }
    onConfirm({
      scheduledAt: combined.getTime(),
      accountExecutive: ae as AccountExecutive,
      notes: notes.trim(),
      aeEmail,
      contactEmails: Array.from(selectedEmails),
      skipCalendar,
    });
  };

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
        onOpenChange(o);
      }}
    >
      <DialogContent onClick={(e) => e.stopPropagation()} className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar reunión</DialogTitle>
          <DialogDescription>{companyName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm cursor-pointer rounded-md border border-border p-2 bg-muted/40">
            <Checkbox
              checked={alreadyHappened}
              onCheckedChange={(v) => setAlreadyHappened(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">La reunión ya ocurrió</span>
              <span className="block text-xs text-muted-foreground">
                Solo marca la empresa como agendada. No requiere fecha/hora y no cuenta en las metas semanales del SDR.
              </span>
            </span>
          </label>
          {!alreadyHappened && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          )}
          <div>
            <Label className="text-xs">Account Executive</Label>
            <Select value={ae} onValueChange={(v) => setAe(v as AccountExecutive)}>
              <SelectTrigger><SelectValue placeholder="Selecciona AE" /></SelectTrigger>
              <SelectContent>
                {AE_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!alreadyHappened && ae && ae !== "Otro AE" && (
            <p className="text-xs text-muted-foreground">Invita a {AE_EMAILS[ae]}</p>
          )}
          {!alreadyHappened && ae === "Otro AE" && (
            <div>
              <Label className="text-xs">Email del AE</Label>
              <Input
                type="email"
                value={otherAeEmail}
                onChange={(e) => setOtherAeEmail(e.target.value)}
                placeholder="email@dominio.com"
              />
            </div>
          )}
          {!alreadyHappened && contactsWithEmail.length > 0 && (
            <div>
              <Label className="text-xs">Invitar contactos</Label>
              <div className="mt-1 space-y-1 rounded-md border border-border p-2 max-h-32 overflow-y-auto">
                {contactsWithEmail.map((c) => (
                  <label key={c.linkedin} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedEmails.has(c.email!)}
                      onCheckedChange={() => toggleEmail(c.email!)}
                    />
                    <span className="truncate">{c.name} <span className="text-muted-foreground">— {c.email}</span></span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {!alreadyHappened && wk && (
            <p className="text-xs text-muted-foreground">
              Semana <span className="font-semibold text-foreground">{wk.week}</span> del año {wk.year}
            </p>
          )}
          {!alreadyHappened && (
          <label className="flex items-start gap-2 text-sm cursor-pointer rounded-md border border-border p-2">
            <Checkbox
              checked={skipCalendar}
              onCheckedChange={(v) => setSkipCalendar(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Marcar como agendada sin crear evento en Calendar</span>
              <span className="block text-xs text-muted-foreground">No se enviará invitación ni se generará link de Meet.</span>
            </span>
          </label>
          )}
          <div>
            <Label className="text-xs">Notas (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agenda, link, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onCancel(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={submit} disabled={!valid}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}