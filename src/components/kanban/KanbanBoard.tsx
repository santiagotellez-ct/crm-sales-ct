import { useMemo, useState } from "react";
import { Company, CompanyStatus, STATUS_LABELS, Sdr, SDR_OPTIONS, IcpFit, FIT_OPTIONS, FIT_LABELS, ContactedFrom, CONTACTED_FROM_OPTIONS, Activity } from "@/types/company";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { KanbanCard } from "./KanbanCard";
import { ReassignDialog } from "../ReassignDialog";
import { ScheduleMeetingDialog } from "../ScheduleMeetingDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { useCompanyData } from "@/hooks/useCompanyData";
import { toast } from "sonner";

const KANBAN_COLUMNS: CompanyStatus[] = [
  "por_contactar",
  "contactado",
  "follow_up_1",
  "follow_up_2",
  "en_conversacion",
  "agendado",
  "reagendar",
  "unqualified",
  "no_answer",
];

interface Props {
  companies: Company[];
  onOpenDetail: (c: Company) => void;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function KanbanBoard({ companies, onOpenDetail }: Props) {
  const { setStatus, scheduleMeeting, reassignCompany, activities } = useCompanyData();
  const [fit, setFit] = useState<IcpFit | "ALL">("ALL");
  const [sdr, setSdr] = useState<Sdr | "ALL" | "UNASSIGNED">("ALL");
  const [linkedin, setLinkedin] = useState<ContactedFrom | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [stageDate, setStageDate] = useState<Date | undefined>(undefined);
  const [stageDateMode, setStageDateMode] = useState<"on" | "before">("on");
  const [dragOver, setDragOver] = useState<CompanyStatus | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Company | null>(null);
  const [unqualifyFor, setUnqualifyFor] = useState<Company | null>(null);
  const [unqualifyReason, setUnqualifyReason] = useState("");
  const [reassignFor, setReassignFor] = useState<Company | null>(null);

  const linkedinByCompany = useMemo(() => {
    const m = new Map<string, ContactedFrom[]>();
    for (const c of companies) {
      const accounts = new Set<ContactedFrom>();
      for (const k of c.contacts) {
        for (const a of k.contacted_from ?? []) accounts.add(a);
      }
      m.set(c.id, [...accounts]);
    }
    return m;
  }, [companies]);

  const stageDateByCompany = useMemo(() => {
    const m = new Map<string, Date>();
    for (const c of companies) {
      const lastChange = activities
        .filter((a) => a.company_id === c.id && a.type === "status_change" && a.to_status === c.status)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      const startMs = lastChange?.timestamp ?? (c.created_at ? new Date(c.created_at).getTime() : null);
      if (startMs) {
        m.set(c.id, new Date(startMs));
      }
    }
    return m;
  }, [companies, activities]);

  const daysByCompany = useMemo(() => {
    const m = new Map<string, number>();
    for (const [id, date] of stageDateByCompany) {
      m.set(id, Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000)));
    }
    return m;
  }, [stageDateByCompany]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (c.status === "unqualified_post_meeting") return false;
      if (fit !== "ALL" && c.icp_fit !== fit) return false;
      if (sdr === "UNASSIGNED" && c.sdr) return false;
      if (sdr !== "ALL" && sdr !== "UNASSIGNED" && c.sdr !== sdr) return false;
      if (linkedin !== "ALL") {
        const accs = linkedinByCompany.get(c.id) ?? [];
        if (!accs.includes(linkedin)) return false;
      }
      if (stageDate) {
        const movedAt = stageDateByCompany.get(c.id);
        if (!movedAt) return false;
        if (stageDateMode === "on") {
          if (!isSameDay(movedAt, stageDate)) return false;
        } else {
          const selectedStart = new Date(stageDate.getFullYear(), stageDate.getMonth(), stageDate.getDate());
          if (movedAt.getTime() >= selectedStart.getTime()) return false;
        }
      }
      if (q && !c.company_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [companies, fit, sdr, linkedin, search, linkedinByCompany, stageDate, stageDateMode, stageDateByCompany]);

  const byColumn = useMemo(() => {
    const m = new Map<CompanyStatus, Company[]>();
    for (const col of KANBAN_COLUMNS) m.set(col, []);
    for (const c of filtered) {
      if (m.has(c.status)) m.get(c.status)!.push(c);
    }
    return m;
  }, [filtered]);

