import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AE_OPTIONS, AccountExecutive, SECONDARY_AE_OPTIONS, SecondaryAe } from "@/types/meeting";
import { SDR_OPTIONS, Sdr, FIT_OPTIONS, FIT_LABELS, IcpFit, CompanySize, SIZE_OPTIONS, SIZE_LABELS } from "@/types/company";
import { DealInput } from "@/types/deal";
import { useCompanyData } from "@/hooks/useCompanyData";
import { useDealsData } from "@/hooks/useDealsData";
import { useEventsData } from "@/hooks/useEventsData";
import { supabase } from "@/integrations/supabase/client";
import { ChevronsUpDown, Plus, AlertTriangle } from "lucide-react";
import { findDuplicate } from "@/lib/duplicates";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (input: DealInput, companyName: string) => Promise<void> | void;
  initialCompanyId?: string;
}

type ContactRow = { id: string; name: string; role: string; email: string | null; linkedin: string };

function Required() {
  return <span className="text-destructive ml-0.5">*</span>;
}

export function DealDialog({ open, onOpenChange, onCreate, initialCompanyId }: Props) {
  const { allCompanies } = useCompanyData();
  const { stages } = useDealsData();
  const { events: eventList } = useEventsData();
  const [companyId, setCompanyId] = useState<string>(initialCompanyId ?? "");
  const [dealName, setDealName] = useState<string>("");
  const [dealNameTouched, setDealNameTouched] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [ae, setAe] = useState<AccountExecutive | "">("");
  const [secondaryAe, setSecondaryAe] = useState<SecondaryAe | "">("");
  const [sdr, setSdr] = useState<Sdr | "">("");
  const [value, setValue] = useState<string>("");
  const [event, setEvent] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [expectedClose, setExpectedClose] = useState<string>("");
  const [billing, setBilling] = useState<string>("");
  const [collection, setCollection] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [taskTitle, setTaskTitle] = useState("Siguiente paso");
  const [taskDate, setTaskDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  });
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Inline company creation
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCo, setNewCo] = useState({
    company_name: "",
    domain: "",
    industry: "",
    country: "Colombia",
    size: "MID" as CompanySize,
    icp_fit: "MID" as IcpFit,
    sdr: "" as Sdr | "",
  });
  const [creatingCompany, setCreatingCompany] = useState(false);

  // Inline contact creation
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "", role: "", email: "", linkedin: "", phone: "",
  });
  const [creatingContact, setCreatingContact] = useState(false);

  useEffect(() => {
    if (open) {
      setCompanyId(initialCompanyId ?? "");
      setDealName("");
      setDealNameTouched(false);
      setContactIds([]);
      setAe("");
      setSdr("");
      setValue("");
      setEvent("");
      setStageId("");
      setExpectedClose("");
      setBilling("");
      setCollection("");
      setNotes("");
      setTaskTitle("Siguiente paso");
      const d = new Date();
      d.setDate(d.getDate() + 2);
      setTaskDate(d.toISOString().split("T")[0]);
      setSubmitted(false);
      setShowNewCompany(false);
      setShowNewContact(false);
      setNewCo({ company_name: "", domain: "", industry: "", country: "Colombia", size: "MID", icp_fit: "MID", sdr: "" });
      setNewContact({ name: "", role: "", email: "", linkedin: "", phone: "" });
    }
  }, [open, initialCompanyId]);

  // Default stage to first by order once stages load
  useEffect(() => {
    if (open && !stageId && stages.length > 0) {
      const first = [...stages].sort((a, b) => a.order - b.order)[0];
      if (first) setStageId(first.id);
    }
  }, [open, stages, stageId]);

  useEffect(() => {
    if (!companyId) {
      setContacts([]);
      setContactIds([]);
      return;
    }
    (async () => {
      const { data } = await supabase.from("contacts").select("id, name, role, email, linkedin").eq("company_id", companyId);
      setContacts((data ?? []) as ContactRow[]);
    })();
  }, [companyId]);

  const selectedCompany = useMemo(() => allCompanies.find((c) => c.id === companyId), [allCompanies, companyId]);

  // Auto-suggest deal name when company/event change and user hasn't typed
  useEffect(() => {
    if (dealNameTouched) return;
    if (!selectedCompany) return;
    const suffix = event || "Sponsorship";
    setDealName(`${selectedCompany.company_name} — ${suffix}`);
  }, [selectedCompany, event, dealNameTouched]);

  const errors = {
    companyId: !companyId,
    dealName: !dealName.trim(),
    ae: !ae,
    value: !value || isNaN(Number(value)),
    stageId: !stageId,
    taskTitle: !taskTitle.trim(),
    taskDate: !taskDate,
  };
  const valid = !Object.values(errors).some(Boolean);

  const createInlineCompany = async () => {
    if (!newCo.company_name.trim()) {
      toast.error("El nombre de la empresa es obligatorio");
      return;
    }
    const dup = findDuplicate(
      {
        id: "tmp",
        company_name: newCo.company_name.trim(),
        domain: newCo.domain.trim(),
      } as never,
      allCompanies,
    );
    if (dup) {
      toast.error(`Ya existe "${dup.existing.company_name}" (coincide por ${dup.reason === "domain" ? "dominio" : "nombre"})`);
      setCompanyId(dup.existing.id);
      setShowNewCompany(false);
      return;
    }
    setCreatingCompany(true);
    const { data, error } = await supabase
      .from("companies")
      .insert({
        company_name: newCo.company_name.trim(),
        domain: newCo.domain.trim(),
        industry: newCo.industry.trim() || "Otros",
        country: newCo.country.trim() || "Colombia",
        size: newCo.size,
        icp_fit: newCo.icp_fit,
        sdr: newCo.sdr || null,
        linkedin_url: "",
        reasoning: "",
        angle: "Brand",
        status: "por_contactar",
      })
      .select()
      .single();
    setCreatingCompany(false);
    if (error || !data) {
      toast.error("Error al crear empresa");
      return;
    }
    setCompanyId((data as { id: string }).id);
    setShowNewCompany(false);
    toast.success(`${newCo.company_name.trim()} creada`);
  };

  const createInlineContact = async () => {
    if (!newContact.name.trim() || !newContact.role.trim()) {
      toast.error("Nombre y rol son obligatorios");
      return;
    }
    if (!companyId) return;
    setCreatingContact(true);
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        company_id: companyId,
        name: newContact.name.trim(),
        role: newContact.role.trim(),
        email: newContact.email.trim() || null,
        phone: newContact.phone.trim() || null,
        linkedin: newContact.linkedin.trim(),
      })
      .select()
      .single();
    setCreatingContact(false);
    if (error || !data) {
      toast.error("Error al crear contacto");
      return;
    }
    const row = data as ContactRow;
    setContacts((prev) => [...prev, row]);
    setContactIds((prev) => [...prev, row.id]);
    setShowNewContact(false);
    setNewContact({ name: "", role: "", email: "", linkedin: "", phone: "" });
    toast.success("Contacto agregado");
  };

  const submit = async () => {
    setSubmitted(true);
    if (!valid || !selectedCompany) {
      toast.error("Completa los campos obligatorios");
      return;
    }
    const due = new Date(`${taskDate}T09:00`);
    await onCreate(
      {
        company_id: companyId,
        name: dealName.trim(),
        stage_id: stageId,
        account_executive: ae as AccountExecutive,
        secondary_ae: ae === "Otro AE" && secondaryAe ? (secondaryAe as SecondaryAe) : null,
        sdr: sdr ? (sdr as Sdr) : null,
        value: Number(value),
        currency: "USD",
        event: event || null,
        expected_close_date: expectedClose || null,
        billing_date: billing || null,
        collection_date: collection || null,
        notes,
        contact_ids: contactIds,
        firstTask: {
          title: taskTitle.trim(),
          due_at: due.getTime(),
          assignee: ae as AccountExecutive,
        },
      },
      selectedCompany.company_name
    );
    onOpenChange(false);
  };

  const errClass = (hasError: boolean) =>
    submitted && hasError ? "border-destructive ring-1 ring-destructive/30" : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Nuevo deal</DialogTitle>
          <DialogDescription>El deal arranca en el primer stage y debe tener una tarea obligatoria.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Nombre del deal<Required /></Label>
            <Input
              value={dealName}
              onChange={(e) => { setDealName(e.target.value); setDealNameTouched(true); }}
              placeholder="Ej: Acme — Main Stage CTW 2026"
              className={cn(errClass(errors.dealName))}
            />
            {submitted && errors.dealName && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Ingresa un nombre para el deal
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs">Empresa<Required /></Label>
            <Popover open={companyPickerOpen} onOpenChange={setCompanyPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn("w-full justify-between font-normal", errClass(errors.companyId))}
                >
                  {selectedCompany?.company_name ?? "Selecciona empresa"}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Buscar empresa..." />
                  <CommandList>
                    <CommandEmpty>Sin resultados.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__new__"
                        onSelect={() => {
                          setShowNewCompany(true);
                          setCompanyPickerOpen(false);
                        }}
                        className="text-primary-foreground bg-primary/90 data-[selected=true]:bg-primary"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Crear nueva empresa
                      </CommandItem>
                      {allCompanies.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.company_name}
                          onSelect={() => {
                            setCompanyId(c.id);
                            setCompanyPickerOpen(false);
                          }}
                        >
                          {c.company_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {submitted && errors.companyId && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Selecciona o crea una empresa
              </p>
            )}
          </div>

          {showNewCompany && (
            <div className="rounded-md border-2 border-dashed border-primary p-3 space-y-2 bg-primary/5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase">Crear empresa</h4>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowNewCompany(false)}>
                  Cancelar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Empresa<Required /></Label>
                  <Input value={newCo.company_name} onChange={(e) => setNewCo({ ...newCo, company_name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Dominio</Label>
                  <Input value={newCo.domain} onChange={(e) => setNewCo({ ...newCo, domain: e.target.value })} placeholder="acme.com" />
                </div>
                <div>
                  <Label className="text-xs">País</Label>
                  <Input value={newCo.country} onChange={(e) => setNewCo({ ...newCo, country: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Industria</Label>
                  <Input value={newCo.industry} onChange={(e) => setNewCo({ ...newCo, industry: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Size</Label>
                  <Select value={newCo.size} onValueChange={(v) => setNewCo({ ...newCo, size: v as CompanySize })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SIZE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{SIZE_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">ICP Fit</Label>
                  <Select value={newCo.icp_fit} onValueChange={(v) => setNewCo({ ...newCo, icp_fit: v as IcpFit })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{FIT_LABELS[f]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">SDR</Label>
                  <Select value={newCo.sdr || "__none"} onValueChange={(v) => setNewCo({ ...newCo, sdr: v === "__none" ? "" : (v as Sdr) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sin SDR</SelectItem>
                      {SDR_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={createInlineCompany} disabled={creatingCompany} className="w-full">
                {creatingCompany ? "Creando..." : "Crear empresa y seleccionar"}
              </Button>
            </div>
          )}

          {companyId && (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Contactos asociados</Label>
                <button
                  type="button"
                  onClick={() => setShowNewContact((v) => !v)}
                  className="text-xs text-primary-foreground bg-primary hover:bg-primary/90 font-medium rounded px-2 py-0.5 inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Nuevo contacto
                </button>
              </div>
              {contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sin contactos en esta empresa.</p>
              ) : (
                <div className="space-y-1.5 mt-1.5 max-h-40 overflow-y-auto border rounded-md p-2">
                  {contacts.map((k) => {
                    const checked = contactIds.includes(k.id);
                    return (
                      <label key={k.id} className="flex items-start gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setContactIds((prev) =>
                              v ? [...prev, k.id] : prev.filter((x) => x !== k.id)
                            );
                          }}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium">{k.name}</span>{" "}
                          <span className="text-muted-foreground">— {k.role}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {showNewContact && (
                <div className="mt-2 rounded-md border-2 border-dashed border-foreground/40 p-3 space-y-2 bg-muted/30">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Nombre<Required /></Label>
                      <Input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Rol<Required /></Label>
                      <Input value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">LinkedIn</Label>
                      <Input value={newContact.linkedin} onChange={(e) => setNewContact({ ...newContact, linkedin: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Teléfono</Label>
                      <Input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowNewContact(false)}>Cancelar</Button>
                    <Button size="sm" className="flex-1" onClick={createInlineContact} disabled={creatingContact}>
                      {creatingContact ? "Creando..." : "Crear contacto"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Account Executive<Required /></Label>
              <Select value={ae} onValueChange={(v) => { setAe(v as AccountExecutive); if (v !== "Otro AE") setSecondaryAe(""); }}>
                <SelectTrigger className={cn(errClass(errors.ae))}><SelectValue placeholder="AE" /></SelectTrigger>
                <SelectContent>
                  {AE_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              {submitted && errors.ae && <p className="text-xs text-destructive mt-1">Obligatorio</p>}
              {ae === "Otro AE" && (
                <Select value={secondaryAe} onValueChange={(v) => setSecondaryAe(v as SecondaryAe)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="¿Qué AE?" /></SelectTrigger>
                  <SelectContent>
                    {SECONDARY_AE_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label className="text-xs">Stage<Required /></Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className={cn(errClass(errors.stageId))}><SelectValue placeholder="Stage" /></SelectTrigger>
                <SelectContent>
                  {[...stages].sort((a, b) => a.order - b.order).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} · {s.probability}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {submitted && errors.stageId && <p className="text-xs text-destructive mt-1">Obligatorio</p>}
            </div>
            <div>
              <Label className="text-xs">SDR</Label>
              <Select value={sdr} onValueChange={(v) => setSdr(v as Sdr)}>
                <SelectTrigger><SelectValue placeholder="SDR" /></SelectTrigger>
                <SelectContent>
                  {SDR_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor (USD)<Required /></Label>
              <Input type="number" min="0" step="100" value={value} onChange={(e) => setValue(e.target.value)} className={cn(errClass(errors.value))} />
              {submitted && errors.value && <p className="text-xs text-destructive mt-1">Obligatorio</p>}
            </div>
            <div>
              <Label className="text-xs">Evento</Label>
              <Select value={event || "__none"} onValueChange={(v) => setEvent(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Evento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin evento</SelectItem>
                  {eventList.map((ev) => (
                    <SelectItem key={ev.id} value={ev.name}>{ev.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fecha estimada de cierre</Label>
              <Input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Fecha de facturación</Label>
              <Input type="date" value={billing} onChange={(e) => setBilling(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Fecha de recaudo</Label>
              <Input type="date" value={collection} onChange={(e) => setCollection(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Tarea inicial (obligatoria)</p>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Ej: Enviar propuesta" className={cn(errClass(errors.taskTitle))} />
              <Input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} className={cn("w-44", errClass(errors.taskDate))} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Crear deal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}