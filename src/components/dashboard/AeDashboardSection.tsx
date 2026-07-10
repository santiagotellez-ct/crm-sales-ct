import { useMemo, useState } from "react";
import { isPast } from "date-fns";
import { useDealsData } from "@/hooks/useDealsData";
import { useEventsData } from "@/hooks/useEventsData";
import { AE_OPTIONS, SECONDARY_AE_OPTIONS, SecondaryAe } from "@/types/meeting";
import { useTeamMemberNames } from "@/hooks/useTeamMembers";
import { AvgDaysToCloseCard } from "./AvgDaysToCloseCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  QUARTERS, QuarterKey, getCurrentQuarter, getQuarter,
  weeksRemainingInQuarter, dealInQuarter,
} from "@/lib/quarters";
import { useAeTargets } from "@/hooks/useTeamMembers";

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function AeDashboardSection() {
  const { deals, stages } = useDealsData();
  const { events } = useEventsData();
  const { aeNames, secondaryAeNames, isLoading: teamLoading } = useTeamMemberNames();
  const { data: aeTargetsData = [] } = useAeTargets();
  const aeList = teamLoading || aeNames.length === 0 ? AE_OPTIONS : aeNames;
  const secondaryAeList = teamLoading || secondaryAeNames.length === 0 ? SECONDARY_AE_OPTIONS : secondaryAeNames;
  const [qFilter, setQFilter] = useState<QuarterKey>(getCurrentQuarter().key);
  const [subAeFilter, setSubAeFilter] = useState<SecondaryAe | "ALL">("ALL");
  const [eventFilter, setEventFilter] = useState<string[]>(["ALL"]);
  const [eventFilterOpen, setEventFilterOpen] = useState(false);
  const quarter = useMemo(() => getQuarter(qFilter), [qFilter]);
  const weeksLeft = useMemo(() => weeksRemainingInQuarter(quarter), [quarter]);
  const currentQuarterKey = getCurrentQuarter().key;
  const isCurrentQuarter = qFilter === currentQuarterKey;

  const perAe = useMemo(() => {
    const stageMap = new Map(stages.map((s) => [s.id, s]));
    const isClosedWon = (stageId: string) => {
      const s = stageMap.get(stageId);
      if (!s) return false;
      return s.is_won || s.name === "Commited";
    };
    return aeList.map((ae) => {
      let allAeDeals = deals.filter((d) => d.account_executive === ae);
      if (ae === "Otro AE" && subAeFilter !== "ALL") {
        allAeDeals = allAeDeals.filter((d) => d.secondary_ae === subAeFilter);
      }
      if (!eventFilter.includes("ALL")) {
        allAeDeals = allAeDeals.filter((d) => eventFilter.includes(d.event));
      }

      const aeDeals = allAeDeals.filter((d) => dealInQuarter(d, quarter));

      const open = aeDeals.filter((d) => {
        const s = stageMap.get(d.stage_id);
        return s && !s.is_lost && !isClosedWon(d.stage_id);
      });
      const won = aeDeals.filter((d) => isClosedWon(d.stage_id));
      const lost = aeDeals.filter((d) => stageMap.get(d.stage_id)?.is_lost);
      const pipeline = open.reduce((a, d) => a + d.value, 0);
      const forecast = open.reduce((a, d) => a + (d.value * (stageMap.get(d.stage_id)?.probability ?? 0)) / 100, 0);
      const wonValue = won.reduce((a, d) => a + d.value, 0);
      const wonDeals = [...won].sort((a, b) => b.value - a.value);
      const closedTotal = won.length + lost.length;
      const winRate = closedTotal > 0 ? Math.round((won.length / closedTotal) * 100) : 0;
      const wonAll = allAeDeals.filter((d) => isClosedWon(d.stage_id));
      const lostAll = allAeDeals.filter((d) => stageMap.get(d.stage_id)?.is_lost);
      const conversion = (wonAll.length + lostAll.length) > 0 ? Math.round((wonAll.length / (wonAll.length + lostAll.length)) * 100) : 0;
      const target = qFilter === "ALL" ? 0 :
        (aeTargetsData.find((t) => t.ae_name === ae && t.quarter_key === qFilter)?.target ?? 0);
      const remaining = Math.max(0, target - wonValue);
      const weeklyNeeded = weeksLeft > 0 ? remaining / weeksLeft : remaining;
      const targetProgress = target > 0 ? Math.min(100, Math.round((wonValue / target) * 100)) : 0;
      const convRatio = conversion / 100;
      const pipelineNeeded = convRatio > 0 ? remaining / convRatio : 0;
      const pipelineGap = Math.max(0, pipelineNeeded - pipeline);
      const overdueTasks = aeDeals.flatMap((d) => d.tasks.filter((t) => !t.completed && isPast(new Date(t.due_at))));
      return {
        ae, open: open.length, won: won.length, lost: lost.length,
        pipeline, forecast, wonValue, winRate, conversion,
        target, remaining, weeklyNeeded, targetProgress, overdueTasks,
        pipelineNeeded, pipelineGap, convRatio, wonDeals,
      };
    });
  }, [deals, stages, quarter, qFilter, weeksLeft, subAeFilter, eventFilter, aeList, aeTargetsData]);

  return (
    <section className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold text-foreground mr-2">Dashboard AE</div>
        <Select value={qFilter} onValueChange={(v) => setQFilter(v as QuarterKey)}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los Q</SelectItem>
            {QUARTERS.map((q) => <SelectItem key={q.key} value={q.key}>{q.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={subAeFilter} onValueChange={(v) => setSubAeFilter(v as SecondaryAe | "ALL")}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Sub-AE (Otros)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los sub-AE</SelectItem>
            {secondaryAeList.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Popover open={eventFilterOpen} onOpenChange={setEventFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-8 w-[180px] text-xs justify-between font-normal px-3">
              <span className="truncate">
                {eventFilter.includes("ALL") || eventFilter.length === 0
                  ? "Todos los eventos"
                  : `${eventFilter.length} evento(s)`}
              </span>
              {eventFilter.includes("ALL") || eventFilter.length === 0 ? null : (
                <span className="ml-1 rounded-full bg-primary px-1.5 py-0 text-[10px] text-primary-foreground">
                  {eventFilter.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar evento..." />
              <CommandList>
                <CommandEmpty>Sin eventos</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="ALL"
                    onSelect={() => {
                      setEventFilter(["ALL"]);
                      setEventFilterOpen(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Checkbox checked={eventFilter.includes("ALL")} />
                    <span>Todos los eventos</span>
                    {eventFilter.includes("ALL") && <Check className="ml-auto h-4 w-4" />}
                  </CommandItem>
                  {events.map((e) => {
                    const selected = eventFilter.includes(e.name);
                    return (
                      <CommandItem
                        key={e.id}
                        value={e.name}
                        onSelect={() => {
                          setEventFilter((prev) => {
                            if (prev.includes("ALL")) return [e.name];
                            const next = selected
                              ? prev.filter((v) => v !== e.name)
                              : [...prev, e.name];
                            return next.length > 0 ? next : ["ALL"];
                          });
                        }}
                        className="flex items-center gap-2"
                      >
                        <Checkbox checked={selected} />
                        <span className="truncate">{e.name}</span>
                        {selected && <Check className="ml-auto h-4 w-4" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Team summary */}
      {(() => {
        const team = perAe.reduce(
          (acc, a) => {
            acc.wonValue += a.wonValue;
            acc.target += a.target;
            acc.pipeline += a.pipeline;
            acc.forecast += a.forecast;
            acc.open += a.open;
            acc.won += a.won;
            acc.lost += a.lost;
            return acc;
          },
          { wonValue: 0, target: 0, pipeline: 0, forecast: 0, open: 0, won: 0, lost: 0 }
        );
        const teamPct = team.target > 0 ? Math.min(100, Math.round((team.wonValue / team.target) * 100)) : 0;
        const remaining = Math.max(0, team.target - team.wonValue);
        const weeklyNeeded = weeksLeft > 0 ? remaining / weeksLeft : remaining;
        return (
          <div className="bg-card border-2 border-primary/40 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-foreground">Equipo · Ventas acumuladas {qFilter !== "ALL" ? qFilter : "(todos los Q)"}</h2>
                <p className="text-xs text-muted-foreground">
                  {isCurrentQuarter ? "Suma de cierres y pipeline de todos los AEs según el filtro" : "Suma de cierres de todos los AEs según el filtro"}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">{teamPct}% meta</span>
            </div>
            {isCurrentQuarter ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div>
                  <div className="text-xs text-muted-foreground">Won + Commit</div>
                  <div className="text-2xl font-bold tabular-nums text-foreground">{money(team.wonValue)}</div>
                  {team.target > 0 && <div className="text-xs text-muted-foreground">de {money(team.target)}</div>}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Pipeline abierto</div>
                  <div className="text-2xl font-bold tabular-nums text-foreground">{money(team.pipeline)}</div>
                  <div className="text-xs text-muted-foreground">{team.open} deals</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Forecast</div>
                  <div className="text-2xl font-bold tabular-nums text-primary">{money(team.forecast)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Necesita / sem</div>
                  <div className="text-2xl font-bold tabular-nums text-foreground">{team.target > 0 ? money(weeklyNeeded) : "—"}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div>
                  <div className="text-xs text-muted-foreground">Won + Commit</div>
                  <div className="text-2xl font-bold tabular-nums text-foreground">{money(team.wonValue)}</div>
                  {team.target > 0 && <div className="text-xs text-muted-foreground">de {money(team.target)}</div>}
                  <div className="text-xs text-muted-foreground">{team.won} deals cerrados</div>
                </div>
              </div>
            )}
            {team.target > 0 && (
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${teamPct}%` }} />
              </div>
            )}
          </div>
        );
      })()}

      {/* Per-AE cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {perAe.map((a) => (
          <div key={a.ae} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{a.ae}</h3>
              {isCurrentQuarter && <span className="text-xs px-2 py-0.5 rounded bg-muted">{a.conversion}% conv</span>}
            </div>

            {isCurrentQuarter ? (
              <>
                {a.target > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Meta Q</span>
                      <span className="font-semibold">{money(a.wonValue)} / {money(a.target)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${a.targetProgress}%` }} />
                    </div>
                    <div className="flex justify-between text-xs pt-0.5">
                      <span className="text-muted-foreground">Necesita / sem</span>
                      <span className="font-semibold text-primary">{money(a.weeklyNeeded)}</span>
                    </div>
                  </div>
                )}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Abiertos</span><span className="font-semibold">{a.open}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pipeline</span><span className="font-semibold">{money(a.pipeline)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Forecast</span><span className="font-semibold text-primary">{money(a.forecast)}</span></div>
                  {a.target > 0 && (
                    <div className="space-y-0.5 pt-1 border-t border-border/60">
                      <div className="flex justify-between text-xs" title={`Pipeline necesario = (meta - cerrado) / conversión (${a.conversion}%)`}>
                        <span className="text-muted-foreground">Pipe necesario p/ meta</span>
                        <span className="font-semibold">{a.convRatio > 0 ? money(a.pipelineNeeded) : "—"}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Falta meter al pipe</span>
                        <span className={`font-semibold ${a.pipelineGap > 0 ? "text-primary" : "text-score-high"}`}>
                          {a.convRatio > 0 ? money(a.pipelineGap) : "—"}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-xs pt-1 border-t border-border">
                    <span className="text-score-high">Won+Commit {a.won}</span>
                    <span className="text-muted-foreground">Win {a.winRate}%</span>
                    <span className="text-destructive">Lost {a.lost}</span>
                  </div>
                  {a.overdueTasks.length > 0 && <div className="text-xs text-destructive">{a.overdueTasks.length} tarea(s) vencida(s)</div>}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                {a.target > 0 ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Cerrado / Meta</span>
                      <span className="font-semibold">{money(a.wonValue)} / {money(a.target)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${a.targetProgress}%` }} />
                    </div>
                    <div className="text-right text-xs font-semibold text-primary">{a.targetProgress}% de meta</div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div className="text-xs text-muted-foreground">Total cerrado</div>
                    <div className="text-2xl font-bold tabular-nums text-foreground">{money(a.wonValue)}</div>
                  </div>
                )}
                <div className="flex justify-between text-xs pt-1 border-t border-border">
                  <span className="text-score-high">Won+Commit {a.won}</span>
                  <span className="text-muted-foreground">Win {a.winRate}%</span>
                  <span className="text-destructive">Lost {a.lost}</span>
                </div>
              </div>
            )}

            {a.wonDeals.length > 0 && (
              <div className="pt-1 border-t border-border/60 text-[11px] text-muted-foreground space-y-0.5 max-h-28 overflow-auto">
                {a.wonDeals.map((d) => (
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

      <AvgDaysToCloseCard deals={deals} stages={stages} />
    </section>
  );
}