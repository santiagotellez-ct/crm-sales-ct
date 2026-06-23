import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Company, IcpFit, FIT_OPTIONS, FIT_LABELS, Sdr, SDR_OPTIONS, Angle, CompanySize, SIZE_OPTIONS, SIZE_LABELS } from "@/types/company";
import { Upload, Plus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { detectBatchDuplicates, findDuplicate, DuplicateMatch } from "@/lib/duplicates";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (companies: Company[]) => void;
  existingCompanies: Company[];
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function newId() {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeFit(v: unknown): IcpFit {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ABM" || s === "HIGH" || s === "MID" || s === "MAYBE") return s;
  return "MAYBE";
}

function normalizeSdr(v: unknown): Sdr | null {
  const s = String(v ?? "").trim();
  return (SDR_OPTIONS as string[]).includes(s) ? (s as Sdr) : null;
}

function normalizeAngle(v: unknown): Angle {
  const s = String(v ?? "").trim();
  if (s === "Hiring" || s === "Brand" || s === "Enterprise" || s === "Partnerships") return s;
  return "Brand";
}

function normalizeSize(v: unknown): CompanySize {
  const raw = String(v ?? "").trim().toUpperCase();
  if (raw === "SMB" || raw === "MID" || raw === "ENTERPRISE") return raw;
  const n = Number(raw);
  if (!isNaN(n) && n > 0) {
    if (n < 250) return "SMB";
    if (n <= 5000) return "MID";
    return "ENTERPRISE";
  }
  return "MID";
}

function rowToCompany(row: Record<string, unknown>): Company | null {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(row).find((rk) => rk.toLowerCase().trim() === k.toLowerCase());
      if (found && row[found] != null && String(row[found]).trim() !== "") return row[found];
    }
    return undefined;
  };
  const name = get("company_name", "company", "empresa", "name");
  if (!name) return null;
  return {
    id: newId(),
    company_name: String(name).trim(),
    domain: String(get("domain", "website", "dominio") ?? "").trim(),
    industry: String(get("industry", "industria") ?? "Otros").trim(),
    size: normalizeSize(get("size", "tamaño", "headcount", "employees", "empleados")),
    country: String(get("country", "pais", "país") ?? "Colombia").trim(),
    linkedin_url: String(get("linkedin_url", "linkedin") ?? "").trim(),
    icp_fit: normalizeFit(get("icp_fit", "fit")),
    reasoning: String(get("reasoning", "razon", "razón", "notes") ?? "").trim(),
    angle: normalizeAngle(get("angle", "angulo", "ángulo")),
    contacts: [],
    status: "por_contactar",
    sdr: normalizeSdr(get("sdr", "owner")),
    notes: "",
    reviewed: false,
    created_at: todayStr(),
    experiencia_target: (() => {
      const v = get("experiencia_target", "experiencia target", "experiencia", "experience");
      const s = v != null ? String(v).trim() : "";
      return s || null;
    })(),
  };
}

