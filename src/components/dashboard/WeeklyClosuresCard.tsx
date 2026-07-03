import { useMemo } from "react";
import { startOfWeek, endOfWeek } from "date-fns";
import { useDealsData } from "@/hooks/useDealsData";
import type { Deal } from "@/types/deal";
import { AE_OPTIONS } from "@/types/meeting";
import { isoWeekStart } from "@/lib/week";
import { WEEKLY_TEAM_TARGET } from "@/lib/quarters";

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

interface WeeklyClosuresCardProps {
  year?: number;
  week?: number;
}

export function WeeklyClosuresCard({ year, week }: WeeklyClosuresCardProps = {}) {
  const { deals } = useDealsData();

  const data = useMemo(() => {
    const ref = year && week ? isoWeekStart(year, week) : new Date();
    const s = startOfWeek(ref, { weekStartsOn: 1 });
    const e = endOfWeek(ref, { weekStartsOn: 1 });
    const inWeek = (d: Deal) => {
      if (!d.won_at) return false;
      const t = new Date(d.won_at).getTime();
      return t >= s.getTime() && t <= e.getTime();
    };
    const perAe = AE_OPTIONS.map((ae) => {
      const closed = deals
        .filter((d) => d.account_executive === ae && inWeek(d))
        .sort((a, b) => b.value - a.value);
      return {
        ae,
        value: closed.reduce((a, d) => a + d.value, 0),
        count: closed.length,
        deals: closed,
      };
    });
    const total = perAe.reduce((a, x) => a + x.value, 0);
    const totalCount = perAe.reduce((a, x) => a + x.count, 0);
    return { perAe, total, totalCount };
  }, [deals, stages, year, week]);

  return (
    <div className="bg-card border-2 border-score-high/40 rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Cierres · semana {week ?? ""}</h2>
          <p className="text-xs text-muted-foreground">Deals que entraron a Won/Commit durante esta semana</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums text-score-high">{money(data.total)}</div>
          <div className="text-xs text-muted-foreground">
            de {money(WEEKLY_TEAM_TARGET)} · {data.totalCount} deal(s)
          </div>
        </div>
      </div>
      <div className="mb-3">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-score-high"
            style={{ width: `${Math.min(100, Math.round((data.total / WEEKLY_TEAM_TARGET) * 100))}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
          <span>Meta semanal</span>
          <span>
            {Math.min(100, Math.round((data.total / WEEKLY_TEAM_TARGET) * 100))}% · faltan{" "}
            {money(Math.max(0, WEEKLY_TEAM_TARGET - data.total))}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {data.perAe.map((a) => (
          <div key={a.ae} className="bg-background border border-border rounded p-3 flex flex-col">
            <div className="text-xs text-muted-foreground">{a.ae}</div>
            <div className="text-lg font-bold tabular-nums text-foreground">{money(a.value)}</div>
            <div className="text-[11px] text-muted-foreground mb-1">{a.count} deal(s)</div>
            {a.deals.length > 0 && (
              <div className="pt-1 border-t border-border/60 text-[11px] text-muted-foreground space-y-0.5 max-h-32 overflow-auto">
                {a.deals.map((d) => (
                  <div key={d.id} className="flex justify-between gap-2" title={d.name || undefined}>
                    <span className="truncate">{d.company_name}</span>
                    <span className="tabular-nums font-medium text-foreground">{money(d.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}