  const handleDrop = (e: React.DragEvent, target: CompanyStatus) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/company-id");
    if (!id) return;
    const company = companies.find((c) => c.id === id);
    if (!company || company.status === target) return;
    if (target === "agendado") { setScheduleFor(company); return; }
    if (target === "unqualified") { setUnqualifyFor(company); setUnqualifyReason(""); return; }
    void setStatus(id, target);
  };

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empresas..." className="pl-9 bg-background h-8 text-xs" />
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
        <div className="w-[140px]">
          <label className="text-[10px] text-muted-foreground block mb-1">SDR</label>
          <Select value={sdr} onValueChange={(v) => setSdr(v as Sdr | "ALL" | "UNASSIGNED")}>
            <SelectTrigger className="h-8 bg-background text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="UNASSIGNED">Sin asignar</SelectItem>
              {SDR_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
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
        <div className="w-[180px]">
          <label className="text-[10px] text-muted-foreground block mb-1">Fecha cambio de stage</label>
          <div className="flex items-center gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-7 flex-1 justify-start text-left font-normal text-xs bg-background px-2"
                >
                  <CalendarIcon className="mr-1.5 h-3 w-3" />
                  {stageDate ? format(stageDate, "dd/MM/yyyy") : <span className="text-muted-foreground">Seleccionar</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={stageDate}
                  onSelect={setStageDate}
                  initialFocus
                  locale={es}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {stageDate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-[10px] text-muted-foreground"
                onClick={() => setStageDate(undefined)}
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>
        {stageDate && (
          <div className="w-[140px]">
            <label className="text-[10px] text-muted-foreground block mb-1">Modo</label>
            <Select value={stageDateMode} onValueChange={(v) => setStageDateMode(v as "on" | "before")}>
              <SelectTrigger className="h-8 bg-background text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on">En esa fecha</SelectItem>
                <SelectItem value="before">Antes de</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} empresas</div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3">
        {KANBAN_COLUMNS.map((col) => {
          const list = byColumn.get(col) ?? [];
          return (
            <div
              key={col}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col); }}
              onDragLeave={() => setDragOver((d) => (d === col ? null : d))}
              onDrop={(e) => handleDrop(e, col)}
              className={`shrink-0 w-[240px] bg-muted/30 border rounded-lg flex flex-col max-h-[calc(100vh-260px)] ${
                dragOver === col ? "border-primary ring-2 ring-primary/30" : "border-border"
              }`}
            >
              <div className="px-3 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-muted/30 rounded-t-lg">
                <span className="text-xs font-semibold text-foreground">{STATUS_LABELS[col]}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{list.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {list.map((c) => (
                  <KanbanCard
                    key={c.id}
                    company={c}
                    linkedinAccounts={linkedinByCompany.get(c.id) ?? []}
                    daysInStage={daysByCompany.get(c.id) ?? null}
                    onClick={() => onOpenDetail(c)}
                    onReassign={col === "no_answer" ? () => setReassignFor(c) : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <ScheduleMeetingDialog
        open={!!scheduleFor}
        companyName={scheduleFor?.company_name ?? ""}
        contacts={scheduleFor?.contacts ?? []}
        onOpenChange={(o) => { if (!o) setScheduleFor(null); }}
        onCancel={() => setScheduleFor(null)}
        onConfirm={async (payload) => {
          if (!scheduleFor) return;
          if (payload.alreadyHappened) {
            await setStatus(scheduleFor.id, "agendado");
            toast.success(`${scheduleFor.company_name} marcada como agendada`);
          } else {
            await scheduleMeeting(scheduleFor.id, payload);
            toast.success(`Reunión agendada con ${payload.accountExecutive}`);
          }
          setScheduleFor(null);
        }}
      />

      <Dialog open={!!unqualifyFor} onOpenChange={(o) => { if (!o) setUnqualifyFor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Unqualified</DialogTitle>
            <DialogDescription>Indica la razón para {unqualifyFor?.company_name}.</DialogDescription>
          </DialogHeader>
          <Textarea value={unqualifyReason} onChange={(e) => setUnqualifyReason(e.target.value)} rows={4} placeholder="Razón..." />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUnqualifyFor(null)}>Cancelar</Button>
            <Button
              disabled={!unqualifyReason.trim()}
              onClick={async () => {
                if (!unqualifyFor) return;
                await setStatus(unqualifyFor.id, "unqualified", unqualifyReason.trim());
                setUnqualifyFor(null);
              }}
            >Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReassignDialog
        open={!!reassignFor}
        companyName={reassignFor?.company_name ?? ""}
        currentSdr={reassignFor?.sdr ?? null}
        currentLinkedin={null}
        onOpenChange={(o) => { if (!o) setReassignFor(null); }}
        onConfirm={async (p) => {
          if (!reassignFor) return;
          await reassignCompany(reassignFor.id, p);
          toast.success(`Reasignado a ${p.sdr ?? "Sin asignar"}`);
          setReassignFor(null);
        }}
      />
    </div>
  );
}
