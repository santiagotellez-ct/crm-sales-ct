import { Company, Contact, IcpFit, FIT_RANK, CompanySize } from "@/types/company";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpDown, ChevronDown, ChevronRight, Users } from "lucide-react";
import { useState, useMemo, memo, useCallback, useRef, useEffect } from "react";
import { StatusSelect } from "./StatusSelect";
import { ContactsPanel } from "./ContactsPanel";
import { SdrSelect } from "./SdrSelect";
import { FitSelect } from "./FitSelect";
import { AmigosSelect } from "./AmigosSelect";
import { SizeSelect } from "./SizeSelect";
import { EditableCell } from "./EditableCell";

interface CompanyTableProps {
  companies: Company[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onRowClick: (company: Company) => void;
  onStatusChange: (id: string, status: Company["status"], reason?: string) => void;
  onSdrChange: (id: string, sdr: Company["sdr"]) => void;
  onFitChange: (id: string, fit: IcpFit) => void;
  onAmigosChange: (id: string, amigos: boolean, note?: string) => void;
  onAddContact: (companyId: string, contact: Contact) => void | Promise<void>;
  onRemoveContact: (companyId: string, linkedin: string) => void;
  onUpdateContact?: (companyId: string, oldLinkedin: string, updates: Partial<Contact>) => void;
  onUpdate: (id: string, updates: Partial<Company>) => void;
  onScheduleMeeting: (company: Company) => void;
  contactedAtById?: Map<string, number>;
  aeByCompany?: Map<string, string>;
  sortOverride?: "default" | "contacted_desc" | "contacted_asc";
}

type SortKey = "icp_fit" | "size" | "company_name" | "country" | "contacts" | "sdr";
const SIZE_RANK: Record<CompanySize, number> = { SMB: 0, MID: 1, ENTERPRISE: 2 };
type SortDir = "asc" | "desc";

// Shared grid template for header and rows so columns line up perfectly.
const GRID_COLS =
  "32px 40px minmax(220px,2fr) minmax(120px,1fr) minmax(170px,1.2fr) minmax(150px,1.1fr) minmax(110px,0.8fr) minmax(125px,0.8fr) minmax(130px,0.9fr) minmax(120px,0.9fr) minmax(150px,1fr) minmax(150px,1fr)";
const MIN_TABLE_WIDTH = 1517;

interface CompanyRowProps {
  company: Company;
  isSelected: boolean;
  isOpen: boolean;
  onRowClick: (company: Company) => void;
  onToggleExpand: (id: string) => void;
  onCheckboxClick: (e: React.MouseEvent, company: Company) => void;
  onStatusChange: (id: string, status: Company["status"], reason?: string) => void;
  onSdrChange: (id: string, sdr: Company["sdr"]) => void;
  onFitChange: (id: string, fit: IcpFit) => void;
  onAmigosChange: (id: string, amigos: boolean, note?: string) => void;
  onAddContact: (companyId: string, contact: Contact) => void | Promise<void>;
  onRemoveContact: (companyId: string, linkedin: string) => void;
  onUpdateContact?: (companyId: string, oldLinkedin: string, updates: Partial<Contact>) => void;
  onUpdate: (id: string, updates: Partial<Company>) => void;
  onScheduleMeeting: (company: Company) => void;
  ae?: string;
}

const CompanyRow = memo(function CompanyRow({
  company,
  isSelected,
  isOpen,
  onRowClick,
  onToggleExpand,
  onCheckboxClick,
  onStatusChange,
  onSdrChange,
  onFitChange,
  onAmigosChange,
  onAddContact,
  onRemoveContact,
  onUpdateContact,
  onUpdate,
  onScheduleMeeting,
  ae,
}: CompanyRowProps) {
  return (
    <div
      className={`border-b border-border cursor-pointer transition-colors hover:bg-accent/50 ${
        isSelected ? "bg-primary/5" : ""
      } ${company.reviewed ? "opacity-60" : ""}`}
      onClick={() => onRowClick(company)}
    >
      <div className="grid items-center" style={{ gridTemplateColumns: GRID_COLS }}>
        <div className="px-2 py-3" onClick={(e) => { e.stopPropagation(); onToggleExpand(company.id); }}>
          <button className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Expandir contactos">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
        <div className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={isSelected} onClick={(e) => onCheckboxClick(e, company)} />
        </div>
        <div className="px-3 py-3 min-w-0">
          <div className="font-medium text-sm text-foreground -mx-1.5 truncate">
            <EditableCell
              value={company.company_name}
              onSave={(v) => { if (v) onUpdate(company.id, { company_name: v }); }}
              placeholder="Nombre"
              className="font-medium"
            />
          </div>
          <div className="text-xs text-muted-foreground -mx-1.5 truncate">
            <EditableCell
              value={company.domain}
              onSave={(v) => onUpdate(company.id, { domain: v })}
              placeholder="dominio"
              className="text-xs"
            />
          </div>
        </div>
        <div className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <FitSelect fit={company.icp_fit} onChange={(f) => onFitChange(company.id, f)} />
        </div>
        <div className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <StatusSelect
            status={company.status}
            unqualifiedReason={company.unqualified_reason}
            onChange={(s, r) => onStatusChange(company.id, s, r)}
            onScheduleRequest={() => onScheduleMeeting(company)}
          />
          {company.status === "agendado" && ae && (
            <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-score-medium/15 text-score-medium border border-score-medium/30">
              AE: {ae}
            </div>
          )}
        </div>
        <div className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <SdrSelect sdr={company.sdr} onChange={(s) => onSdrChange(company.id, s)} />
        </div>
        <div className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <AmigosSelect amigos={company.amigos ?? false} onChange={(a, note) => onAmigosChange(company.id, a, note)} />
        </div>
        <div className="px-3 py-3" onClick={(e) => { e.stopPropagation(); onToggleExpand(company.id); }}>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer">
            <Users className="h-3 w-3" />
            {company.contacts.length}
          </span>
        </div>
        <div className="px-3 py-3 text-sm text-foreground min-w-0" onClick={(e) => e.stopPropagation()}>
          <EditableCell value={company.country} onSave={(v) => onUpdate(company.id, { country: v })} placeholder="País" />
        </div>
        <div className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <SizeSelect size={company.size} onChange={(s) => onUpdate(company.id, { size: s })} />
        </div>
        <div className="px-3 py-3 text-sm text-muted-foreground min-w-0" onClick={(e) => e.stopPropagation()}>
          <EditableCell value={company.industry} onSave={(v) => onUpdate(company.id, { industry: v })} placeholder="Industria" />
        </div>
        <div className="px-3 py-3 text-sm text-muted-foreground min-w-0" onClick={(e) => e.stopPropagation()}>
          <EditableCell
            value={company.experiencia_target ?? ""}
            onSave={(v) => onUpdate(company.id, { experiencia_target: v || null })}
            placeholder="—"
          />
        </div>
      </div>
      {isOpen && (
        <div className="bg-muted/30 border-t border-border px-6 py-4" onClick={(e) => e.stopPropagation()}>
          <div className="max-w-2xl">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Contactos de {company.company_name}
            </h4>
            <ContactsPanel
              companyId={company.id}
              contacts={company.contacts}
              onAdd={onAddContact}
              onRemove={onRemoveContact}
              onUpdate={onUpdateContact}
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
});

export function CompanyTable({
  companies,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onRowClick,
  onStatusChange,
  onSdrChange,
  onFitChange,
  onAmigosChange,
  onAddContact,
  onRemoveContact,
  onUpdateContact,
  onUpdate,
  onScheduleMeeting,
  contactedAtById,
  aeByCompany,
  sortOverride,
}: CompanyTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("icp_fit");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sorted = useMemo(() => {
    if (sortOverride && sortOverride !== "default") {
      const dir = sortOverride === "contacted_desc" ? -1 : 1;
      const big = sortOverride === "contacted_desc" ? -Infinity : Infinity;
      return [...companies].sort((a, b) => {
        const av = contactedAtById?.get(a.id) ?? big;
        const bv = contactedAtById?.get(b.id) ?? big;
        return dir * (av - bv);
      });
    }
    return [...companies].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "company_name") return mul * a.company_name.localeCompare(b.company_name);
      if (sortKey === "country") return mul * a.country.localeCompare(b.country);
      if (sortKey === "contacts") return mul * (a.contacts.length - b.contacts.length);
      if (sortKey === "sdr") return mul * ((a.sdr ?? "").localeCompare(b.sdr ?? ""));
      if (sortKey === "icp_fit") return mul * (FIT_RANK[a.icp_fit] - FIT_RANK[b.icp_fit]);
      if (sortKey === "size") return mul * (SIZE_RANK[a.size] - SIZE_RANK[b.size]);
      return 0;
    });
  }, [companies, sortKey, sortDir]);

  const allSelected = companies.length > 0 && companies.every((c) => selectedIds.has(c.id));

  // Use refs so the checkbox click handler stays referentially stable across
  // renders — otherwise the memoized CompanyRow would re-render on every
  // keystroke in the search input.
  const stateRef = useRef({ lastSelectedId, selectedIds, sorted, onSelectAll, onToggleSelect });
  useEffect(() => {
    stateRef.current = { lastSelectedId, selectedIds, sorted, onSelectAll, onToggleSelect };
  });
  const handleRowCheckboxClick = useCallback((e: React.MouseEvent, company: Company) => {
    e.stopPropagation();
    const { lastSelectedId: last, selectedIds: sel, sorted: rows, onSelectAll: sa, onToggleSelect: ts } = stateRef.current;
    if (e.shiftKey && last) {
      const ids = rows.map((c) => c.id);
      const a = ids.indexOf(last);
      const b = ids.indexOf(company.id);
      if (a !== -1 && b !== -1) {
        const [start, end] = a < b ? [a, b] : [b, a];
        const rangeIds = ids.slice(start, end + 1);
        const shouldSelect = !sel.has(company.id);
        const next = new Set(sel);
        rangeIds.forEach((id) => { shouldSelect ? next.add(id) : next.delete(id); });
        sa([...next]);
        setLastSelectedId(company.id);
        return;
      }
    }
    ts(company.id);
    setLastSelectedId(company.id);
  }, []);

  const headerBtn = (label: string, key: SortKey) => (
    <button
      onClick={() => toggleSort(key)}
      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div
        className="overflow-auto"
        style={{ height: "calc(100vh - 260px)", minHeight: 400 }}
      >
        <div style={{ minWidth: MIN_TABLE_WIDTH }}>
          {/* Header */}
          <div
            className="grid sticky top-0 z-10 bg-muted/95 backdrop-blur border-b border-border"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <div className="px-2 py-3" />
            <div className="px-3 py-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={() => {
                  if (allSelected) onSelectAll([]);
                  else onSelectAll(companies.map((c) => c.id));
                }}
              />
            </div>
            <div className="px-3 py-3 text-left">{headerBtn("Empresa", "company_name")}</div>
            <div className="px-3 py-3 text-left">{headerBtn("Fit", "icp_fit")}</div>
            <div className="px-3 py-3 text-left">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</span>
            </div>
            <div className="px-3 py-3 text-left">{headerBtn("SDR", "sdr")}</div>
            <div className="px-3 py-3 text-left">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amigos</span>
            </div>
            <div className="px-3 py-3 text-left whitespace-nowrap">{headerBtn("Contactos", "contacts")}</div>
            <div className="px-3 py-3 text-left whitespace-nowrap">{headerBtn("País", "country")}</div>
            <div className="px-3 py-3 text-left">{headerBtn("Size", "size")}</div>
            <div className="px-3 py-3 text-left">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Industria</span>
            </div>
            <div className="px-3 py-3 text-left">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Experiencia</span>
            </div>
          </div>

          {/* Body */}
          {sorted.length === 0 ? (
            <div className="px-3 py-12 text-center text-muted-foreground">
              Ninguna empresa coincide con los filtros
            </div>
          ) : (
            <div>
              {sorted.map((company) => {
                return (
                  <CompanyRow
                    key={company.id}
                    company={company}
                    isSelected={selectedIds.has(company.id)}
                    isOpen={expanded.has(company.id)}
                    onRowClick={onRowClick}
                    onToggleExpand={toggleExpand}
                    onCheckboxClick={handleRowCheckboxClick}
                    onStatusChange={onStatusChange}
                    onSdrChange={onSdrChange}
                    onFitChange={onFitChange}
                    onAmigosChange={onAmigosChange}
                    onAddContact={onAddContact}
                    onRemoveContact={onRemoveContact}
                    onUpdateContact={onUpdateContact}
                    onUpdate={onUpdate}
                    onScheduleMeeting={onScheduleMeeting}
                    ae={aeByCompany?.get(company.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