export function AddCompanyDialog({ open, onOpenChange, onAdd, existingCompanies }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingDupes, setPendingDupes] = useState<DuplicateMatch[]>([]);
  const [pendingClean, setPendingClean] = useState<Company[]>([]);
  const [skipIds, setSkipIds] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    domain: "",
    industry: "",
    country: "Colombia",
    size: "MID" as CompanySize,
    linkedin_url: "",
    icp_fit: "MID" as IcpFit,
    sdr: "" as Sdr | "",
    reasoning: "",
    experiencia_target: "",
  });

  const reset = () => setForm({
    company_name: "", domain: "", industry: "", country: "Colombia",
    size: "MID", linkedin_url: "", icp_fit: "MID", sdr: "", reasoning: "", experiencia_target: "",
  });

  const handleManualAdd = () => {
    setSubmitted(true);
    if (!form.company_name.trim()) {
      toast.error("El nombre de la empresa es obligatorio");
      return;
    }
    const company: Company = {
      id: newId(),
      company_name: form.company_name.trim(),
      domain: form.domain.trim(),
      industry: form.industry.trim() || "Otros",
      size: form.size,
      country: form.country.trim() || "Colombia",
      linkedin_url: form.linkedin_url.trim(),
      icp_fit: form.icp_fit,
      reasoning: form.reasoning.trim(),
      angle: "Brand",
      contacts: [],
      status: "por_contactar",
      sdr: form.sdr || null,
      notes: "",
      reviewed: false,
      created_at: todayStr(),
      experiencia_target: form.experiencia_target.trim() || null,
    };
    const dup = findDuplicate(company, existingCompanies);
    if (dup) {
      setPendingDupes([{ candidate: company, existing: dup.existing, reason: dup.reason }]);
      setPendingClean([]);
      setSkipIds(new Set([company.id]));
      return;
    }
    onAdd([company]);
    toast.success(`${company.company_name} agregada`);
    reset();
    setSubmitted(false);
    onOpenChange(false);
  };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      const companies = rows.map(rowToCompany).filter((c): c is Company => !!c);
      if (companies.length === 0) {
        toast.error("No se encontraron empresas válidas. Verifica que haya una columna 'company_name'.");
        return;
      }
      const dupes = detectBatchDuplicates(companies, existingCompanies);
      const dupCandidateIds = new Set(dupes.map((d) => d.candidate.id));
      const clean = companies.filter((c) => !dupCandidateIds.has(c.id));
      if (dupes.length === 0) {
        onAdd(companies);
        toast.success(`${companies.length} empresas importadas`);
        onOpenChange(false);
        return;
      }
      setPendingDupes(dupes);
      setPendingClean(clean);
      setSkipIds(new Set(dupes.map((d) => d.candidate.id)));
    } catch (e) {
      console.error(e);
      toast.error("Error al leer el archivo");
    }
  };

  const confirmImport = () => {
    const toImport = [
      ...pendingClean,
      ...pendingDupes.filter((d) => !skipIds.has(d.candidate.id)).map((d) => d.candidate),
    ];
    if (toImport.length > 0) {
      onAdd(toImport);
      toast.success(`${toImport.length} empresa(s) importadas`);
    } else {
      toast.info("No se importó ninguna empresa");
    }
    setPendingDupes([]);
    setPendingClean([]);
    setSkipIds(new Set());
    reset();
    onOpenChange(false);
  };

  const cancelDupReview = () => {
    setPendingDupes([]);
    setPendingClean([]);
    setSkipIds(new Set());
  };

  const toggleSkip = (id: string) => {
    setSkipIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (pendingDupes.length > 0) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) cancelDupReview(); onOpenChange(o); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-score-medium" />
              Posibles duplicados detectados
            </DialogTitle>
            <DialogDescription>
              {pendingDupes.length} de {pendingDupes.length + pendingClean.length} empresa(s) coinciden con registros existentes.
              Desmarca las que quieras importar de todos modos.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {pendingDupes.map((d) => {
              const skip = skipIds.has(d.candidate.id);
              return (
                <label key={d.candidate.id} className="flex items-start gap-3 p-3 border border-border rounded-md cursor-pointer hover:bg-muted/40">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={skip}
                    onChange={() => toggleSkip(d.candidate.id)}
                  />
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-foreground">
                      {d.candidate.company_name}
                      <span className="text-muted-foreground font-normal"> · {d.candidate.domain || "sin dominio"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Coincide por <span className="font-medium text-foreground">{d.reason === "domain" ? "dominio" : "nombre"}</span> con{" "}
                      <span className="font-medium text-foreground">{d.existing.company_name}</span>
                      {d.existing.domain ? ` (${d.existing.domain})` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {skip ? "Se omitirá" : "Se importará como nueva empresa"}
                    </div>
                  </div>
                </label>
              );
            })}
            {pendingClean.length > 0 && (
              <div className="text-xs text-muted-foreground p-2">
                + {pendingClean.length} empresa(s) sin duplicados se importarán automáticamente.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDupReview}>Cancelar</Button>
            <Button onClick={confirmImport}>
              Importar {pendingClean.length + pendingDupes.filter((d) => !skipIds.has(d.candidate.id)).length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Añadir empresas</DialogTitle>
          <DialogDescription>Agrega una empresa manualmente o importa desde CSV / XLSX.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual"><Plus className="h-3.5 w-3.5 mr-1.5" />Manual</TabsTrigger>
            <TabsTrigger value="bulk"><Upload className="h-3.5 w-3.5 mr-1.5" />Bulk (CSV/XLSX)</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Empresa <span className="text-destructive">*</span></Label>
                <Input
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className={cn(submitted && !form.company_name.trim() && "border-destructive ring-1 ring-destructive/30")}
                />
                {submitted && !form.company_name.trim() && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> El nombre es obligatorio
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">Dominio</Label>
                <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="acme.com" />
              </div>
              <div>
                <Label className="text-xs">LinkedIn</Label>
                <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Industria</Label>
                <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">País</Label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Size</Label>
                <Select value={form.size} onValueChange={(v) => setForm({ ...form, size: v as CompanySize })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{SIZE_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">ICP Fit</Label>
                <Select value={form.icp_fit} onValueChange={(v) => setForm({ ...form, icp_fit: v as IcpFit })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{FIT_LABELS[f]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">SDR asignado</Label>
                <Select value={form.sdr || "NONE"} onValueChange={(v) => setForm({ ...form, sdr: v === "NONE" ? "" : (v as Sdr) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sin asignar</SelectItem>
                    {SDR_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Razón / Notas</Label>
                <Input value={form.reasoning} onChange={(e) => setForm({ ...form, reasoning: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Experiencia target</Label>
                <Input
                  value={form.experiencia_target}
                  onChange={(e) => setForm({ ...form, experiencia_target: e.target.value })}
                  placeholder="Ej: Visionaries Gala"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleManualAdd}>Añadir empresa</Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-foreground mb-1">Sube un archivo CSV o XLSX</p>
              <p className="text-xs text-muted-foreground mb-4">
                Columnas reconocidas: company_name, domain, industry, country, size (SMB/MID/ENTERPRISE), linkedin_url, icp_fit, sdr, reasoning, experiencia_target
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <Button onClick={() => fileRef.current?.click()}>Seleccionar archivo</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Solo <code className="text-foreground">company_name</code> es obligatorio. Las empresas se importan con estado "Por contactar".
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}