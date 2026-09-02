import { useMemo } from "react";
import { Deal, DealStage } from "@/types/deal";
import { AE_OPTIONS } from "@/types/meeting";
import { useTeamMemberNames } from "@/hooks/useTeamMembers";

interface Props {
  deals: Deal[];
  stages: DealStage[];
}

interface AeStats {
  ae: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

function daysToClose(deal: Deal): number {
  if (!deal.won_at) return NaN;
  return (new Date(deal.won_at).getTime() - deal.created_at) / (1000 * 60 * 60 * 24);
}

export function AvgDaysToCloseCard({ deals, stages }: Props) {
  const { aeNames, isLoading: aeLoading } = useTeamMemberNames();
  const aeOptions = aeLoading || aeNames.length === 0 ? AE_OPTIONS : [...aeNames, "Otro AE"];

  const stats = useMemo<AeStats[]>(() => {
    const stageMap = new Map(stages.map((s) => [s.id, s]));
    const isWon = (stageId: string) => {
      const s = stageMap.get(stageId);
      return !!s && (s.is_won || s.name === "Commited");
    };

    return aeOptions.map((ae) => {
      const wonDeals = deals.filter(
        (d) => d.account_executive === ae && isWon(d.stage_id) && d.won_at != null
      );
      const dayValues = wonDeals.map(daysToClose).filter((d) => !isNaN(d) && d >= 0);
      if (dayValues.length === 0) return { ae, avg: NaN, min: NaN, max: NaN, count: 0 };
      const avg = dayValues.reduce((a, b) => a + b, 0) / dayValues.length;
      return {
        ae,
        avg,
        min: Math.min(...dayValues),
        max: Math.max(...dayValues),
        count: dayValues.length,
      };
    });
  }, [deals, stages, aeOptions]);

  const maxAvg = Math.max(...stats.filter((s) => !isNaN(s.avg)).map((s) => s.avg), 1);

  const fmt = (n: number) => (isNaN(n) ? "—" : `${Math.round(n)}d`);

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Días promedio en cerrar un deal</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Desde que entra al pipeline hasta Won / Commit · todos los deals históricos
        </p>
      </div>

      <div className="space-y-3">
        {stats.map((s) => (
          <div key={s.ae} className="flex items-center gap-3">
            {/* AE name */}
            <div className="w-16 shrink-0 text-sm font-medium text-foreground truncate">{s.ae}</div>

            {/* Bar + number */}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                {!isNaN(s.avg) && (
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.round((s.avg / maxAvg) * 100)}%` }}
                  />
                )}
              </div>
              <span className="w-8 text-right text-sm font-bold tabular-nums text-foreground">
                {fmt(s.avg)}
              </span>
            </div>

            {/* Range + count */}
            <div className="shrink-0 text-[11px] text-muted-foreground tabular-nums w-32 text-right">
              {s.count > 0 ? (
                <>
                  <span className="text-score-high">{fmt(s.min)}</span>
                  <span className="mx-1">–</span>
                  <span className="text-destructive">{fmt(s.max)}</span>
                  <span className="ml-1.5 text-muted-foreground">({s.count})</span>
                </>
              ) : (
                <span className="text-muted-foreground/50">sin datos</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Rango: mín <span className="text-score-high font-medium">verde</span> · máx{" "}
        <span className="text-destructive font-medium">rojo</span> · (n) = deals considerados
      </p>
    </div>
  );
}
