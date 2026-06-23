import { useState } from "react";
import { Contact, ContactedFrom, CONTACTED_FROM_OPTIONS } from "@/types/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Linkedin, Loader2, Sparkles, Trash2, Plus, Mail, Phone, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  companyId: string;
  contacts: Contact[];
  onAdd: (companyId: string, contact: Contact) => void | Promise<void>;
  onRemove: (companyId: string, linkedin: string) => void;
  onUpdate?: (companyId: string, oldLinkedin: string, updates: Partial<Contact>) => void;
  compact?: boolean;
}

export function ContactsPanel({ companyId, contacts, onAdd, onRemove, onUpdate, compact = false }: Props) {
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

  const reset = () => {
    setLinkedinUrl(""); setName(""); setRole(""); setEmail(""); setPhone(""); setContactedFrom([]); setShowForm(false);
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
                  }}>
                    <Check className="h-3.5 w-3.5 mr-1" />Guardar
                  </Button>
                </div>
              </div>
            );
          }
          return (
          <div key={c.linkedin} className="bg-muted/50 rounded-lg p-3 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{c.name || "(sin nombre)"}</p>
              {c.role && <p className="text-xs text-muted-foreground truncate">{c.role}</p>}
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
          );
        })}
      </div>

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
              className="text-sm"
            />
            <Button size="sm" onClick={scan} disabled={scanning || !linkedinUrl.trim()} variant="secondary">
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span className="ml-1">Escanear</span>
            </Button>
          </div>
          <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
          <Input placeholder="Cargo" value={role} onChange={(e) => setRole(e.target.value)} className="text-sm" />
          <Input type="email" placeholder="Email (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} className="text-sm" />
          <Input type="tel" placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="text-sm" />
          <ContactedFromChips value={contactedFrom} onChange={setContactedFrom} />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={reset}>Cancelar</Button>
            <Button size="sm" onClick={save}>Guardar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
