import { Company, Contact, IcpFit, FIT_LABELS, CompanySize, SIZE_OPTIONS, SIZE_LABELS, SIZE_RANGES, CompanySource, SOURCE_OPTIONS, SOURCE_LABELS } from "@/types/company";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SizeBadge } from "./SizeBadge";
import { X, ExternalLink, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { StatusSelect } from "./StatusSelect";
import { ContactsPanel } from "./ContactsPanel";
import { FitSelect } from "./FitSelect";
import { SdrSelect } from "./SdrSelect";
import { TasksSection } from "./TasksSection";
import { ScheduleMeetingDialog } from "./ScheduleMeetingDialog";
import { useCompanyData } from "@/hooks/useCompanyData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReassignDialog } from "./ReassignDialog";

interface DetailPanelProps {
  company: Company;
  onClose: () => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onStatusChange: (id: string, status: Company["status"], reason?: string) => void;
  onFitChange: (id: string, fit: IcpFit) => void;
  onAddContact: (companyId: string, contact: Contact) => void | Promise<void>;
  onRemoveContact: (companyId: string, linkedin: string) => void;
  onDelete?: () => void;
}



export function DetailPanel({
  company, onClose, onUpdateNotes,
  onStatusChange, onFitChange, onAddContact, onRemoveContact, onDelete,
}: DetailPanelProps) {


  const [notes, setNotes] = useState(company.notes);
  const { tasks, addTask, toggleTask, deleteTask, updateCompany, scheduleMeeting, updateContact, sequences, reassignCompany, setSdr, activities } = useCompanyData();
  const companyTasks = tasks.filter((t) => t.company_id === company.id);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [country, setCountry] = useState(company.country);
  const [industry, setIndustry] = useState(company.industry);
  const [experiencia, setExperiencia] = useState(company.experiencia_target ?? "");

  useEffect(() => {
    setCountry(company.country);
    setIndustry(company.industry);
    setNotes(company.notes);
    setExperiencia(company.experiencia_target ?? "");
  }, [company.id, company.country, company.industry, company.notes, company.experiencia_target]);

  const companySequences = sequences
    .filter((s) => s.company_id === company.id)
    .sort((a, b) => b.started_at - a.started_at);
  const activeSequence = companySequences.find((s) => s.ended_at === null) ?? null;

  const daysInStage = (() => {
    const lastChange = activities
      .filter((a) => a.company_id === company.id && a.type === "status_change" && a.to_status === company.status)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    const startMs = lastChange?.timestamp ?? (company.created_at ? new Date(company.created_at).getTime() : null);
    if (!startMs) return null;
    return Math.max(0, Math.floor((Date.now() - startMs) / 86400000));
  })();

  const handleAddDomain = async () => {
    const d = domainInput.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!d) return;
    updateCompany(company.id, { domain: d });
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-company", {
        body: { domain: d, company_name: company.company_name },
      });
      if (error) throw error;
      const updates: Partial<Company> = {};
      if (data?.country) updates.country = data.country;
      if (data?.size) updates.size = data.size as CompanySize;
      if (data?.industry) updates.industry = data.industry;
      if (Object.keys(updates).length) {
        updateCompany(company.id, updates);
        toast.success("Datos enriquecidos");
      } else {
        toast.info("No se obtuvieron datos adicionales");
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudo enriquecer la empresa");
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">{company.company_name}</h2>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm("¿Eliminar esta empresa? Se borrarán también sus contactos, tareas e historial.")) {
                  onDelete();
                }
              }}
              className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Eliminar empresa"
              aria-label="Eliminar empresa"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>


      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">ICP Fit</span>
          <FitSelect fit={company.icp_fit} onChange={(f) => onFitChange(company.id, f)} size="md" />
        </div>

        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Estado</span>
          <StatusSelect
            status={company.status}
            unqualifiedReason={company.unqualified_reason}
            onChange={(s, r) => onStatusChange(company.id, s, r)}
            onScheduleRequest={() => setScheduleOpen(true)}
            size="md"
          />
          {company.status === "unqualified" && company.unqualified_reason && (
            <p className="text-xs text-muted-foreground mt-2 italic">Razón: {company.unqualified_reason}</p>
          )}
          {company.status === "no_answer" && (
            <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => setReassignOpen(true)}>
              Reasignar prospección
            </Button>
          )}
        </div>

        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">SDR</span>
          <SdrSelect sdr={company.sdr} onChange={(s) => setSdr(company.id, s)} size="md" />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Dominio</span>
            {company.domain ? (
              <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                {company.domain} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <div className="flex items-center gap-1.5 mt-1">
                <Input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="acme.com"
                  className="h-7 text-xs"
                  disabled={enriching}
                />
                <Button size="sm" className="h-7 px-2" onClick={handleAddDomain} disabled={enriching || !domainInput.trim()}>
                  {enriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                </Button>
              </div>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Industria</span>
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              onBlur={() => industry !== company.industry && updateCompany(company.id, { industry })}
              className="h-7 text-xs mt-1"
            />
          </div>
          <div>
            <span className="text-muted-foreground">País</span>
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              onBlur={() => country !== company.country && updateCompany(company.id, { country })}
              className="h-7 text-xs mt-1"
            />
          </div>
          <div>
            <span className="text-muted-foreground">Size</span>
            <Select value={company.size} onValueChange={(v) => updateCompany(company.id, { size: v as CompanySize })}>
              <SelectTrigger className="h-8 text-xs mt-1 w-fit gap-2 border-none px-0 hover:bg-transparent focus:ring-0 [&>svg]:opacity-50">
                <SizeBadge size={company.size} />
              </SelectTrigger>
              <SelectContent>
                {SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="font-medium">{SIZE_LABELS[s]}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">{SIZE_RANGES[s]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Por qué encaja</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{company.reasoning}</p>
        </div>

        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Experiencia target</span>
          <Input
            value={experiencia}
            onChange={(e) => setExperiencia(e.target.value)}
            onBlur={() => {
              const next = experiencia.trim();
              if (next !== (company.experiencia_target ?? "")) {
                updateCompany(company.id, { experiencia_target: next || null });
              }
            }}
            placeholder="Ej: Visionaries Gala"
            className="h-8 text-sm"
          />
        </div>

        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Source</span>
          <Select
            value={company.source ?? "NONE"}
            onValueChange={(v) => updateCompany(company.id, { source: v === "NONE" ? null : (v as CompanySource) })}
          >
            <SelectTrigger className="h-8 text-xs w-fit gap-2"><SelectValue placeholder="Sin definir" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">Sin definir</SelectItem>
              {SOURCE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{SOURCE_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Contactos ({company.contacts.length})</h3>
          <ContactsPanel
            companyId={company.id}
            contacts={company.contacts}
            onAdd={onAddContact}
            onRemove={onRemoveContact}
            onUpdate={updateContact}
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Tareas ({companyTasks.filter((t) => !t.completed).length})
          </h3>
          <TasksSection
            tasks={companyTasks}
            onAdd={(title, dueAt) => addTask(company.id, title, dueAt)}
            onToggle={toggleTask}
            onDelete={deleteTask}
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Notas</h3>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => onUpdateNotes(company.id, notes)}
            placeholder="Añade notas sobre esta empresa..."
            className="bg-background text-sm"
            rows={3}
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Historial de prospección</h3>
          {companySequences.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sin secuencias registradas.</p>
          ) : (
            <ul className="space-y-1.5">
              {companySequences.map((s) => (
                <li key={s.id} className="border border-border rounded-md p-2 bg-background text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      {s.sdr ?? "Sin SDR"}
                      {s.linkedin_account ? <span className="text-muted-foreground"> · in/{s.linkedin_account}</span> : null}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.ended_at === null ? "bg-score-high/15 text-score-high" : "bg-muted text-muted-foreground"}`}>
                      {s.ended_at === null ? "Activa" : (s.end_reason ?? "Cerrada")}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(s.started_at).toLocaleDateString("es-CO")}
                    {s.ended_at ? ` → ${new Date(s.ended_at).toLocaleDateString("es-CO")}` : " → en curso"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-border px-6 py-4 relative">
        <Button onClick={onClose} className="w-full" variant="outline">
          Cerrar
        </Button>
        {daysInStage !== null && (
          <span
            className="absolute bottom-1 right-2 text-[10px] text-muted-foreground"
            title="Días en este estado"
          >
            {daysInStage}d en {company.status}
          </span>
        )}
      </div>

      <ScheduleMeetingDialog
        open={scheduleOpen}
        companyName={company.company_name}
        contacts={company.contacts}
        onOpenChange={setScheduleOpen}
        onCancel={() => setScheduleOpen(false)}
        onConfirm={async (payload) => {
          await scheduleMeeting(company.id, payload);
          toast.success(`Reunión agendada con ${payload.accountExecutive}`);
          setScheduleOpen(false);
        }}
      />
      <ReassignDialog
        open={reassignOpen}
        companyName={company.company_name}
        currentSdr={company.sdr ?? null}
        currentLinkedin={activeSequence?.linkedin_account ?? null}
        onOpenChange={setReassignOpen}
        onConfirm={async (p) => {
          await reassignCompany(company.id, p);
          toast.success(`Reasignado a ${p.sdr ?? "Sin asignar"}`);
          setReassignOpen(false);
        }}
      />
    </div>
  );
}
