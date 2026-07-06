import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Users, Target, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useTeamMembers,
  useAddTeamMember,
  useDeleteTeamMember,
  useToggleTeamMember,
  TeamMemberRole,
} from "@/hooks/useTeamMembers";

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

export default function TeamSettings() {
  const { data: members = [], isLoading } = useTeamMembers();
  const addMember = useAddTeamMember();
  const deleteMember = useDeleteTeamMember();
  const toggleMember = useToggleTeamMember();

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

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Configuración del equipo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administra los SDRs y AEs que aparecen en los selectores y dashboards.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando equipo...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SECTIONS.map(({ role, label, icon, description }) => {
            const sectionMembers = members.filter((m) => m.role === role);
            return (
              <div key={role} className="bg-card border border-border rounded-lg p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-muted-foreground">{icon}</span>
                  <h2 className="text-sm font-semibold text-foreground">{label}</h2>
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
      )}
    </div>
  );
}
