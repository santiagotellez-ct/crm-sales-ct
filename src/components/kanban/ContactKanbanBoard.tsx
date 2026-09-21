import { useMemo, useState } from "react";
import {
  Company,
  Contact,
  ContactStatus,
  CONTACT_KANBAN_COLUMNS,
  CONTACT_STATUS_LABELS,
  CONTACT_EXPLICIT_STATUSES,
  SDR_OPTIONS,
  IcpFit,
  FIT_OPTIONS,
  FIT_LABELS,
  ContactedFrom,
  CONTACTED_FROM_OPTIONS,
  normalizeContactStatus,
} from "@/types/company";
import { useTeamMemberNames } from "@/hooks/useTeamMembers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, ChevronDown } from "lucide-react";
import { ContactKanbanCard, ContactKanbanItem } from "./ContactKanbanCard";
import { ScheduleMeetingDialog } from "../ScheduleMeetingDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { LogTouchDialog } from "../LogTouchDialog";
import { useCompanyData } from "@/hooks/useCompanyData";
import { useCatalog } from "@/hooks/useCatalog";
import { toast } from "sonner";

interface Props {
  companies: Company[];
  onOpenDetail: (company: Company, contact?: Contact) => void;
}

export function ContactKanbanBoard({ companies, onOpenDetail }: Props) {
  const { setContactStatus, scheduleMeeting, applyTouch } = useCompanyData();
  const { options: unqualifyReasons } = useCatalog("unqualified_reason");
  const { options: notInterestedReasons } = useCatalog("not_interested_reason");
  const [fit, setFit] = useState<IcpFit | "ALL">("ALL");
  const { sdrNames, isLoading: sdrLoading } = useTeamMemberNames();
  const sdrOptions = sdrLoading || sdrNames.length === 0 ? SDR_OPTIONS : sdrNames;
  const sdrFilterKeys = useMemo(() => ["UNASSIGNED", ...sdrOptions], [sdrOptions]);
  const [sdrFilter, setSdrFilter] = useState<string[]>([]);
  const allSdrSelected = sdrFilter.length > 0 && sdrFilter.length === sdrFilterKeys.length;
  const sdrFilterLabel =
    sdrFilter.length === 0 || allSdrSelected
      ? "Todos"
      : sdrFilter.length === 1
      ? (sdrFilter[0] === "UNASSIGNED" ? "Sin asignar" : sdrFilter[0])
      : `${sdrFilter.length} seleccionados`;
  const toggleSdrFilter = (key: string) => {
    setSdrFilter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };
  const [linkedin, setLinkedin] = useState<ContactedFrom | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState<ContactStatus | null>(null);
  const [scheduleFor, setScheduleFor] = useState<ContactKanbanItem | null>(null);
  const [discardFor, setDiscardFor] = useState<{ item: ContactKanbanItem; status: "unqualified" | "no_interesado" } | null>(null);
  const [discardReason, setDiscardReason] = useState("");
  const [discardCode, setDiscardCode] = useState("");
  const [touchFor, setTouchFor] = useState<ContactKanbanItem | null>(null);

  const items = useMemo(() => {
    const out: ContactKanbanItem[] = [];
    for (const company of companies) {
      for (const contact of company.contacts) {
        if (!contact.id) continue;
        out.push({ contact, company });
      }
    }
    return out;
  }, [companies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(({ contact, company }) => {
      if (fit !== "ALL" && company.icp_fit !== fit) return false;
      const sdr = contact.sdr ?? company.sdr ?? "UNASSIGNED";
      if (sdrFilter.length > 0 && !sdrFilter.includes(sdr === null ? "UNASSIGNED" : sdr)) return false;
      if (linkedin !== "ALL") {
        const accs = contact.contacted_from ?? [];
        if (!accs.includes(linkedin)) return false;
      }
      if (q) {
        const hay = `${contact.name} ${contact.role} ${company.company_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, fit, sdrFilter, linkedin, search]);

  const byColumn = useMemo(() => {
    const m = new Map<ContactStatus, ContactKanbanItem[]>();
    for (const col of CONTACT_KANBAN_COLUMNS) m.set(col, []);
    for (const item of filtered) {
      const col = normalizeContactStatus(item.contact.status);
      m.get(col)?.push(item);
    }
    return m;
  }, [filtered]);

  const daysInStage = (contact: Contact) => {
    if (!contact.status_entered_at) return null;
    const start = new Date(contact.status_entered_at).getTime();
    if (Number.isNaN(start)) return null;
    return Math.max(0, Math.floor((Date.now() - start) / 86400000));
  };

  const isExplicitColumn = (col: ContactStatus) =>
    (CONTACT_EXPLICIT_STATUSES as string[]).includes(col);

  const handleDrop = (e: React.DragEvent, target: ContactStatus) => {
    e.preventDefault();
    setDragOver(null);
    if (!isExplicitColumn(target)) {
      toast.message("Usa «Touch» para avanzar la etapa de outreach");
      return;
    }
    const id = e.dataTransfer.getData("text/contact-id");
    if (!id) return;
    const item = items.find((x) => x.contact.id === id);
    if (!item) return;
    const current = normalizeContactStatus(item.contact.status);
    if (current === target) return;

    if (target === "agendado") {
      setScheduleFor(item);
      return;
    }
    if (target === "unqualified" || target === "no_interesado") {
      setDiscardFor({ item, status: target });
      setDiscardReason("");
      setDiscardCode("");
      return;
    }
    void setContactStatus(id, target).then(() => {
      toast.success(`${item.contact.name} → ${CONTACT_STATUS_LABELS[target]}`);
    }).catch(() => toast.error("No se pudo cambiar la etapa"));
  };

  const discardOptions = discardFor?.status === "unqualified" ? unqualifyReasons : notInterestedReasons;

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contactos o empresas..."
              className="pl-9 bg-background h-8 text-xs"
            />
          </div>
        </div>
        <div className="w-[130px]">
          <label className="text-[10px] text-muted-foreground block mb-1">Fit</label>
          <Select value={fit} onValueChange={(v) => setFit(v as IcpFit | "ALL")}>
            <SelectTrigger className="h-8 bg-background text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {FIT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{FIT_LABELS[f]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[150px]">
          <label className="text-[10px] text-muted-foreground block mb-1">SDR</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-8 w-full justify-between bg-background text-xs font-normal px-2">
                <span className="truncate">{sdrFilterLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-border">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">SDR</span>
                <button
                  type="button"
                  className="text-[10px] text-primary-foreground bg-primary px-1.5 py-0.5 rounded font-medium"
                  onClick={() => setSdrFilter(allSdrSelected ? [] : sdrFilterKeys)}
                >
                  {allSdrSelected ? "Ninguno" : "Todos"}
                </button>
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                <label className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                  <Checkbox checked={sdrFilter.includes("UNASSIGNED")} onCheckedChange={() => toggleSdrFilter("UNASSIGNED")} />
                  <span>Sin asignar</span>
                </label>
                {sdrOptions.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                    <Checkbox checked={sdrFilter.includes(s)} onCheckedChange={() => toggleSdrFilter(s)} />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="w-[160px]">
          <label className="text-[10px] text-muted-foreground block mb-1">Cuenta LinkedIn</label>
          <Select value={linkedin} onValueChange={(v) => setLinkedin(v as ContactedFrom | "ALL")}>
            <SelectTrigger className="h-8 bg-background text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {CONTACTED_FROM_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} contactos</div>
      </div>

      <p className="text-[11px] text-muted-foreground px-0.5">
        Mismas columnas de siempre · card = contacto. Outreach: <span className="font-medium text-foreground">Touch</span>.
        Arrastra a Agendado / Reagendar / Unqualified / No interesado / No Answer.
      </p>

      <div className="flex gap-2 overflow-x-auto pb-3">
        {CONTACT_KANBAN_COLUMNS.map((col) => {
          const list = byColumn.get(col) ?? [];
          const explicit = isExplicitColumn(col);
          return (
            <div
              key={col}
              onDragOver={(e) => {
                if (!explicit) return;
                e.preventDefault();
                setDragOver(col);
              }}
              onDragLeave={() => setDragOver((d) => (d === col ? null : d))}
              onDrop={(e) => handleDrop(e, col)}
              className={`shrink-0 w-[220px] bg-muted/30 border rounded-lg flex flex-col max-h-[calc(100vh-280px)] ${
                dragOver === col ? "border-primary ring-2 ring-primary/30" : "border-border"
              }`}
            >
              <div className="px-3 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-muted/30 rounded-t-lg">
                <span className="text-xs font-semibold text-foreground">{CONTACT_STATUS_LABELS[col]}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{list.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {list.map((item) => (
                  <ContactKanbanCard
                    key={item.contact.id}
                    item={item}
                    linkedinAccounts={item.contact.contacted_from ?? []}
                    daysInStage={daysInStage(item.contact)}
                    draggable
                    onClick={() => onOpenDetail(item.company, item.contact)}
                    onLogTouch={() => setTouchFor(item)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <ScheduleMeetingDialog
        open={!!scheduleFor}
        companyName={scheduleFor?.company.company_name ?? ""}
        contacts={scheduleFor ? [scheduleFor.contact] : []}
        onOpenChange={(o) => { if (!o) setScheduleFor(null); }}
        onCancel={() => setScheduleFor(null)}
        onConfirm={async (payload) => {
          if (!scheduleFor?.contact.id) return;
          if (payload.alreadyHappened) {
            await setContactStatus(scheduleFor.contact.id, "agendado");
            toast.success(`${scheduleFor.contact.name} → Agendado`);
          } else {
            await scheduleMeeting(scheduleFor.company.id, payload);
            await setContactStatus(scheduleFor.contact.id, "agendado");
            toast.success(`Reunión agendada con ${payload.accountExecutive}`);
          }
          setScheduleFor(null);
        }}
      />

      <Dialog open={!!discardFor} onOpenChange={(o) => { if (!o) setDiscardFor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {discardFor?.status === "unqualified" ? "Marcar Unqualified" : "Marcar No interesado"}
            </DialogTitle>
            <DialogDescription>
              {discardFor?.item.contact.name} · {discardFor?.item.company.company_name}
            </DialogDescription>
          </DialogHeader>
          <Select value={discardCode || undefined} onValueChange={setDiscardCode}>
            <SelectTrigger><SelectValue placeholder="Motivo" /></SelectTrigger>
            <SelectContent>
              {discardOptions.map((o) => (
                <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(discardOptions.find((o) => o.code === discardCode)?.requires_note || discardCode === "other") && (
            <Textarea
              value={discardReason}
              onChange={(e) => setDiscardReason(e.target.value)}
              rows={3}
              placeholder="Nota..."
            />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDiscardFor(null)}>Cancelar</Button>
            <Button
              disabled={!discardCode || (discardOptions.find((o) => o.code === discardCode)?.requires_note && !discardReason.trim())}
              onClick={async () => {
                if (!discardFor?.item.contact.id) return;
                const label = discardOptions.find((o) => o.code === discardCode)?.label ?? discardCode;
                const reason = discardReason.trim() ? `${label}: ${discardReason.trim()}` : label;
                await setContactStatus(discardFor.item.contact.id, discardFor.status, reason);
                setDiscardFor(null);
                toast.success("Etapa actualizada");
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LogTouchDialog
        open={!!touchFor}
        contact={touchFor?.contact ?? null}
        defaultSdr={touchFor?.contact.sdr ?? touchFor?.company.sdr}
        onOpenChange={(o) => { if (!o) setTouchFor(null); }}
        onSubmit={async (payload) => {
          if (!touchFor?.contact.id) return null;
          return applyTouch(touchFor.contact.id, payload);
        }}
      />
    </div>
  );
}
