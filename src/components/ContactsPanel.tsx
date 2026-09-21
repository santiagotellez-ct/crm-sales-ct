import { useCallback, useEffect, useMemo, useState } from "react";
import { Company, Contact, ContactTouch, ContactedFrom, CONTACTED_FROM_OPTIONS, Sdr } from "@/types/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Linkedin, Loader2, Sparkles, Trash2, Plus, Mail, Phone, Pencil, Check, X, AlertTriangle, Hand } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { findContactCreationGate } from "@/lib/duplicates";
import { cn } from "@/lib/utils";
import { LogTouchDialog, TOUCH_STAGE_LABELS } from "@/components/LogTouchDialog";
import { useCatalog } from "@/hooks/useCatalog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  companyId: string;
  contacts: Contact[];
  /** Full CRM company list for cross-company email/LinkedIn hard block. */
  allCompanies?: Company[];
  defaultSdr?: Sdr | null;
  onAdd: (companyId: string, contact: Contact) => void | Promise<void>;
  onRemove: (companyId: string, linkedin: string) => void;
  onUpdate?: (companyId: string, oldLinkedin: string, updates: Partial<Contact>) => void;
  onOpenExisting?: (company: Company) => void;
  onApplyTouch?: (
    contactId: string,
    payload: { channel?: string; account_used?: string; sdr?: string; note?: string },
  ) => Promise<{
    touch_id?: string;
    from_status?: string;
    to_status?: string;
    advanced?: boolean;
  } | null | undefined>;
  /** Highlight this contact when opened from the kanban. */
  focusContactId?: string | null;
  compact?: boolean;
}

function catalogLabel(options: { code: string; label: string }[], code: string | null | undefined) {
  if (!code) return null;
  return options.find((o) => o.code === code)?.label ?? code;
}

