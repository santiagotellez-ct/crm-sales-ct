import { useState, useEffect } from "react";
import { X, Trash2, Plus, Pencil, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { Deal, DealStage, ChecklistEntry } from "@/types/deal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AE_OPTIONS, AccountExecutive, SECONDARY_AE_OPTIONS, SecondaryAe } from "@/types/meeting";
import { SDR_OPTIONS, Sdr, Contact } from "@/types/company";
import { useTeamMemberNames } from "@/hooks/useTeamMembers";
import { useCompanyData } from "@/hooks/useCompanyData";
import { useEventsData } from "@/hooks/useEventsData";
import { DEAL_CHECKLISTS, itemId } from "@/lib/dealChecklists";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function normalizeEntry(v: unknown): ChecklistEntry {
  if (v && typeof v === "object" && "checked" in (v as object)) {
    const o = v as { checked?: unknown; result?: unknown };
    return { checked: !!o.checked, result: typeof o.result === "string" ? o.result : "" };
  }
  return { checked: !!v, result: "" };
}

interface Props {
  deal: Deal;
  stages: DealStage[];
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Deal>) => Promise<void> | void;
  onAddTask: (dealId: string, title: string, dueAt: number, assignee: AccountExecutive | null) => Promise<void> | void;
  onToggleTask: (taskId: string, completed: boolean) => Promise<void> | void;
  onUpdateTask: (taskId: string, patch: { title?: string; due_at?: number }) => Promise<void> | void;
  onDeleteTask: (taskId: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function DealDetailDrawer({
  deal, stages, onClose, onUpdate, onAddTask, onToggleTask, onUpdateTask, onDeleteTask, onDelete,
}: Props) {
  const { allCompanies, updateCompany, addContact } = useCompanyData();
  const { events: eventList } = useEventsData();
  const { sdrNames, isLoading: sdrLoading } = useTeamMemberNames();
  const sdrOptions = sdrLoading || sdrNames.length === 0 ? SDR_OPTIONS : sdrNames;
  const company = allCompanies.find((c) => c.id === deal.company_id);
  const stage = stages.find((s) => s.id === deal.stage_id);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(deal.name);
  const [domainDraft, setDomainDraft] = useState(company?.domain ?? "");
  const [editingDomain, setEditingDomain] = useState(false);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companyContacts, setCompanyContacts] = useState<{ id: string; name: string; role: string }[]>([]);
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", role: "", email: "", linkedin: "", phone: "" });
  const [creatingContact, setCreatingContact] = useState(false);
  const [stageHistory, setStageHistory] = useState<{ stage_id: string; entered_at: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("deal_stage_history")
        .select("stage_id, entered_at")
        .eq("deal_id", deal.id)
        .order("entered_at", { ascending: true });
      if (!cancelled) setStageHistory(data ?? []);
    })();
    return () => { cancelled = true; };
  }, [deal.id, deal.stage_id]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  });
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");

  useEffect(() => {
    setDomainDraft(company?.domain ?? "");
  }, [company?.domain]);

  const reloadContacts = async () => {
    if (!deal.company_id) return;
    const { data } = await supabase
      .from("contacts")
      .select("id, name, role")
      .eq("company_id", deal.company_id);
    setCompanyContacts((data ?? []) as { id: string; name: string; role: string }[]);
  };

  useEffect(() => {
    reloadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.company_id]);

  const toggleContact = async (contactId: string, checked: boolean) => {
    const next = checked
      ? [...deal.contact_ids, contactId]
      : deal.contact_ids.filter((c) => c !== contactId);
    await onUpdate(deal.id, { contact_ids: next });
    if (checked) {
      await supabase.from("deal_contacts").insert({ deal_id: deal.id, contact_id: contactId });
    } else {
      await supabase.from("deal_contacts").delete().eq("deal_id", deal.id).eq("contact_id", contactId);
    }
  };

  const createInlineContact = async () => {
    if (!newContact.name.trim() || !newContact.role.trim()) {
      toast.error("Nombre y rol son obligatorios");
      return;
    }
    setCreatingContact(true);
    const contactPayload: Contact = {
      name: newContact.name.trim(),
      role: newContact.role.trim(),
      email: newContact.email.trim() || undefined,
      phone: newContact.phone.trim() || undefined,
      linkedin: newContact.linkedin.trim(),
    };
    await addContact(deal.company_id, contactPayload);
    setCreatingContact(false);
    setShowNewContact(false);
    setNewContact({ name: "", role: "", email: "", linkedin: "", phone: "" });
    toast.success("Contacto agregado");
    // Refresh and auto-link the new contact to this deal
    const { data } = await supabase
      .from("contacts")
      .select("id, name, role")
      .eq("company_id", deal.company_id);
    const rows = (data ?? []) as { id: string; name: string; role: string }[];
    setCompanyContacts(rows);
    const newRow = rows.find((r) => r.name === contactPayload.name && r.role === contactPayload.role);
    if (newRow) {
      await onUpdate(deal.id, { contact_ids: [...deal.contact_ids, newRow.id] });
      await supabase.from("deal_contacts").insert({ deal_id: deal.id, contact_id: newRow.id });
    }
  };

  const submitTask = async () => {
    if (!taskTitle.trim()) return;
    await onAddTask(deal.id, taskTitle.trim(), new Date(`${taskDate}T09:00`).getTime(), deal.account_executive);
    setTaskTitle("");
  };

  return (
    <>
      <div className="fixed inset-0 bg-foreground/20 z-40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 w-full max-w-xl bg-background border-l border-border z-50 overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border px-5 py-3 flex items-center justify-between z-10">
          <div>
            {editingName ? (
              <div className="flex items-center gap-1">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="h-7 text-base font-bold w-72"
                  autoFocus
                />
                <button
                  className="p-1 rounded hover:bg-muted"
                  onClick={async () => {
                    const v = nameDraft.trim();
                    if (v && v !== deal.name) await onUpdate(deal.id, { name: v });
                    setEditingName(false);
                  }}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                className="font-bold text-lg text-foreground hover:underline text-left flex items-center gap-1"
                onClick={() => { setNameDraft(deal.name); setEditingName(true); }}
              >
                {deal.name || deal.company_name}
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-medium text-foreground">{deal.company_name}</span>
              {company?.domain && (
                <>
                  {" · "}
                  <a
                    href={company.domain.startsWith("http") ? company.domain : `https://${company.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary hover:underline"
                  >
                    {company.domain}
                  </a>
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {money(deal.value)} · {stage?.name}{stage ? ` (${stage.probability}%)` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Creado {format(new Date(deal.created_at), "dd MMM yyyy")}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-muted-foreground">Empresa & contactos</h3>
              {company && (
                <button
                  type="button"
                  onClick={() => setShowNewContact((v) => !v)}
                  className="text-[11px] font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded px-2 py-1 inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Nuevo contacto
                </button>
              )}
            </div>

            {company && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0 text-xs w-16">Empresa:</span>
                  <Popover open={companyPickerOpen} onOpenChange={setCompanyPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="flex-1 h-7 justify-between font-normal text-sm">
                        <span className="truncate">{company.company_name}</span>
                        <ChevronsUpDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar empresa..." />
                        <CommandList>
                          <CommandEmpty>Sin resultados.</CommandEmpty>
                          <CommandGroup>
                            {allCompanies.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.company_name}
                                onSelect={async () => {
                                  setCompanyPickerOpen(false);
                                  if (c.id === deal.company_id) return;
                                  await onUpdate(deal.id, {
                                    company_id: c.id,
                                    company_name: c.company_name,
                                    contact_ids: [],
                                  });
                                  await supabase.from("deal_contacts").delete().eq("deal_id", deal.id);
                                  toast.success("Empresa actualizada");
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
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0 text-xs w-16">Dominio:</span>
                {editingDomain ? (
                  <>
                    <Input
                      value={domainDraft}
                      onChange={(e) => setDomainDraft(e.target.value)}
                      placeholder="acme.com"
                      className="h-7 text-sm flex-1"
                      autoFocus
                    />
                    <button
                      onClick={async () => {
                        const v = domainDraft.trim();
                        if (v !== (company.domain ?? "")) {
                          await updateCompany(company.id, { domain: v });
                          toast.success("Dominio actualizado");
                        }
                        setEditingDomain(false);
                      }}
                      className="p-1 rounded hover:bg-muted"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <>
                    {company.domain ? (
                      <a
                        href={company.domain.startsWith("http") ? company.domain : `https://${company.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:text-primary hover:underline truncate"
                      >
                        {company.domain}
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">sin dominio</span>
                    )}
                    <button
                      onClick={() => { setDomainDraft(company.domain ?? ""); setEditingDomain(true); }}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </>
                )}
                </div>
              </div>
            )}

            {companyContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sin contactos en esta empresa.</p>
            ) : (
              <div className="space-y-1 border border-border rounded-md p-2 max-h-44 overflow-y-auto">
                {companyContacts.map((k) => {
                  const checked = deal.contact_ids.includes(k.id);
                  return (
                    <label key={k.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleContact(k.id, !!v)}
                      />
                      <span className="truncate">
                        <span className="font-medium text-foreground">{k.name}</span>{" "}
                        <span className="text-muted-foreground">— {k.role}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {showNewContact && (
              <div className="rounded-md border-2 border-dashed border-foreground/40 p-3 space-y-2 bg-muted/30">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nombre<span className="text-destructive">*</span></Label>
                    <Input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Rol<span className="text-destructive">*</span></Label>
                    <Input value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">LinkedIn</Label>
                    <Input value={newContact.linkedin} onChange={(e) => setNewContact({ ...newContact, linkedin: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Teléfono</Label>
                    <Input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowNewContact(false)}>Cancelar</Button>
                  <Button size="sm" className="flex-1" onClick={createInlineContact} disabled={creatingContact}>
                    {creatingContact ? "Creando..." : "Crear y vincular"}
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-muted-foreground">Datos</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Stage</Label>
                <Select value={deal.stage_id} onValueChange={(v) => onUpdate(deal.id, { stage_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {stageHistory.length > 0 && (
                  <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                    {stageHistory.map((h, i) => {
                      const s = stages.find((x) => x.id === h.stage_id);
                      return (
                        <div key={i} className="flex justify-between gap-2">
                          <span className="truncate">{s?.name ?? "—"}</span>
                          <span>{format(new Date(h.entered_at), "dd MMM yy")}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs">Valor (USD)</Label>
                <Input type="number" value={deal.value} onChange={(e) => onUpdate(deal.id, { value: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">AE</Label>
                <Select value={deal.account_executive} onValueChange={(v) => onUpdate(deal.id, { account_executive: v as AccountExecutive })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AE_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {deal.account_executive === "Otro AE" && (
                <div>
                  <Label className="text-xs">Sub-AE</Label>
                  <Select
                    value={deal.secondary_ae ?? "__none"}
                    onValueChange={(v) => onUpdate(deal.id, { secondary_ae: v === "__none" ? null : (v as SecondaryAe) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sin asignar</SelectItem>
                      {SECONDARY_AE_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">SDR</Label>
                <Select value={deal.sdr ?? "__none"} onValueChange={(v) => onUpdate(deal.id, { sdr: v === "__none" ? null : v as Sdr })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sin SDR</SelectItem>
                    {sdrOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Evento</Label>
                <Select value={deal.event ?? "__none"} onValueChange={(v) => onUpdate(deal.id, { event: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sin evento</SelectItem>
                    {eventList.map((ev) => (
                      <SelectItem key={ev.id} value={ev.name}>{ev.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Creado</Label>
                <Input
                  type="date"
                  value={format(new Date(deal.created_at), "yyyy-MM-dd")}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const ts = new Date(`${e.target.value}T12:00`).getTime();
                    onUpdate(deal.id, { created_at: ts });
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Cierre</Label>
                <Input
                  type="date"
                  value={deal.expected_close_date ?? ""}
                  onChange={(e) => onUpdate(deal.id, { expected_close_date: e.target.value || null })}
                  className="h-8 text-xs px-2"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Facturación</Label>
                <Input
                  type="date"
                  value={deal.billing_date ?? ""}
                  onChange={(e) => onUpdate(deal.id, { billing_date: e.target.value || null })}
                  className="h-8 text-xs px-2"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Recaudo</Label>
                <Input
                  type="date"
                  value={deal.collection_date ?? ""}
                  onChange={(e) => onUpdate(deal.id, { collection_date: e.target.value || null })}
                  className="h-8 text-xs px-2"
                />
              </div>
            </div>
            {stage?.is_lost && (
              <div>
                <Label className="text-xs">Motivo de pérdida</Label>
                <Input value={deal.lost_reason ?? ""} onChange={(e) => onUpdate(deal.id, { lost_reason: e.target.value })} />
              </div>
            )}
          </section>

          {(stage?.name === "Commited" || stage?.is_won || deal.paquete_vendido || deal.sponsor_pain || deal.sponsor_icp || deal.adicionales_paquete) && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-muted-foreground">Cierre (Commited)</h3>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Paquete vendido</Label>
                  <Textarea rows={2} value={deal.paquete_vendido ?? ""} onChange={(e) => onUpdate(deal.id, { paquete_vendido: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Adicionales al paquete</Label>
                  <Textarea rows={2} value={deal.adicionales_paquete ?? ""} onChange={(e) => onUpdate(deal.id, { adicionales_paquete: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Pain / expectativa del sponsor</Label>
                  <Textarea rows={2} value={deal.sponsor_pain ?? ""} onChange={(e) => onUpdate(deal.id, { sponsor_pain: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">ICP del sponsor</Label>
                  <Textarea rows={2} value={deal.sponsor_icp ?? ""} onChange={(e) => onUpdate(deal.id, { sponsor_icp: e.target.value })} />
                </div>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-muted-foreground">Checklist</h3>
            {DEAL_CHECKLISTS.filter((g) => !stage || g.stageOrder <= (stage.order ?? 99)).map((group) => {
              const done = group.items.filter((it) => normalizeEntry(deal.checklist?.[itemId(group.stageKey, it.key)]).checked).length;
              const total = group.items.length;
              const complete = done === total;
              return (
                <div key={group.stageKey} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium text-muted-foreground">{group.title}</h4>
                    <span className={`text-[10px] ${complete ? "text-score-high font-medium" : "text-muted-foreground"}`}>
                      {done}/{total}
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {group.items.map((it) => {
                      const id = itemId(group.stageKey, it.key);
                      const entry = normalizeEntry(deal.checklist?.[id]);
                      const writeResult = (result: string) => {
                        const next = { ...(deal.checklist ?? {}) };
                        next[id] = { checked: entry.checked, result };
                        onUpdate(deal.id, { checklist: next });
                      };
                      const isSelect = it.type === "select" && it.options;
                      // For select with "other text", store as "Option" or "Otras: <text>"
                      const selectedOption = isSelect
                        ? (it.options!.find((o) => entry.result === o || entry.result.startsWith(`${o}:`)) ?? "")
                        : "";
                      const otherText = isSelect && selectedOption && entry.result.startsWith(`${selectedOption}:`)
                        ? entry.result.slice(selectedOption.length + 1).trim()
                        : "";
                      return (
                        <li key={it.key} className="flex items-center gap-2 text-sm py-1">
                          <Checkbox
                            checked={entry.checked}
                            onCheckedChange={(v) => {
                              const next = { ...(deal.checklist ?? {}) };
                              next[id] = { checked: !!v, result: entry.result };
                              onUpdate(deal.id, { checklist: next });
                            }}
                          />
                          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {it.label}
                          </span>
                          {isSelect ? (
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              <Select
                                value={selectedOption || "__none"}
                                onValueChange={(v) => {
                                  if (v === "__none") return writeResult("");
                                  if (it.allowOtherText && v === "Otras") {
                                    writeResult(otherText ? `Otras: ${otherText}` : "Otras");
                                  } else {
                                    writeResult(v);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 text-sm px-2 flex-1 min-w-0 font-medium text-foreground bg-muted/40">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">—</SelectItem>
                                  {it.options!.map((o) => (
                                    <SelectItem key={o} value={o}>{o}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {it.allowOtherText && selectedOption === "Otras" && (
                                <Input
                                  value={otherText}
                                  onChange={(e) => writeResult(e.target.value ? `Otras: ${e.target.value}` : "Otras")}
                                  placeholder="¿Cuál?"
                                  className="h-7 text-sm flex-1 min-w-0 px-2 font-medium text-foreground bg-muted/40 border border-border rounded focus-visible:ring-1 focus-visible:ring-primary"
                                />
                              )}
                            </div>
                          ) : (
                            <Input
                              value={entry.result}
                              onChange={(e) => writeResult(e.target.value)}
                              placeholder="—"
                              className="h-7 text-sm flex-1 min-w-0 px-2 font-medium text-foreground bg-muted/40 border border-border rounded focus-visible:ring-1 focus-visible:ring-primary"
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-muted-foreground">Notas</h3>
            <Textarea value={deal.notes} onChange={(e) => onUpdate(deal.id, { notes: e.target.value })} rows={4} />
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-muted-foreground">Tareas</h3>
            <ul className="space-y-1.5">
              {deal.tasks
                .sort((a, b) => Number(a.completed) - Number(b.completed) || a.due_at - b.due_at)
              .map((t) => {
                const isEditing = editingTask === t.id;
                return (
                  <li key={t.id} className="flex items-start gap-2 p-2 rounded-md border border-border text-sm">
                    <Checkbox checked={t.completed} onCheckedChange={(v) => onToggleTask(t.id, !!v)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5">
                          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-7 text-sm" />
                          <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-7 text-sm w-40" />
                        </div>
                      ) : (
                        <>
                          <div className={t.completed ? "line-through text-muted-foreground" : "font-medium"}>{t.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(t.due_at), "dd MMM yyyy")}{t.assignee ? ` · ${t.assignee}` : ""}
                          </div>
                        </>
                      )}
                    </div>
                    {isEditing ? (
                      <button
                        onClick={async () => {
                          const patch: { title?: string; due_at?: number } = {};
                          if (editTitle.trim() && editTitle.trim() !== t.title) patch.title = editTitle.trim();
                          if (editDate) {
                            const ts = new Date(`${editDate}T09:00`).getTime();
                            if (ts !== t.due_at) patch.due_at = ts;
                          }
                          if (Object.keys(patch).length) await onUpdateTask(t.id, patch);
                          setEditingTask(null);
                        }}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingTask(t.id);
                          setEditTitle(t.title);
                          setEditDate(format(new Date(t.due_at), "yyyy-MM-dd"));
                        }}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => onDeleteTask(t.id)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
              {deal.tasks.length === 0 && !stage?.is_won && (
                <li className="text-xs text-destructive italic">Este deal no tiene tareas — agrega una abajo.</li>
              )}
            </ul>
            <div className="flex gap-2 pt-2">
              <Input placeholder="Nueva tarea" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
              <Input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} className="w-40" />
              <Button size="sm" onClick={submitTask} disabled={!taskTitle.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </section>

          <div className="border-t pt-4">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("¿Eliminar este deal? Esta acción no se puede deshacer.")) {
                  onDelete(deal.id);
                  onClose();
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar deal
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}