import { useDraggable } from "@dnd-kit/core";
import { Deal } from "@/types/deal";
import { Calendar, CheckSquare, AlertTriangle, User } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Props {
  deal: Deal;
  onClick: () => void;
  requireTask?: boolean;
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function DealCard({ deal, onClick, requireTask = true }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  const openTasks = deal.tasks.filter((t) => !t.completed);
  const nextTask = openTasks.sort((a, b) => a.due_at - b.due_at)[0];
  const hasTask = !!nextTask;
  const daysInStage = Math.max(0, Math.floor((Date.now() - deal.stage_entered_at) / 86400000));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
      className={`bg-card border border-border rounded-md p-3 cursor-grab active:cursor-grabbing hover:border-foreground hover:shadow-sm transition-all text-sm ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <div className="font-display font-bold text-foreground truncate uppercase text-[0.95rem] tracking-tight">{deal.name || deal.company_name}</div>
      {deal.name && deal.name !== deal.company_name && (
        <div className="text-xs text-muted-foreground truncate">{deal.company_name}</div>
      )}
      <div className="text-lg font-display font-extrabold text-foreground mt-1">{money(deal.value)}</div>

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-foreground text-background">
          <User className="h-3 w-3" />
          {deal.account_executive}
        </span>
        {deal.sdr && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium">{deal.sdr}</span>
        )}
        {deal.event && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-brand-pink text-foreground font-medium">{deal.event}</span>
        )}
      </div>

      {deal.expected_close_date && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <Calendar className="h-3 w-3" />
          Cierre {format(parseISO(deal.expected_close_date), "dd MMM")}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
        <span>Creado {format(new Date(deal.created_at), "dd MMM yyyy")}</span>
        <span title="Días en este stage">{daysInStage}d en stage</span>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
        {hasTask ? (
          <div className="flex items-center gap-1 text-xs text-foreground truncate">
            <CheckSquare className="h-3 w-3 text-score-high flex-shrink-0" />
            <span className="truncate">{nextTask.title}</span>
          </div>
        ) : requireTask ? (
          <div className="flex items-center gap-1 text-xs text-destructive font-medium">
            <AlertTriangle className="h-3 w-3" /> Falta tarea
          </div>
        ) : (
          <span />
        )}
        {deal.contact_ids.length > 0 && (
          <span className="text-xs text-muted-foreground">{deal.contact_ids.length} contacto(s)</span>
        )}
      </div>
    </div>
  );
}