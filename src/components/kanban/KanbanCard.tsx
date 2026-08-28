import { memo } from "react";
import { Company, FIT_LABELS, ContactedFrom, SOURCE_LABELS } from "@/types/company";
import { colorForSdr } from "@/lib/sdrColors";
import { RotateCw } from "lucide-react";

const FIT_COLOR: Record<string, string> = {
  ABM: "bg-score-high/20 text-score-high border-score-high/40",
  HIGH: "bg-primary/15 text-primary border-primary/30",
  MID: "bg-score-medium/15 text-score-medium border-score-medium/30",
  MAYBE: "bg-muted text-muted-foreground border-border",
};

const SOURCE_COLOR: Record<string, string> = {
  inbound: "bg-score-high/15 text-score-high border-score-high/30",
  outbound: "bg-primary/10 text-primary border-primary/30",
};

interface Props {
  company: Company;
  linkedinAccounts: ContactedFrom[];
  onClick: () => void;
  onReassign?: () => void;
  daysInStage?: number | null;
}

function Card({ company, linkedinAccounts, onClick, onReassign, daysInStage }: Props) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/company-id", company.id);
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      className="relative group bg-card border border-border rounded-md p-2 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-sm transition-all space-y-1.5"
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-xs font-semibold text-foreground line-clamp-2 flex-1">{company.company_name}</span>
        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${FIT_COLOR[company.icp_fit] ?? FIT_COLOR.MAYBE}`}>
          {FIT_LABELS[company.icp_fit]}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {company.sdr ? (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colorForSdr(company.sdr)}`}>
              {company.sdr}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">Sin SDR</span>
          )}
          {linkedinAccounts.map((a) => (
            <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/40 text-accent-foreground border border-border">
              in/{a}
            </span>
          ))}
          {company.source && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${SOURCE_COLOR[company.source]}`}>
              {SOURCE_LABELS[company.source]}
            </span>
          )}
        </div>
        {onReassign && (
          <button
            onClick={(e) => { e.stopPropagation(); onReassign(); }}
            className="opacity-0 group-hover:opacity-100 text-[10px] font-medium text-primary inline-flex items-center gap-0.5 hover:underline"
            title="Reasignar prospección"
          >
            <RotateCw className="h-3 w-3" /> Reasignar
          </button>
        )}
      </div>
      {daysInStage !== null && daysInStage !== undefined && (
        <span
          className="absolute bottom-1 right-2 text-[10px] text-muted-foreground"
          title="Días en este estado"
        >
          {daysInStage}d
        </span>
      )}
    </div>
  );
}

export const KanbanCard = memo(Card);