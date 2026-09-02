import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Pencil, Check } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { useDealsData } from "@/hooks/useDealsData";
import { AE_OPTIONS } from "@/types/meeting";
import { useTeamMemberNames } from "@/hooks/useTeamMembers";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NextTaskDialog } from "@/components/deals/NextTaskDialog";
import { Deal } from "@/types/deal";
import { toast } from "sonner";

export default function AeTasks() {
  const { deals, stages, toggleDealTask, addDealTask, updateDealTask } = useDealsData();
  const { aeNames, isLoading: aeLoading } = useTeamMemberNames();
  const aeOptions = aeLoading || aeNames.length === 0 ? AE_OPTIONS : [...aeNames, "Otro AE"];
  const [pendingNext, setPendingNext] = useState<{ deal: Deal; completedTitle: string } | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");

  const handleToggle = async (taskId: string, completed: boolean, deal: Deal, title: string) => {
    await toggleDealTask(taskId, completed);
    if (!completed) return;
    const stillOpen = deal.tasks.some((x) => x.id !== taskId && !x.completed);
    const stage = stages.find((s) => s.id === deal.stage_id);
    if (stillOpen || stage?.is_won || stage?.is_lost) return;
    setPendingNext({ deal, completedTitle: title });
  };

  const items = deals.flatMap((d) =>
    d.tasks
      .filter((t) => !t.completed)
      .map((t) => ({ ...t, deal: d }))
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-[49px] z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/deals" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Deals
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Tareas de AE</h1>
              <p className="text-sm text-muted-foreground">{items.length} pendientes</p>
            </div>
          </div>
          
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-5 space-y-6 pb-12">
        {aeOptions.map((ae) => {
          const list = items
            .filter((t) => (t.assignee ?? t.deal.account_executive) === ae)
            .sort((a, b) => a.due_at - b.due_at);
          return (
            <section key={ae} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{ae}</h2>
                <span className="text-xs text-muted-foreground">{list.length} tareas</span>
              </div>
              {list.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Sin pendientes
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {list.map((t) => {
                    const due = new Date(t.due_at);
                    const overdue = isPast(due) && !isToday(due);
                    const isEditing = editingTaskId === t.id;
                    return (
                      <li key={t.id} className="px-4 py-3 flex items-start gap-3 hover:bg-accent/30">
                        <Checkbox checked={t.completed} onCheckedChange={(v) => handleToggle(t.id, !!v, t.deal, t.title)} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5">
                              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-7 text-sm" />
                              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-7 text-sm w-40" />
                            </div>
                          ) : (
                            <>
                              <div className="text-sm font-medium">{t.title}</div>
                              <div className="text-xs text-muted-foreground">{t.deal.company_name}</div>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <button
                              onClick={async () => {
                                const patch: { title?: string; due_at?: number } = {};
                                if (editTitle.trim() && editTitle.trim() !== t.title) patch.title = editTitle.trim();
                                if (editDate) {
                                  const ts = new Date(`${editDate}T09:00`).getTime();
                                  if (ts !== t.due_at) patch.due_at = ts;
                                }
                                if (Object.keys(patch).length) await updateDealTask(t.id, patch);
                                setEditingTaskId(null);
                              }}
                              className="text-muted-foreground hover:text-foreground p-1"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingTaskId(t.id);
                                setEditTitle(t.title);
                                setEditDate(format(new Date(t.due_at), "yyyy-MM-dd"));
                              }}
                              className="text-muted-foreground hover:text-foreground p-1"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <div className={cn("text-xs font-medium tabular-nums", overdue ? "text-destructive" : isToday(due) ? "text-score-medium" : "text-muted-foreground")}>
                            {format(due, "dd MMM")}
                            {overdue && " · vencida"}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </main>

      <NextTaskDialog
        open={!!pendingNext}
        reason={`Completaste "${pendingNext?.completedTitle}" en ${pendingNext?.deal.company_name}. Define la siguiente acción.`}
        onOpenChange={(o) => { if (!o) setPendingNext(null); }}
        onConfirm={async (title, dueAt) => {
          if (!pendingNext) return;
          await addDealTask(pendingNext.deal.id, title, dueAt, pendingNext.deal.account_executive);
          toast.success("Siguiente tarea creada");
          setPendingNext(null);
        }}
      />
    </div>
  );
}