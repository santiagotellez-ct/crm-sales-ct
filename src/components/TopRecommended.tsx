import { Company, FIT_LABELS, FIT_RANK } from "@/types/company";

interface TopRecommendedProps {
  companies: Company[];
  onSelect: (company: Company) => void;
}

export function TopRecommended({ companies, onSelect }: TopRecommendedProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">🏆 Top 20 Recommended</h3>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {companies.slice(0, 20).map((c) => {
          const fitColor =
            FIT_RANK[c.icp_fit] >= FIT_RANK.ABM
              ? "border-primary bg-primary/10"
              : FIT_RANK[c.icp_fit] >= FIT_RANK.HIGH
              ? "border-score-high bg-score-high/5"
              : "border-score-medium bg-score-medium/5";
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className={`flex-shrink-0 border rounded-lg px-3 py-2 text-left hover:shadow-md transition-all ${fitColor}`}
            >
              <p className="text-xs font-semibold text-foreground whitespace-nowrap">{c.company_name}</p>
              <p className="text-xs text-muted-foreground">{FIT_LABELS[c.icp_fit]} · {c.angle}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
