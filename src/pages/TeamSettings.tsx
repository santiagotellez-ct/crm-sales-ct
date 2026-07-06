import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Users, Target, UserCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useTeamMembers,
  useAddTeamMember,
  useDeleteTeamMember,
  useToggleTeamMember,
  useUpdateTeamMemberGoal,
  useAeTargets,
  useSetAeTarget,
  TeamMemberRole,
  TeamMember,
} from "@/hooks/useTeamMembers";
import { QUARTERS } from "@/lib/quarters";

// ─── Member management ───────────────────────────────────────────────────────

const SECTIONS: { role: TeamMemberRole; label: string; icon: React.ReactNode; description: string }[] = [
  {
    role: "sdr",
    label: "SDRs",
    icon: <Users className="h-4 w-4" />,
    description: "Responsables de prospección y contacto inicial",
  },
  {
    role: "ae",
    label: "Account Executives",
    icon: <Target className="h-4 w-4" />,
    description: "Cierran deals y manejan el pipeline",
  },
  {
    role: "secondary_ae",
    label: "Sub-AEs (Otro AE)",
    icon: <UserCheck className="h-4 w-4" />,
    description: "AEs agrupados bajo la categoría \"Otro AE\"",
  },
];

function AddMemberForm({ role, onAdd }: { role: TeamMemberRole; onAdd: (name: string, email?: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onAdd(name.trim(), email.trim() || undefined);
      setName("");
      setEmail("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
      <Input
        placeholder="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 text-sm w-36"
        disabled={loading}
      />
      {role === "ae" && (
        <Input
          placeholder="Email (opcional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 text-sm flex-1"
          disabled={loading}
        />
      )}
      <Button type="submit" size="sm" className="h-8 gap-1.5" disabled={loading || !name.trim()}>
        <Plus className="h-3.5 w-3.5" />
        Agregar
      </Button>
    </form>
  );
}

// ─── Inline goal cell ────────────────────────────────────────────────────────

function GoalCell({
  value,
  onSave,
  prefix = "",
  placeholder = "0",
}: {
  value: number;
  onSave: (v: number) => Promise<void>;
  prefix?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    const n = Number(draft.replace(/[^0-9]/g, ""));
    if (!isNaN(n) && n !== value) {
      setSaving(true);
      try { await onSave(n); } finally { setSaving(false); }
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        className="w-24 h-7 text-sm text-right bg-background border border-primary rounded px-2 tabular-nums"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        disabled={saving}
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="w-24 h-7 text-sm text-right tabular-nums text-foreground hover:text-primary hover:underline transition-colors"
      title="Click para editar"
    >
      {value === 0 ? <span className="text-muted-foreground/50">{placeholder}</span> : `${prefix}${value.toLocaleString()}`}
    </button>
  );
}

// ─── SDR Goals table ─────────────────────────────────────────────────────────

function SdrGoalsTable({ members, onUpdate }: {
  members: TeamMember[];
  onUpdate: (id: string, field: "pipe_goal" | "meeting_goal", value: number) => Promise<void>;
}) {
  const sdrs = members.filter((m) => m.role === "sdr" && m.is_active);
  if (sdrs.length === 0) return <p className="text-xs text-muted-foreground italic">Sin SDRs activos</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-semibold text-muted-foreground py-2 pr-4">SDR</th>
            <th className="text-right text-xs font-semibold text-muted-foreground py-2 px-3">Reuniones / sem</th>
            <th className="text-right text-xs font-semibold text-muted-foreground py-2 pl-3">Pipeline / sem (USD)</th>
          </tr>
        </thead>
        <tbody>
          {sdrs.map((m) => (
            <tr key={m.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
              <td className="py-2 pr-4 font-medium text-foreground">{m.name}</td>
              <td className="py-2 px-3">
                <div className="flex justify-end">
                  <GoalCell
                    value={m.meeting_goal}
                    onSave={(v) => onUpdate(m.id, "meeting_goal", v)}
                    placeholder="sin meta"
                  />
                </div>
              </td>
              <td className="py-2 pl-3">
                <div className="flex justify-end">
                  <GoalCell
                    value={m.pipe_goal}
                    onSave={(v) => onUpdate(m.id, "pipe_goal", v)}
                    prefix="$"
                    placeholder="sin meta"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── AE Goals table ──────────────────────────────────────────────────────────

function AeGoalsTable({ members, aeTargets, onUpdatePipe, onUpdateTarget }: {
  members: TeamMember[];
  aeTargets: { ae_name: string; quarter_key: string; target: number }[];
  onUpdatePipe: (id: string, value: number) => Promise<void>;
  onUpdateTarget: (ae_name: string, quarter_key: string, target: number) => Promise<void>;
}) {
  const aes = members.filter((m) => m.role === "ae" && m.is_active && m.name !== "Otro AE");

  const targetFor = (ae: string, q: string) =>
    aeTargets.find((t) => t.ae_name === ae && t.quarter_key === q)?.target ?? 0;

  if (aes.length === 0) return <p className="text-xs text-muted-foreground italic">Sin AEs activos</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-semibold text-muted-foreground py-2 pr-4 whitespace-nowrap">AE</th>
            <th className="text-right text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap">Pipeline / sem</th>
            {QUARTERS.map((q) => (
              <th key={q.key} className="text-right text-xs font-semibold text-muted-foreground py-2 px-2 whitespace-nowrap">
                {q.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {aes.map((m) => (
            <tr key={m.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
              <td className="py-2 pr-4 font-medium text-foreground whitespace-nowrap">{m.name}</td>
              <td className="py-2 px-3">
                <div className="flex justify-end">
                  <GoalCell
                    value={m.pipe_goal}
                    onSave={(v) => onUpdatePipe(m.id, v)}
                    prefix="$"
                    placeholder="sin meta"
                  />
                </div>
              </td>
              {QUARTERS.map((q) => (
                <td key={q.key} className="py-2 px-2">
                  <div className="flex justify-end">
                    <GoalCell
                      value={targetFor(m.name, q.key)}
                      onSave={(v) => onUpdateTarget(m.name, q.key, v)}
                      prefix="$"
                      placeholder="—"
                    />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TeamSettings() {
  const { data: members = [], isLoading } = useTeamMembers();
  const { data: aeTargets = [] } = useAeTargets();
  const addMember = useAddTeamMember();
  const deleteMember = useDeleteTeamMember();
  const toggleMember = useToggleTeamMember();
  const updateGoal = useUpdateTeamMemberGoal();
  const setAeTarget = useSetAeTarget();

  const handleAdd = async (role: TeamMemberRole, name: string, email?: string) => {
    try {
      await addMember.mutateAsync({ name, role, email });
      toast.success(`${name} agregado`);
    } catch {
      toast.error("Error al agregar miembro");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteMember.mutateAsync(id);
      toast.success(`${name} eliminado`);
    } catch {
      toast.error("Error al eliminar miembro");
    }
  };

  const handleToggle = async (id: string, name: string, current: boolean) => {
    try {
      await toggleMember.mutateAsync({ id, is_active: !current });
      toast.success(`${name} ${!current ? "activado" : "desactivado"}`);
    } catch {
      toast.error("Error al actualizar miembro");
    }
  };

  const handleUpdateGoal = async (id: string, field: "pipe_goal" | "meeting_goal", value: number) => {
    try {
      await updateGoal.mutateAsync({ id, [field]: value });
      toast.success("Meta actualizada");
    } catch {
      toast.error("Error al guardar meta");
    }
  };

  const handleSetAeTarget = async (ae_name: string, quarter_key: string, target: number) => {
    try {
      await setAeTarget.mutateAsync({ ae_name, quarter_key, target });
      toast.success("Meta de Q actualizada");
    } catch {
      toast.error("Error al guardar meta");
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Configuración del equipo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administra los miembros del equipo y sus metas.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando...</div>
      ) : (
        <>
          {/* ── Miembros ── */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Miembros
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SECTIONS.map(({ role, label, icon, description }) => {
                const sectionMembers = members.filter((m) => m.role === role);
                return (
                  <div key={role} className="bg-card border border-border rounded-lg p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-muted-foreground">{icon}</span>
                      <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">{description}</p>
                    <div className="flex-1 space-y-1.5">
                      {sectionMembers.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Sin miembros todavía</p>
                      )}
                      {sectionMembers.map((m) => (
                        <div
                          key={m.id}
                          className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-sm ${
                            m.is_active ? "bg-muted/50" : "bg-muted/20 opacity-50"
                          }`}
                        >
                          <button
                            className="flex-1 text-left font-medium text-foreground truncate"
                            title={m.is_active ? "Click para desactivar" : "Click para activar"}
                            onClick={() => handleToggle(m.id, m.name, m.is_active)}
                          >
                            {m.name}
                            {!m.is_active && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">(inactivo)</span>
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.name)}
                            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <AddMemberForm
                      role={role}
                      onAdd={(name, email) => handleAdd(role, name, email)}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Metas ── */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Metas
            </h2>

            {/* SDR goals */}
            <div className="bg-card border border-border rounded-lg p-5 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">SDRs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Meta semanal de reuniones agendadas y de pipeline generado. Click en un número para editar.
                </p>
              </div>
              <SdrGoalsTable
                members={members}
                onUpdate={handleUpdateGoal}
              />
            </div>

            {/* AE goals */}
            <div className="bg-card border border-border rounded-lg p-5 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Account Executives</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pipeline semanal por defecto y meta de revenue por quarter. Click en un número para editar.
                </p>
              </div>
              <AeGoalsTable
                members={members}
                aeTargets={aeTargets}
                onUpdatePipe={(id, v) => handleUpdateGoal(id, "pipe_goal", v)}
                onUpdateTarget={handleSetAeTarget}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