export function ContactsPanel({
  companyId,
  contacts,
  allCompanies = [],
  defaultSdr,
  onAdd,
  onRemove,
  onUpdate,
  onOpenExisting,
  onApplyTouch,
  focusContactId,
  compact = false,
}: Props) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactedFrom, setContactedFrom] = useState<ContactedFrom[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Contact | null>(null);
  const [touchFor, setTouchFor] = useState<Contact | null>(null);
  const [touches, setTouches] = useState<ContactTouch[]>([]);
  const [touchesLoading, setTouchesLoading] = useState(false);
  const [expandedTouchIds, setExpandedTouchIds] = useState<Set<string>>(new Set());
  const [hardBlock, setHardBlock] = useState<{
    contact: Contact;
    company: Company;
    reason: "email" | "linkedin";
  } | null>(null);

  const { options: channelOptions } = useCatalog("channel");
  const { options: seatOptions } = useCatalog("linkedin_seat");

  const loadTouches = useCallback(async () => {
    setTouchesLoading(true);
    const { data, error } = await supabase
      .from("touches")
      .select("id, contact_id, company_id, touched_at, channel, account_used, sdr, note")
      .eq("company_id", companyId)
      .order("touched_at", { ascending: false });
    setTouchesLoading(false);
    if (error) {
      console.error("load touches failed", error.message);
      return;
    }
    setTouches((data ?? []) as ContactTouch[]);
  }, [companyId]);

  useEffect(() => {
    void loadTouches();
  }, [loadTouches]);

  const touchesByContact = useMemo(() => {
    const m = new Map<string, ContactTouch[]>();
    for (const t of touches) {
      const list = m.get(t.contact_id) ?? [];
      list.push(t);
      m.set(t.contact_id, list);
    }
    return m;
  }, [touches]);

  const toggleTouchHistory = (contactId: string) => {
    setExpandedTouchIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const reset = () => {
    setLinkedinUrl(""); setName(""); setRole(""); setEmail(""); setPhone(""); setContactedFrom([]); setShowForm(false);
    setHardBlock(null);
  };

  const runGate = (opts: { email?: string; linkedin?: string; ignoreLinkedin?: string; ignoreEmail?: string }) => {
    try {
      const gate = findContactCreationGate(
        {
          email: opts.email,
          linkedin: opts.linkedin,
          ignoreLinkedin: opts.ignoreLinkedin,
          ignoreEmail: opts.ignoreEmail,
        },
        allCompanies,
      );
      setHardBlock(gate.hard);
      return gate.hard;
    } catch (e) {
      console.error("contact duplicate gate failed", e);
      setHardBlock(null);
      return null;
    }
  };

  const ContactedFromChips = ({ value, onChange }: { value: ContactedFrom[]; onChange: (v: ContactedFrom[]) => void }) => (
    <div className="flex flex-wrap gap-1">
      <span className="text-[11px] text-muted-foreground mr-1 self-center">Contactado desde:</span>
      {CONTACTED_FROM_OPTIONS.map((o) => {
        const active = value.includes(o);
        return (
          <button
            type="button"
            key={o}
            onClick={() => onChange(active ? value.filter((x) => x !== o) : [...value, o])}
            className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${active ? "bg-primary/15 text-primary border-primary/40" : "bg-muted text-muted-foreground border-transparent hover:border-border"}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );

  const HardBlockBanner = ({
    block,
    onClearField,
  }: {
    block: NonNullable<typeof hardBlock>;
    onClearField: () => void;
  }) => (
    <div className="text-xs space-y-1.5">
      <p className="text-destructive flex items-start gap-1">
        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
        Ya existe un contacto con ese {block.reason === "email" ? "email" : "LinkedIn"}:{" "}
        <span className="font-medium">{block.contact.name}</span>
        {" "}en {block.company.company_name}.
      </p>
      <div className="flex gap-2">
        {onOpenExisting && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            onClick={() => {
              onOpenExisting(block.company);
              reset();
            }}
          >
            Abrir empresa
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onClearField}>
          Cancelar
        </Button>
      </div>
    </div>
  );

  const scan = async () => {
    if (!linkedinUrl.trim()) {
      toast.error("Pega la URL de LinkedIn primero");
      return;
    }
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-linkedin-contact", {
        body: { linkedin_url: linkedinUrl.trim() },
      });
      if (error) throw error;
      if (data?.name) setName(data.name);
      if (data?.role) setRole(data.role);
      toast.success("Perfil escaneado");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error escaneando perfil";
      toast.error(msg + ". Puedes completar los datos manualmente.");
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    if (!linkedinUrl.trim() || !name.trim()) {
      toast.error("Nombre y URL de LinkedIn son requeridos");
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/\S+@\S+\.\S+/.test(trimmedEmail)) {
      toast.error("Email inválido");
      return;
    }
    const hard = runGate({ email: trimmedEmail, linkedin: linkedinUrl });
    if (hard) return;
    await onAdd(companyId, {
      name: name.trim(),
      role: role.trim(),
      email: trimmedEmail || undefined,
      phone: phone.trim() || undefined,
      linkedin: linkedinUrl.trim(),
      contacted_from: contactedFrom,
    });
    toast.success("Contacto agregado");
    reset();
  };

  return (
    <div className={`space-y-3 ${compact ? "" : ""}`}>
      {contacts.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sin contactos. Añade uno con su URL de LinkedIn.</p>
      )}
      <div className="space-y-2">
        {contacts.map((c) => {
          const isEditing = editingKey === c.linkedin && editDraft;
          if (isEditing && editDraft) {
            return (
              <div key={c.linkedin} className="bg-muted/50 rounded-lg p-3 space-y-2 border border-primary/40">
                <Input placeholder="Nombre" value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} className="text-sm h-8" />
                <Input placeholder="Cargo" value={editDraft.role} onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value })} className="text-sm h-8" />
                <Input placeholder="https://linkedin.com/in/..." value={editDraft.linkedin} onChange={(e) => setEditDraft({ ...editDraft, linkedin: e.target.value })} className="text-sm h-8" />
                <Input type="email" placeholder="Email" value={editDraft.email ?? ""} onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })} className="text-sm h-8" />
                <Input type="tel" placeholder="Teléfono" value={editDraft.phone ?? ""} onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })} className="text-sm h-8" />
                <ContactedFromChips
                  value={editDraft.contacted_from ?? []}
                  onChange={(v) => setEditDraft({ ...editDraft, contacted_from: v })}
                />
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setEditingKey(null); setEditDraft(null); }}>
                    <X className="h-3.5 w-3.5 mr-1" />Cancelar
                  </Button>
                  <Button size="sm" onClick={() => {
                    if (!editDraft.name.trim() || !editDraft.linkedin.trim()) {
                      toast.error("Nombre y LinkedIn son requeridos");
                      return;
                    }
                    const trimmedEmail = (editDraft.email ?? "").trim();
                    if (trimmedEmail && !/\S+@\S+\.\S+/.test(trimmedEmail)) {
                      toast.error("Email inválido");
                      return;
                    }
                    const hard = runGate({
                      email: trimmedEmail,
                      linkedin: editDraft.linkedin,
                      ignoreLinkedin: c.linkedin,
                      ignoreEmail: c.email,
                    });
                    if (hard) {
                      toast.error(
                        `Ya existe un contacto con ese ${hard.reason === "email" ? "email" : "LinkedIn"}: ${hard.contact.name} en ${hard.company.company_name}.`,
                      );
                      return;
                    }
                    onUpdate?.(companyId, c.linkedin, {
                      name: editDraft.name.trim(),
                      role: editDraft.role.trim(),
                      email: trimmedEmail || undefined,
                      phone: (editDraft.phone ?? "").trim() || undefined,
                      linkedin: editDraft.linkedin.trim(),
                      contacted_from: editDraft.contacted_from ?? [],
                    });
                    toast.success("Contacto actualizado");
                    setEditingKey(null); setEditDraft(null);
                    setHardBlock(null);
                  }}>
                    <Check className="h-3.5 w-3.5 mr-1" />Guardar
                  </Button>
                </div>
              </div>
            );
          }
          return (
          <div key={c.id ?? c.linkedin} className={cn(
            "bg-muted/50 rounded-lg p-3 space-y-2",
            focusContactId && c.id === focusContactId && "ring-2 ring-primary/50 border border-primary/40",
          )}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{c.name || "(sin nombre)"}</p>
                {c.role && <p className="text-xs text-muted-foreground truncate">{c.role}</p>}
                {c.status && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Etapa: {TOUCH_STAGE_LABELS[c.status] ?? c.status}
                  </p>
                )}
                {c.contacted_from && c.contacted_from.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.contacted_from.map((cf) => (
                      <span key={cf} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/30">
                        desde {cf}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <Linkedin className="h-3 w-3" />LinkedIn
                  </a>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline break-all">
                      <Mail className="h-3 w-3" />{c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Phone className="h-3 w-3" />{c.phone}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {onApplyTouch && (
                  <button
                    onClick={() => setTouchFor(c)}
                    className="p-1 rounded hover:bg-background/60 text-muted-foreground hover:text-primary transition-colors"
                    aria-label="Registrar touch"
                    title="Registrar touch"
                    disabled={!c.id}
                  >
                    <Hand className="h-3.5 w-3.5" />
                  </button>
                )}
                {onUpdate && (
                  <button
                    onClick={() => { setEditingKey(c.linkedin); setEditDraft({ ...c }); }}
                    className="p-1 rounded hover:bg-background/60 text-muted-foreground hover:text-primary transition-colors"
                    aria-label="Editar contacto"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onRemove(companyId, c.linkedin)}
                  className="p-1 rounded hover:bg-background/60 text-muted-foreground hover:text-score-low transition-colors"
                  aria-label="Eliminar contacto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {c.id && (() => {
              const history = touchesByContact.get(c.id) ?? [];
              const showAll = expandedTouchIds.has(c.id);
              const visible = showAll || history.length <= 3 ? history : history.slice(0, 3);
              if (history.length === 0 && !touchesLoading) {
                return (
                  <p className="text-[11px] text-muted-foreground/80 italic pl-0.5">Sin touches registrados</p>
                );
              }
              if (history.length === 0) return null;
              return (
                <div className="border-t border-border/60 pt-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Touches ({history.length})
                    </p>
                    {history.length > 3 && (
                      <button
                        type="button"
                        onClick={() => toggleTouchHistory(c.id!)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {showAll ? "Ver menos" : "Ver todos"}
                      </button>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {visible.map((t) => {
                      const channel = catalogLabel(channelOptions, t.channel);
                      const seat = catalogLabel(seatOptions, t.account_used);
                      const when = (() => {
                        try {
                          return format(new Date(t.touched_at), "d MMM yyyy · HH:mm", { locale: es });
                        } catch {
                          return t.touched_at;
                        }
                      })();
                      const meta = [channel, seat, t.sdr].filter(Boolean).join(" · ");
                      return (
                        <li key={t.id} className="text-[11px] text-muted-foreground leading-snug">
                          <span className="text-foreground/80 font-medium">{when}</span>
                          {meta ? <span> · {meta}</span> : null}
                          {t.note ? <span className="block text-foreground/70 mt-0.5">{t.note}</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()}
          </div>
          );
        })}
      </div>

      {onApplyTouch && (
        <LogTouchDialog
          open={!!touchFor}
          contact={touchFor}
          defaultSdr={defaultSdr}
          onOpenChange={(o) => { if (!o) setTouchFor(null); }}
          onSubmit={async (payload) => {
            if (!touchFor?.id) return null;
            const result = await onApplyTouch(touchFor.id, payload);
            if (result?.touch_id) {
              const row: ContactTouch = {
                id: result.touch_id,
                contact_id: touchFor.id,
                company_id: companyId,
                touched_at: new Date().toISOString(),
                channel: payload.channel ?? null,
                account_used: payload.account_used ?? null,
                sdr: payload.sdr ?? null,
                note: payload.note ?? null,
              };
              setTouches((prev) => [row, ...prev.filter((t) => t.id !== row.id)]);
              setExpandedTouchIds((prev) => new Set(prev).add(touchFor.id!));
            } else {
              await loadTouches();
            }
            return result;
          }}
        />
      )}

      {!showForm ? (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="w-full">
          <Plus className="h-3.5 w-3.5 mr-1" /> Añadir contacto
        </Button>
      ) : (
        <div className="border border-border rounded-lg p-3 space-y-2 bg-background">
          <div className="flex gap-2">
            <Input
              placeholder="https://linkedin.com/in/..."
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              onBlur={() => runGate({ email, linkedin: linkedinUrl })}
              className={cn("text-sm", hardBlock?.reason === "linkedin" && "border-destructive ring-1 ring-destructive/30")}
            />
            <Button size="sm" onClick={scan} disabled={scanning || !linkedinUrl.trim()} variant="secondary">
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span className="ml-1">Escanear</span>
            </Button>
          </div>
          {hardBlock?.reason === "linkedin" && (
            <HardBlockBanner
              block={hardBlock}
              onClearField={() => {
                setLinkedinUrl("");
                setHardBlock(null);
              }}
            />
          )}
          <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
          <Input placeholder="Cargo" value={role} onChange={(e) => setRole(e.target.value)} className="text-sm" />
          <Input
            type="email"
            placeholder="Email (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => runGate({ email, linkedin: linkedinUrl })}
            className={cn("text-sm", hardBlock?.reason === "email" && "border-destructive ring-1 ring-destructive/30")}
          />
          {hardBlock?.reason === "email" && (
            <HardBlockBanner
              block={hardBlock}
              onClearField={() => {
                setEmail("");
                setHardBlock(null);
              }}
            />
          )}
          <Input type="tel" placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="text-sm" />
          <ContactedFromChips value={contactedFrom} onChange={setContactedFrom} />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={reset}>Cancelar</Button>
            <Button size="sm" onClick={save} disabled={!!hardBlock}>Guardar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
