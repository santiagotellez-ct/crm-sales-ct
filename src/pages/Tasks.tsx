import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { useCompanyData } from "@/hooks/useCompanyData";
import { Sdr, SDR_OPTIONS } from "@/types/company";
import { useTeamMemberNames } from "@/hooks/useTeamMembers";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export default function Tasks() {
  const { tasks, toggleTask } = useCompanyData();
  const { sdrNames, isLoading: sdrLoading } = useTeamMemberNames();
  const sdrOptions = sdrLoading || sdrNames.length === 0 ? SDR_OPTIONS : sdrNames;

  const pending = tasks.filter((t) => !t.completed).sort((a, b) => a.due_at - b.due_at);

  const groups: { sdr: Sdr | "Sin asignar"; items: typeof pending }[] = [
    ...sdrOptions.map((sdr) => ({
      sdr: sdr as Sdr | "Sin asignar",
      items: pending.filter((t) => t.sdr === sdr),
    })),
    { sdr: "Sin asignar" as const, items: pending.filter((t) => !t.sdr) },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-[49px] z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Pipeline
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Tareas pendientes</h1>
              <p className="text-sm text-muted-foreground">
                {pending.length} por completar — orden cronológico
              </p>
            </div>
          </div>
          
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-5 space-y-6 pb-12">
        {groups.map(({ sdr, items }) => (
          <section key={sdr} className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{sdr}</h2>
              <span className="text-xs text-muted-foreground">{items.length} tareas</span>
            </div>
            {items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Sin tareas pendientes
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((t) => {
                  const due = new Date(t.due_at);
                  const overdue = isPast(due) && !isToday(due);
                  const today = isToday(due);
                  return (
                    <li key={t.id} className="px-4 py-3 flex items-start gap-3 hover:bg-accent/30 transition-colors">
                      <Checkbox
                        checked={t.completed}
                        onCheckedChange={() => toggleTask(t.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{t.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.company_name}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "text-xs font-medium tabular-nums whitespace-nowrap",
                          overdue ? "text-destructive" : today ? "text-score-medium" : "text-muted-foreground"
                        )}
                      >
                        {format(due, "dd MMM, HH:mm")}
                        {overdue && " · vencida"}
                        {today && " · hoy"}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}