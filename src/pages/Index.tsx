import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Company } from "@/types/company";
import { useCompanyData } from "@/hooks/useCompanyData";
import { DetailPanel } from "@/components/DetailPanel";
import { AddCompanyDialog } from "@/components/AddCompanyDialog";
import { ScheduleMeetingDialog } from "@/components/ScheduleMeetingDialog";
import { Button } from "@/components/ui/button";
import { Plus, Copy } from "lucide-react";
import { toast } from "sonner";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export default function Index() {
  const {
    allCompanies,
    updateCompany,
    setStatus,
    setFit,
    addContact,
    removeContact,
    addCompanies,
    scheduleMeeting,
    duplicateClusters,
    deleteCompanies,
  } = useCompanyData();

  const navigate = useNavigate();


  const [detailCompany, setDetailCompany] = useState<Company | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<Company | null>(null);

  const currentDetail = detailCompany
    ? allCompanies.find((c) => c.id === detailCompany.id) ?? null
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-[49px] z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Colombia Tech Week CRM</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {allCompanies.length} empresas
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/duplicates")}
              className="gap-1.5 h-8"
              title="Revisar empresas duplicadas"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicados{duplicateClusters.length > 0 ? ` (${duplicateClusters.length})` : ""}
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Añadir empresas
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-5 space-y-4 pb-24">
        <KanbanBoard companies={allCompanies} onOpenDetail={setDetailCompany} />
      </main>

      {currentDetail && (
        <>
          <div className="fixed inset-0 bg-foreground/20 z-40" onClick={() => setDetailCompany(null)} />
          <DetailPanel
            company={currentDetail}
            onClose={() => setDetailCompany(null)}
            onUpdateNotes={(id, notes) => updateCompany(id, { notes })}
            onStatusChange={setStatus}
            onFitChange={setFit}
            onAddContact={addContact}
            onRemoveContact={removeContact}
            onDelete={() => {
              if (currentDetail) {
                deleteCompanies([currentDetail.id]);
                setDetailCompany(null);
              }
            }}
          />

        </>
      )}

      <AddCompanyDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addCompanies} existingCompanies={allCompanies} />

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
    </div>
  );
}
