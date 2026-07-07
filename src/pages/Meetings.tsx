import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Pencil, Check, X, ChevronDown, ChevronRight, Trash2, CalendarClock, ArrowUpDown } from "lucide-react";
import { useCompanyData } from "@/hooks/useCompanyData";
import { useDealsData } from "@/hooks/useDealsData";
import { supabase } from "@/integrations/supabase/client";
import { AE_OPTIONS, AccountExecutive } from "@/types/meeting";
import { SDR_OPTIONS, Sdr } from "@/types/company";
import { usePipeGoals, DEFAULT_AE_PIPE_GOALS, DEFAULT_SDR_PIPE_GOALS, PIPE_TEAM_WEEKLY_GOAL } from "@/hooks/usePipeGoals";
import { useSdrMeetingGoals } from "@/hooks/useSdrMeetingGoals";
import { sdrListForWeek } from "@/lib/sdrLists";
import { getIsoWeek, formatWeekRange } from "@/lib/week";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Meeting } from "@/types/meeting";
import { toast } from "sonner";
import { AeDashboardSection } from "@/components/dashboard/AeDashboardSection";
import { WeeklyClosuresCard } from "@/components/dashboard/WeeklyClosuresCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  PieChart,
  Pie,
} from "recharts";

const AE_COLORS: Record<AccountExecutive, string> = {
  Nico: "hsl(217 91% 60%)",
  Majo: "hsl(38 92% 50%)",
  Santi: "hsl(142 71% 45%)",
  Toqui: "hsl(280 70% 60%)",
  "Otro AE": "hsl(220 9% 55%)",
};

const SDR_PIPE_COLORS: Record<string, string> = {
  "César": "hsl(199 89% 48%)",
  Jissad: "hsl(340 75% 55%)",
  Mapi: "hsl(160 70% 42%)",
  Juan: "hsl(280 70% 60%)",
  "Self AE": "hsl(0 0% 20%)",
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function Meetings() {
  const { meetings, meetingGoals, activities, setMeetingGoal, setMeetingOutcome, deleteMeeting, updateMeetingSchedule, updateMeetingAssignment } = useCompanyData();
  const { deals, stages } = useDealsData();
  const [stageHistory, setStageHistory] = useState<{ deal_id: string; stage_id: string; entered_at: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("deal_stage_history")
        .select("deal_id,stage_id,entered_at")
        .order("entered_at", { ascending: true });
      setStageHistory(
        (data ?? []).map((r: any) => ({
          deal_id: r.deal_id,
          stage_id: r.stage_id,
          entered_at: new Date(r.entered_at).getTime(),
        }))
      );
    };
    load();
    const ch = (supabase as any)
      .channel(`dsh-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_stage_history" }, load)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);
  const today = new Date();
  const current = getIsoWeek(today);
  const [year, setYear] = useState(current.year);
  const [week, setWeek] = useState(current.week);
  const [editingAe, setEditingAe] = useState<AccountExecutive | null>(null);
  const [editValue, setEditValue] = useState("");
  const { goalFor: pipeGoalFor, setGoal: setPipeGoal } = usePipeGoals(year, week);
  const { goalFor: sdrMeetGoalFor, setGoal: setSdrMeetGoal } = useSdrMeetingGoals(year, week);
  const [editingSdrMeetKey, setEditingSdrMeetKey] = useState<string | null>(null);
  const [editingSdrMeetValue, setEditingSdrMeetValue] = useState("");
  const [editingPipeKey, setEditingPipeKey] = useState<string | null>(null);
  const [editingPipeValue, setEditingPipeValue] = useState("");
  const [showUnqTable, setShowUnqTable] = useState(false);
  const [pendingUnq, setPendingUnq] = useState<Meeting | null>(null);
  const [unqReason, setUnqReason] = useState("");
  const [reschedFor, setReschedFor] = useState<Meeting | null>(null);
  const [reschedValue, setReschedValue] = useState("");
  const [meetingSort, setMeetingSort] = useState<{ key: "ae" | "sdr" | "date"; direction: "asc" | "desc" }>({ key: "date", direction: "asc" });

  // Filtro de rango para "Métricas clave por SDR"
  const [metricRange, setMetricRange] = useState<"week" | "today" | "yesterday" | "custom">("week");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [pinnedSdr, setPinnedSdr] = useState<string | null>(null);

  const activeMeetings = useMemo(() => meetings.filter((m) => m.outcome !== "no_show"), [meetings]);

  const sortedWeekMeetings = useMemo(() => {
    const weekMeetings = activeMeetings.filter((m) => m.iso_year === year && m.iso_week === week);
    weekMeetings.sort((a, b) => {
      const dir = meetingSort.direction === "asc" ? 1 : -1;
      if (meetingSort.key === "date") return dir * (a.scheduled_at - b.scheduled_at);
      if (meetingSort.key === "ae") return dir * a.account_executive.localeCompare(b.account_executive);
      return dir * ((a.sdr ?? "").localeCompare(b.sdr ?? ""));
    });
    return weekMeetings;
  }, [activeMeetings, year, week, meetingSort]);

  const openReschedule = (m: Meeting) => {
    const d = new Date(m.scheduled_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setReschedValue(local);
    setReschedFor(m);
  };

  const confirmReschedule = async () => {
    if (!reschedFor || !reschedValue) return;
    const ts = new Date(reschedValue).getTime();
    if (isNaN(ts)) { toast.error("Fecha inválida"); return; }
    await updateMeetingSchedule(reschedFor.id, ts);
    toast.success(reschedFor.gcal_event_id ? "Reunión reprogramada y sincronizada con Calendar" : "Reunión reprogramada");
    setReschedFor(null);
    setReschedValue("");
  };

  const handleDelete = async (m: Meeting) => {
    if (!confirm(`¿Eliminar la reunión con ${m.company_name}? ${m.gcal_event_id ? "También se eliminará del Calendar." : ""}`)) return;
    await deleteMeeting(m.id);
    toast.success("Reunión eliminada");
  };

  const handleOutcomeChange = (m: Meeting, value: string) => {
    if (value === "unqualified") {
      setUnqReason(m.outcome_reason ?? "");
      setPendingUnq(m);
      return;
    }
    if (value === "no_show") {
      if (!confirm(`¿Marcar como no-show? La reunión con ${m.company_name} se eliminará y la empresa pasará a "Reagendar".`)) return;
    }
    setMeetingOutcome(m.id, value as "qualified" | "unqualified" | "no_show");
  };

  const confirmUnqualified = async () => {
    if (!pendingUnq) return;
    const r = unqReason.trim();
    if (!r) return;
    await setMeetingOutcome(pendingUnq.id, "unqualified", r);
    setPendingUnq(null);
    setUnqReason("");
  };

  const goalFor = (ae: AccountExecutive, y = year, w = week) =>
    meetingGoals.find((g) => g.iso_year === y && g.iso_week === w && g.account_executive === ae)?.goal ?? 0;

  const actualFor = (ae: AccountExecutive, y = year, w = week) =>
    activeMeetings.filter((m) => m.iso_year === y && m.iso_week === w && m.account_executive === ae).length;

  const weekData = useMemo(
    () =>
      AE_OPTIONS.map((ae) => ({
        ae,
        actual: actualFor(ae),
        meta: goalFor(ae),
        pct: goalFor(ae) > 0 ? Math.round((actualFor(ae) / goalFor(ae)) * 100) : 0,
      })),
    [activeMeetings, meetingGoals, year, week]
  );

  // Pipe Ingresado: deals creados en la semana seleccionada por AEs,
  // o deals movidos desde "cierre perdido" a un stage activo durante la semana.
  const pipeData = useMemo(() => {
    // Mapa de meetings por company para atribuir AE/SDR según la reunión previa.
    const meetingsByCompany = new Map<string, { sdr: string | null; ae: AccountExecutive | null; created_at: number }[]>();
    for (const m of activeMeetings) {
      const arr = meetingsByCompany.get(m.company_id) ?? [];
      arr.push({ sdr: m.sdr, ae: m.account_executive as AccountExecutive, created_at: m.created_at });
      meetingsByCompany.set(m.company_id, arr);
    }
    const stageMap = new Map(stages.map((s) => [s.id, s]));
    // Rango de la semana (inicio del lunes ISO y fin del domingo)
    const weekStart = (() => {
      // Reconstruct from year/week: find Monday
      const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
      const dow = simple.getUTCDay() || 7;
      const monday = new Date(simple);
      if (dow <= 4) monday.setUTCDate(simple.getUTCDate() - dow + 1);
      else monday.setUTCDate(simple.getUTCDate() + 8 - dow);
      monday.setUTCHours(0, 0, 0, 0);
      return monday.getTime();
    })();
    const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000 - 1;

    // Historia por deal, ordenada por entered_at asc.
    const historyByDeal = new Map<string, typeof stageHistory>();
    for (const h of stageHistory) {
      const arr = historyByDeal.get(h.deal_id) ?? [];
      arr.push(h);
      historyByDeal.set(h.deal_id, arr);
    }

    // Set de deals que reabrieron desde "lost" durante la semana.
    const reopenedInWeek = new Set<string>();
    for (const [dealId, hist] of historyByDeal) {
      for (let i = 1; i < hist.length; i++) {
        const prev = stageMap.get(hist[i - 1].stage_id);
        const next = stageMap.get(hist[i].stage_id);
        if (!prev || !next) continue;
        const t = hist[i].entered_at;
        if (prev.is_lost && !next.is_lost && !next.is_won && t >= weekStart && t <= weekEnd) {
          reopenedInWeek.add(dealId);
          break;
        }
      }
    }

    const perAe: Record<AccountExecutive, { value: number; deals: { company: string; value: number; sdr: string | null }[] }> = {
      Nico: { value: 0, deals: [] }, Majo: { value: 0, deals: [] },
      Santi: { value: 0, deals: [] }, Toqui: { value: 0, deals: [] },
      "Otro AE": { value: 0, deals: [] },
    };
    const counted = new Set<string>();
    for (const d of deals) {
      const createdInWeek = (() => {
        const w = getIsoWeek(new Date(d.created_at));
        return w.year === year && w.week === week;
      })();
      const isReopened = reopenedInWeek.has(d.id);
      if (!createdInWeek && !isReopened) continue;
      if (counted.has(d.id)) continue;
      counted.add(d.id);
      const ms = meetingsByCompany.get(d.company_id);
      // Prioriza la reunión previa más reciente para atribuir AE y SDR.
      const priorMeetings = (ms ?? [])
        .filter((mm) => mm.created_at <= d.created_at)
        .sort((a, b) => b.created_at - a.created_at);
      const priorAe = priorMeetings.find((mm) => mm.ae);
      const priorSdr = priorMeetings.find((mm) => mm.sdr);
      const attributedAe: AccountExecutive = (priorAe?.ae as AccountExecutive) ?? d.account_executive;
      const bucket = perAe[attributedAe];
      if (!bucket) continue;
      bucket.value += d.value;
      bucket.deals.push({ company: d.company_name, value: d.value, sdr: priorSdr?.sdr ?? null });
    }
    return perAe;
  }, [deals, activeMeetings, year, week, stages, stageHistory]);

  // "Valor de Deal Generado" por reunión: suma de deals para esa empresa creados después de la reunión.
  const dealValueByMeeting = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of activeMeetings) {
      const total = deals
        .filter((d) => d.company_id === m.company_id && d.created_at >= m.created_at)
        .reduce((a, d) => a + d.value, 0);
      map.set(m.id, total);
    }
    return map;
  }, [activeMeetings, deals]);

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 6,
    fontSize: 12,
  } as const;

  const startEdit = (ae: AccountExecutive) => {
    setEditingAe(ae);
    setEditValue(String(goalFor(ae)));
  };
  const saveEdit = async () => {
    if (!editingAe) return;
    const n = parseInt(editValue, 10);
    if (!isNaN(n) && n >= 0) {
      await setMeetingGoal(year, week, editingAe, n);
    }
    setEditingAe(null);
  };

  const shiftWeek = (delta: number) => {
    const monday = isoWeekMonday(year, week);
    monday.setDate(monday.getDate() + delta * 7);
    const next = getIsoWeek(monday);
    setYear(next.year);
    setWeek(next.week);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-[49px] z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Pipeline
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Reuniones, pipe ingresado y métricas de AE</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            
            <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>← Semana anterior</Button>
            <div className="text-sm font-semibold text-foreground px-3 py-1 rounded-md bg-muted">
              Semana {week} · {year} <span className="text-muted-foreground font-normal">({formatWeekRange(year, week)})</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>Semana siguiente →</Button>
            {(year !== current.year || week !== current.week) && (
              <Button variant="ghost" size="sm" onClick={() => { setYear(current.year); setWeek(current.week); }}>Hoy</Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-5 space-y-4 pb-12">
        <Tabs defaultValue="semanal" className="w-full">
          <TabsList>
            <TabsTrigger value="por-q">Meta ventas Q</TabsTrigger>
            <TabsTrigger value="semanal">AE semanal</TabsTrigger>
            <TabsTrigger value="sdr-semanal">SDR Semanal</TabsTrigger>
          </TabsList>

          <TabsContent value="por-q" className="space-y-4 mt-4">
            <AeDashboardSection />
          </TabsContent>

          <TabsContent value="semanal" className="space-y-4 mt-4">
            <WeeklyClosuresCard year={year} week={week} />

            {/* Pipe Ingresado por AE */}
            {(() => {
          const aes: AccountExecutive[] = ["Majo", "Santi", "Nico", "Toqui"];
          const teamActual = aes.reduce((s, ae) => s + (pipeData[ae]?.value ?? 0), 0);
          const teamGoal = aes.reduce((s, ae) => s + pipeGoalFor("ae", ae), 0) || PIPE_TEAM_WEEKLY_GOAL;
          const teamPct = teamGoal > 0 ? Math.min(100, Math.round((teamActual / teamGoal) * 100)) : 0;

          const renderEditable = (key: string, meta: number) => {
            if (editingPipeKey === key) {
              return (
                <div className="flex items-center gap-1">
                  <Input autoFocus type="number" value={editingPipeValue} onChange={(e) => setEditingPipeValue(e.target.value)} className="h-6 w-24 text-xs px-1" />
                  <button onClick={async () => {
                    const n = parseInt(editingPipeValue, 10);
                    if (!isNaN(n) && n >= 0) { const [type, ...rest] = key.split(":"); await setPipeGoal(type as "ae" | "sdr", rest.join(":"), n); }
                    setEditingPipeKey(null);
                  }} className="text-success"><Check className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setEditingPipeKey(null)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                </div>
              );
            }
            return (
              <button onClick={() => { setEditingPipeKey(key); setEditingPipeValue(String(meta)); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                de {fmtMoney(meta)} meta <Pencil className="h-3 w-3" />
              </button>
            );
          };

          return (
            <section className="bg-card border border-border rounded-lg p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-1">Pipe Ingresado por AE — Semana {week}</h2>
                <p className="text-xs text-muted-foreground">
                  Valor de deals creados esta semana (con o sin reunión previa) más deals que pasaron de "cierre perdido" a un stage activo durante la semana. Las metas son editables por semana.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {aes.map((ae) => {
                  const actual = pipeData[ae]?.value ?? 0;
                  const meta = pipeGoalFor("ae", ae);
                  const pct = meta > 0 ? Math.min(100, Math.round((actual / meta) * 100)) : 0;
                  const dealsList = pipeData[ae]?.deals ?? [];
                  return (
                    <div key={ae} className="bg-background border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{ae}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: `${AE_COLORS[ae]}20`, color: AE_COLORS[ae] }}>{pct}%</span>
                      </div>
                      <div className="text-xl font-bold tabular-nums text-foreground">{fmtMoney(actual)}</div>
                      {renderEditable(`ae:${ae}`, meta)}
                      <div className="h-1.5 bg-muted rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${pct}%`, background: AE_COLORS[ae] }} />
                      </div>
                      {dealsList.length > 0 && (
                        <div className="pt-1 border-t border-border/60 text-[11px] text-muted-foreground space-y-0.5 max-h-32 overflow-auto">
                          {dealsList.map((d, i) => (
                            <div key={i} className="flex justify-between gap-2">
                              <span className="truncate" title={`${d.company} · SDR: ${d.sdr ?? "—"}`}>{d.company}</span>
                              <span className="tabular-nums font-medium text-foreground">{fmtMoney(d.value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">Equipo</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">{teamPct}%</span>
                </div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-bold tabular-nums text-foreground">{fmtMoney(teamActual)}</span>
                  <span className="text-xs text-muted-foreground">de {fmtMoney(teamGoal)} meta semanal</span>
                </div>
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div className="h-full rounded bg-primary" style={{ width: `${teamPct}%` }} />
                </div>
              </div>
            </section>
          );
        })()}

        <section className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-1">Reuniones por AE — Semana {week}</h2>
            <p className="text-xs text-muted-foreground">Reuniones agendadas por cada AE vs su meta semanal (editable).</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {AE_OPTIONS.map((ae) => {
              const aeMeetings = activeMeetings
                .filter((m) => m.iso_year === year && m.iso_week === week && m.account_executive === ae)
                .sort((a, b) => a.scheduled_at - b.scheduled_at);
              const actual = aeMeetings.length;
              const meta = goalFor(ae);
              const pct = meta > 0 ? Math.min(100, Math.round((actual / meta) * 100)) : 0;
              const editing = editingAe === ae;
              return (
                <div key={ae} className="bg-background border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{ae}</span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ background: `${AE_COLORS[ae]}20`, color: AE_COLORS[ae] }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground tabular-nums">{actual}</span>
                    <span className="text-sm text-muted-foreground">/ {editing ? "" : meta} meta</span>
                  </div>
                  {editing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-7 text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingAe(null);
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingAe(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(ae)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" /> Editar meta
                    </button>
                  )}
                  <div className="h-1.5 bg-muted rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${pct}%`, background: AE_COLORS[ae] }} />
                  </div>
                  {aeMeetings.length > 0 && (
                    <div className="pt-1 border-t border-border/60 text-[11px] text-muted-foreground space-y-0.5 max-h-32 overflow-auto">
                      {aeMeetings.map((m) => (
                        <div
                          key={m.id}
                          className="flex justify-between gap-2"
                          title={`${format(new Date(m.scheduled_at), "dd/MM/yyyy HH:mm")} · SDR: ${m.sdr ?? "—"}`}
                        >
                          <span className="truncate">{m.company_name}</span>
                          <span className="tabular-nums font-medium text-foreground">
                            {format(new Date(m.scheduled_at), "dd/MM HH:mm")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
          </TabsContent>

          <TabsContent value="sdr-semanal" className="space-y-4 mt-4">
            {/* Métricas clave por SDR (movido del Dashboard SDR) */}
            {(() => {
              // Calcula rango según filtro seleccionado
              const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
              const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime(); };
              let fromTs: number;
              let toTs: number;
              let rangeLabel = `Semana ${week}`;
              if (metricRange === "today") {
                fromTs = startOfDay(new Date());
                toTs = endOfDay(new Date());
                rangeLabel = "Hoy";
              } else if (metricRange === "yesterday") {
                const y = new Date(); y.setDate(y.getDate() - 1);
                fromTs = startOfDay(y);
                toTs = endOfDay(y);
                rangeLabel = "Ayer";
              } else if (metricRange === "custom" && customFrom && customTo) {
                fromTs = startOfDay(new Date(customFrom));
                toTs = endOfDay(new Date(customTo));
                rangeLabel = `${customFrom} → ${customTo}`;
              } else {
                const weekStart = isoWeekMonday(year, week);
                fromTs = weekStart.getTime();
                toTs = fromTs + 7 * 86400000 - 1;
              }
              const sdrList = sdrListForWeek(year, week);
              type Bucket = { contactadas: number; contactos: number; followups: number; agendadas: number; _agendadasNames: string[]; _contactadasNames: string[] };
              const buckets: Record<string, Bucket> = {};
              for (const s of sdrList) buckets[s] = { contactadas: 0, contactos: 0, followups: 0, agendadas: 0, _agendadasNames: [], _contactadasNames: [] };
              for (const a of activities) {
                if (a.timestamp < fromTs || a.timestamp > toTs) continue;
                if (!a.sdr || !buckets[a.sdr]) continue;
                const b = buckets[a.sdr];
                if (a.type === "status_change" && a.to_status) {
                  // "Empresas contactadas" cuenta toda salida desde "por_contactar"
                  // hacia un estado productivo (contactado, en_conversacion, follow_up_*, agendado).
                  // Se excluyen movimientos a unqualified.
                  if (
                    a.from_status === "por_contactar" &&
                    a.to_status !== "unqualified" &&
                    a.to_status !== "unqualified_post_meeting" &&
                    a.to_status !== "por_contactar"
                  ) {
                    b.contactadas++;
                    b._contactadasNames.push(a.company_name);
                  } else if (a.to_status === "contactado") {
                    // Fallback: cambios a "contactado" sin from_status registrado.
                    b.contactadas++;
                    b._contactadasNames.push(a.company_name);
                  }
                  if (a.to_status === "follow_up_1" || a.to_status === "follow_up_2") b.followups++;
                } else if (a.type === "contact_added") {
                  b.contactos++;
                }
              }
              for (const m of activeMeetings) {
                if (m.created_at < fromTs || m.created_at > toTs) continue;
                if (!m.sdr || !buckets[m.sdr]) continue;
                buckets[m.sdr].agendadas++;
                buckets[m.sdr]._agendadasNames.push(m.company_name);
              }
              const data = sdrList.map((sdr) => ({ sdr, ...buckets[sdr] }));
              const METRIC_COLORS = {
                contactadas: "hsl(217 91% 60%)",
                contactos: "hsl(142 71% 45%)",
                followups: "hsl(199 89% 48%)",
                agendadas: "hsl(38 92% 50%)",
              };
              const METRIC_LABELS: Record<string, string> = {
                contactadas: "Empresas contactadas",
                contactos: "Contactos agregados",
                followups: "Follow Ups",
                agendadas: "Empresas agendadas",
              };
              type TP = { dataKey: string; value: number; color: string; payload: Record<string, unknown> };
              const CompaniesTooltip = ({ active, payload, label }: { active?: boolean; payload?: TP[]; label?: string }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div style={tooltipStyle} className="p-2 max-w-xs">
                    <div className="text-xs font-semibold text-foreground mb-1">{label}</div>
                    {payload.map((p) => {
                      const namesKey = p.dataKey === "agendadas" ? "_agendadasNames" : p.dataKey === "contactadas" ? "_contactadasNames" : null;
                      const names = (namesKey ? (p.payload[namesKey] as string[] | undefined) : undefined) ?? [];
                      return (
                        <div key={p.dataKey} className="mb-1.5 last:mb-0">
                          <div className="text-xs" style={{ color: p.color }}>
                            <span className="font-medium">{METRIC_LABELS[p.dataKey] ?? p.dataKey}:</span> {p.value}
                          </div>
                          {names.length > 0 && (
                            <ul className="mt-0.5 pl-2 text-[11px] text-muted-foreground max-h-40 overflow-auto">
                              {names.map((n, i) => (<li key={i}>• {n}</li>))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              };
              return (
                <section className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground mb-1">Métricas clave por SDR — {rangeLabel}</h2>
                      <p className="text-xs text-muted-foreground">Empresas contactadas, contactos agregados, follow ups y empresas agendadas</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={metricRange} onValueChange={(v) => setMetricRange(v as typeof metricRange)}>
                        <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="week">Esta semana</SelectItem>
                          <SelectItem value="today">Hoy</SelectItem>
                          <SelectItem value="yesterday">Ayer</SelectItem>
                          <SelectItem value="custom">Personalizada</SelectItem>
                        </SelectContent>
                      </Select>
                      {metricRange === "custom" && (
                        <>
                          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 text-xs w-[140px]" />
                          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 text-xs w-[140px]" />
                        </>
                      )}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={data}
                      barGap={6}
                      onClick={(e: { activeLabel?: string } | null) => {
                        const lbl = e?.activeLabel;
                        if (!lbl) return;
                        setPinnedSdr((curr) => (curr === lbl ? null : lbl));
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="sdr" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        content={<CompaniesTooltip />}
                        cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                        wrapperStyle={{ pointerEvents: "auto" }}
                        allowEscapeViewBox={{ x: true, y: true }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="contactadas" name="Empresas contactadas" fill={METRIC_COLORS.contactadas} radius={[4, 4, 0, 0]} cursor="pointer" />
                      <Bar dataKey="contactos" name="Contactos agregados" fill={METRIC_COLORS.contactos} radius={[4, 4, 0, 0]} cursor="pointer" />
                      <Bar dataKey="followups" name="Follow Ups" fill={METRIC_COLORS.followups} radius={[4, 4, 0, 0]} cursor="pointer" />
                      <Bar dataKey="agendadas" name="Empresas agendadas" fill={METRIC_COLORS.agendadas} radius={[4, 4, 0, 0]} cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs border-t border-border pt-2">
                    <span className="font-semibold text-foreground">Equipo SDR</span>
                    <span style={{ color: METRIC_COLORS.contactadas }}>{data.reduce((s, d) => s + d.contactadas, 0)} contactadas</span>
                    <span style={{ color: METRIC_COLORS.contactos }}>{data.reduce((s, d) => s + d.contactos, 0)} contactos</span>
                    <span style={{ color: METRIC_COLORS.followups }}>{data.reduce((s, d) => s + d.followups, 0)} follow ups</span>
                    <span style={{ color: METRIC_COLORS.agendadas }}>{data.reduce((s, d) => s + d.agendadas, 0)} agendadas</span>
                  </div>
                  {pinnedSdr && buckets[pinnedSdr] && (
                    <div className="mt-3 border border-border rounded-lg bg-background p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-foreground">
                          Detalle · {pinnedSdr}
                        </div>
                        <button
                          onClick={() => setPinnedSdr(null)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cerrar ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs font-semibold mb-1" style={{ color: METRIC_COLORS.contactadas }}>
                            Empresas contactadas ({buckets[pinnedSdr].contactadas})
                          </div>
                          <ul className="text-xs text-muted-foreground max-h-64 overflow-auto pr-1 space-y-0.5">
                            {buckets[pinnedSdr]._contactadasNames.length === 0
                              ? <li className="italic">— Ninguna —</li>
                              : buckets[pinnedSdr]._contactadasNames.map((n, i) => <li key={i}>• {n}</li>)}
                          </ul>
                        </div>
                        <div>
                          <div className="text-xs font-semibold mb-1" style={{ color: METRIC_COLORS.agendadas }}>
                            Empresas agendadas ({buckets[pinnedSdr].agendadas})
                          </div>
                          <ul className="text-xs text-muted-foreground max-h-64 overflow-auto pr-1 space-y-0.5">
                            {buckets[pinnedSdr]._agendadasNames.length === 0
                              ? <li className="italic">— Ninguna —</li>
                              : buckets[pinnedSdr]._agendadasNames.map((n, i) => <li key={i}>• {n}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              );
            })()}

        {/* Reuniones por SDR */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-1">Reuniones por SDR — Semana {week}</h2>
            <p className="text-xs text-muted-foreground">Reuniones agendadas por cada SDR vs su meta semanal (editable).</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[...new Set([...sdrListForWeek(year, week), "Self AE"])].map((sdr) => {
              const sdrMeetings = activeMeetings.filter(
                (m) => m.iso_year === year && m.iso_week === week && (m.sdr ?? "") === sdr
              ).sort((a, b) => a.scheduled_at - b.scheduled_at);
              const actual = sdrMeetings.length;
              const meta = sdrMeetGoalFor(sdr);
              const pct = meta > 0 ? Math.min(100, Math.round((actual / meta) * 100)) : 0;
              const color = SDR_PIPE_COLORS[sdr] ?? "hsl(var(--muted-foreground))";
              const editing = editingSdrMeetKey === sdr;
              return (
                <div key={sdr} className="bg-background border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{sdr}</span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ background: `${color}20`, color }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground tabular-nums">{actual}</span>
                    <span className="text-sm text-muted-foreground">/ {editing ? "" : meta} meta</span>
                  </div>
                  {editing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        type="number"
                        min={0}
                        value={editingSdrMeetValue}
                        onChange={(e) => setEditingSdrMeetValue(e.target.value)}
                        className="h-7 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const n = parseInt(editingSdrMeetValue, 10);
                            if (!isNaN(n) && n >= 0) setSdrMeetGoal(sdr, n);
                            setEditingSdrMeetKey(null);
                          }
                          if (e.key === "Escape") setEditingSdrMeetKey(null);
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={async () => {
                          const n = parseInt(editingSdrMeetValue, 10);
                          if (!isNaN(n) && n >= 0) await setSdrMeetGoal(sdr, n);
                          setEditingSdrMeetKey(null);
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingSdrMeetKey(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingSdrMeetKey(sdr); setEditingSdrMeetValue(String(meta)); }}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" /> Editar meta
                    </button>
                  )}
                  <div className="h-1.5 bg-muted rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  {sdrMeetings.length > 0 && (
                    <div className="pt-1 border-t border-border/60 text-[11px] text-muted-foreground space-y-0.5 max-h-32 overflow-auto">
                      {sdrMeetings.map((m) => {
                        const st = m.outcome === "qualified"
                          ? { label: "qualified", cls: "bg-emerald-500/15 text-emerald-600" }
                          : m.outcome === "unqualified"
                          ? { label: "unqualified", cls: "bg-red-500/15 text-red-600" }
                          : { label: "pendiente", cls: "bg-muted text-muted-foreground" };
                        return (
                          <div key={m.id} className="flex justify-between gap-2 items-center" title={m.company_name}>
                            <span className="truncate text-foreground">{m.company_name}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {(() => {
          const totalActual = weekData.reduce((s, d) => s + d.actual, 0);
          const totalTarget = weekData.reduce((s, d) => s + d.meta, 0);
          const pct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
          const achieved = Math.min(totalActual, totalTarget);
          const remaining = Math.max(0, totalTarget - totalActual);
          const over = Math.max(0, totalActual - totalTarget);
          const pieData =
            totalTarget === 0
              ? [{ name: "Sin meta definida", value: 1, fill: "hsl(var(--muted))" }]
              : over > 0
                ? [
                    { name: "Meta cumplida", value: achieved, fill: "hsl(142 71% 45%)" },
                    { name: "Excedente", value: over, fill: "hsl(217 91% 60%)" },
                  ]
                : [
                    { name: "Cumplido", value: achieved, fill: "hsl(142 71% 45%)" },
                    { name: "Pendiente", value: remaining, fill: "hsl(var(--muted))" },
                  ];
          return (
            <section className="bg-card border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-foreground mb-1">Cumplimiento global · Semana {week}</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Total reuniones agendadas vs meta global (suma de metas de todos los AE)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      stroke="hsl(var(--card))"
                    >
                      {pieData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  <div className="text-5xl font-bold text-foreground tabular-nums">{pct}%</div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground tabular-nums">{totalActual}</span> de{" "}
                    <span className="font-semibold text-foreground tabular-nums">{totalTarget}</span> reuniones meta
                  </div>
                  {over > 0 && (
                    <div className="text-xs text-primary font-medium">
                      +{over} sobre la meta
                    </div>
                  )}
                  {totalTarget === 0 && (
                    <div className="text-xs text-muted-foreground">Define metas semanales para ver el cumplimiento.</div>
                  )}
                </div>
              </div>
            </section>
          );
        })()}

        {/* Pipe Ingresado semanal por AE */}
        {(() => {
          const aes: AccountExecutive[] = ["Majo", "Santi", "Nico", "Toqui"];
          // Pipe por SDR: usa el SDR previo asociado al deal
          const sdrActual: Record<string, number> = {};
          const sdrDeals: Record<string, { company: string; value: number }[]> = {};
          const sdrList = sdrListForWeek(year, week);
          for (const ae of aes) {
            for (const d of pipeData[ae]?.deals ?? []) {
              const key = d.sdr && sdrList.includes(d.sdr) ? d.sdr : null;
              if (!key) continue;
              sdrActual[key] = (sdrActual[key] ?? 0) + d.value;
              (sdrDeals[key] ??= []).push({ company: d.company, value: d.value });
            }
          }
          const teamActual = sdrList.reduce((s, sdr) => s + (sdrActual[sdr] ?? 0), 0);
          const teamGoal = sdrList.reduce((s, sdr) => s + pipeGoalFor("sdr", sdr), 0);
          const teamPct = teamGoal > 0 ? Math.min(100, Math.round((teamActual / teamGoal) * 100)) : 0;

          const renderEditable = (key: string, meta: number) => {
            if (editingPipeKey === key) {
              return (
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    type="number"
                    value={editingPipeValue}
                    onChange={(e) => setEditingPipeValue(e.target.value)}
                    className="h-6 w-24 text-xs px-1"
                  />
                  <button
                    onClick={async () => {
                      const n = parseInt(editingPipeValue, 10);
                      if (!isNaN(n) && n >= 0) {
                        const [type, ...rest] = key.split(":");
                        await setPipeGoal(type as "ae" | "sdr", rest.join(":"), n);
                      }
                      setEditingPipeKey(null);
                    }}
                    className="text-success"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditingPipeKey(null)} className="text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }
            return (
              <button
                onClick={() => { setEditingPipeKey(key); setEditingPipeValue(String(meta)); }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                de {fmtMoney(meta)} meta <Pencil className="h-3 w-3" />
              </button>
            );
          };

          return (
            <section className="bg-card border border-border rounded-lg p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-1">Pipe Ingresado por SDR — Semana {week}</h2>
                <p className="text-xs text-muted-foreground">
                  Valor de deals creados esta semana atribuidos al SDR que originalmente agendó la reunión. Las metas son editables por semana.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {sdrList.map((sdr) => {
                  const actual = sdrActual[sdr] ?? 0;
                  const meta = pipeGoalFor("sdr", sdr);
                  const pct = meta > 0 ? Math.min(100, Math.round((actual / meta) * 100)) : 0;
                  const color = SDR_PIPE_COLORS[sdr];
                  const dealsList = sdrDeals[sdr] ?? [];
                  return (
                    <div key={sdr} className="bg-background border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{sdr}</span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ background: `${color}20`, color }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="text-xl font-bold tabular-nums text-foreground">{fmtMoney(actual)}</div>
                      {renderEditable(`sdr:${sdr}`, meta)}
                      <div className="h-1.5 bg-muted rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      {dealsList.length > 0 && (
                        <div className="pt-1 border-t border-border/60 text-[11px] text-muted-foreground space-y-0.5 max-h-32 overflow-auto">
                          {dealsList.map((d, i) => (
                            <div key={i} className="flex justify-between gap-2" title={d.company}>
                              <span className="truncate">{d.company}</span>
                              <span className="tabular-nums font-medium text-foreground">{fmtMoney(d.value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">Equipo SDR</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">{teamPct}%</span>
                </div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-bold tabular-nums text-foreground">{fmtMoney(teamActual)}</span>
                  <span className="text-xs text-muted-foreground">de {fmtMoney(teamGoal)} meta semanal</span>
                </div>
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div className="h-full rounded bg-primary" style={{ width: `${teamPct}%` }} />
                </div>
              </div>
            </section>
          );
        })()}

        {(() => {
          // Weekly outcome breakdown (qualified vs unqualified from Slack feedback)
          const inWeek = (m: Meeting) => m.iso_year === year && m.iso_week === week;
          const qualified = meetings.filter((m) => m.outcome === "qualified" && inWeek(m));
          const unqualified = meetings.filter((m) => m.outcome === "unqualified" && inWeek(m));
          const pending = meetings.filter((m) => inWeek(m) && !m.outcome);
          const totalRated = qualified.length + unqualified.length;
          const qPct = totalRated > 0 ? Math.round((qualified.length / totalRated) * 100) : 0;
          const uPct = totalRated > 0 ? 100 - qPct : 0;
          const outcomeData = totalRated === 0
            ? [{ name: "Sin validaciones", value: 1, fill: "hsl(var(--muted))" }]
            : [
                { name: "Qualified", value: qualified.length, fill: "hsl(142 71% 45%)" },
                { name: "Unqualified", value: unqualified.length, fill: "hsl(0 72% 51%)" },
              ];
          const unqSorted = [...unqualified].sort((a, b) => b.scheduled_at - a.scheduled_at);
          // Per-SDR breakdown
          const sdrList = sdrListForWeek(year, week);
          const perSdr = sdrList.map((sdr) => {
            const q = qualified.filter((m) => m.sdr === sdr).length;
            const u = unqualified.filter((m) => m.sdr === sdr).length;
            const pendingSdr = meetings.filter((m) => inWeek(m) && m.sdr === sdr && !m.outcome).length;
            const total = q + u;
            const pct = total > 0 ? Math.round((q / total) * 100) : 0;
            return { sdr, q, u, pending: pendingSdr, total, pct };
          });
          return (
            <section className="bg-card border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-foreground mb-1">Calidad de reuniones — Semana {week}</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Resultado de las reuniones de la semana validadas por los AE en Slack
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      stroke="hsl(var(--card))"
                    >
                      {outcomeData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-4">
                    <div>
                      <div className="text-3xl font-bold tabular-nums" style={{ color: "hsl(142 71% 45%)" }}>{qPct}%</div>
                      <div className="text-xs text-muted-foreground">Qualified ({qualified.length})</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold tabular-nums" style={{ color: "hsl(0 72% 51%)" }}>{uPct}%</div>
                      <div className="text-xs text-muted-foreground">Unqualified ({unqualified.length})</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold tabular-nums" style={{ color: "hsl(38 92% 50%)" }}>{pending.length}</div>
                      <div className="text-xs text-muted-foreground">Pendientes</div>
                    </div>
                  </div>
                  {totalRated === 0 && (
                    <div className="text-xs text-muted-foreground">Aún no hay reuniones validadas.</div>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <h3 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">Calidad por SDR</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {perSdr.map(({ sdr, q, u, pending, total, pct }) => {
                    const color = SDR_PIPE_COLORS[sdr] ?? "hsl(var(--muted-foreground))";
                    return (
                      <div key={sdr} className="bg-background border border-border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">{sdr}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: `${color}20`, color }}>
                            {total > 0 ? `${pct}%` : "—"}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-3 text-xs">
                          <span className="text-emerald-600 font-semibold tabular-nums">{q} <span className="font-normal text-muted-foreground">qualified</span></span>
                          <span className="text-red-600 font-semibold tabular-nums">{u} <span className="font-normal text-muted-foreground">unq.</span></span>
                          <span className="text-foreground font-semibold tabular-nums">{pending} <span className="font-normal text-muted-foreground">pend.</span></span>
                        </div>
                        <div className="h-1.5 bg-muted rounded overflow-hidden flex">
                          {total > 0 ? (
                            <>
                              <div className="h-full" style={{ width: `${pct}%`, background: "hsl(142 71% 45%)" }} />
                              <div className="h-full" style={{ width: `${100 - pct}%`, background: "hsl(0 72% 51%)" }} />
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <button
                  onClick={() => setShowUnqTable((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary"
                >
                  {showUnqTable ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Detalle de reuniones Unqualified ({unqualified.length})
                </button>
                {showUnqTable && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">AE</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha de reunión</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Razón</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unqSorted.map((m) => (
                          <tr key={m.id} className="border-b border-border last:border-b-0 align-top">
                            <td className="px-3 py-2 font-medium text-foreground">{m.company_name}</td>
                            <td className="px-3 py-2">
                              <span
                                className="text-xs font-semibold px-2 py-0.5 rounded"
                                style={{ background: `${AE_COLORS[m.account_executive]}20`, color: AE_COLORS[m.account_executive] }}
                              >
                                {m.account_executive}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground tabular-nums whitespace-nowrap">
                              {new Date(m.scheduled_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {m.outcome_reason || <span className="italic text-muted-foreground/70">Sin razón registrada</span>}
                            </td>
                          </tr>
                        ))}
                        {unqSorted.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-sm">
                              Aún no hay reuniones marcadas como Unqualified.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          );
        })()}
          </TabsContent>

          <TabsContent value="semanal" className="space-y-4 mt-4">

        <section className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => setMeetingSort((s) => ({ key: "ae", direction: s.key === "ae" && s.direction === "asc" ? "desc" : "asc" }))}
                    >
                      AE <ArrowUpDown className={`h-3 w-3 ${meetingSort.key === "ae" ? "text-primary" : "text-muted-foreground/40"}`} />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => setMeetingSort((s) => ({ key: "sdr", direction: s.key === "sdr" && s.direction === "asc" ? "desc" : "asc" }))}
                    >
                      SDR <ArrowUpDown className={`h-3 w-3 ${meetingSort.key === "sdr" ? "text-primary" : "text-muted-foreground/40"}`} />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => setMeetingSort((s) => ({ key: "date", direction: s.key === "date" && s.direction === "asc" ? "desc" : "asc" }))}
                    >
                      Cuándo <ArrowUpDown className={`h-3 w-3 ${meetingSort.key === "date" ? "text-primary" : "text-muted-foreground/40"}`} />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resultado</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor de Deal Generado</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Razón (Slack)</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedWeekMeetings.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">{m.company_name}</td>
                    <td className="px-3 py-2.5">
                      <Select
                        value={m.account_executive}
                        onValueChange={(v) => updateMeetingAssignment(m.id, { account_executive: v as AccountExecutive })}
                      >
                        <SelectTrigger
                          className="h-7 px-2 text-xs w-auto min-w-fit whitespace-nowrap font-semibold border-0"
                          style={{ background: `${AE_COLORS[m.account_executive]}20`, color: AE_COLORS[m.account_executive] }}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AE_OPTIONS.map((ae) => (
                            <SelectItem key={ae} value={ae}>{ae}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2.5">
                      <Select
                        value={m.sdr ?? "__none__"}
                        onValueChange={(v) => updateMeetingAssignment(m.id, { sdr: v === "__none__" ? null : (v as Sdr) })}
                      >
                        <SelectTrigger className="h-7 px-2 text-xs w-auto min-w-fit whitespace-nowrap">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Sin SDR —</SelectItem>
                          {SDR_OPTIONS.map((sdr) => (
                            <SelectItem key={sdr} value={sdr}>{sdr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                      {new Date(m.scheduled_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-2.5">
                      <Select value={m.outcome ?? ""} onValueChange={(v) => handleOutcomeChange(m, v)}>
                        <SelectTrigger
                          className="h-7 px-2 text-xs w-auto min-w-fit whitespace-nowrap font-semibold border"
                          title={m.outcome === "unqualified" ? m.outcome_reason ?? undefined : undefined}
                        >
                          <SelectValue placeholder="Pendiente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="qualified">✅ Qualified</SelectItem>
                          <SelectItem value="unqualified">❌ Unqualified</SelectItem>
                          <SelectItem value="no_show">🔁 No show / Reagendar</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-foreground whitespace-nowrap">
                      {(() => {
                        const v = dealValueByMeeting.get(m.id) ?? 0;
                        return v > 0 ? fmtMoney(v) : <span className="text-muted-foreground/60">—</span>;
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[280px]">
                      {m.outcome === "unqualified" && m.outcome_reason ? (
                        <span title={m.outcome_reason} className="line-clamp-2">
                          {m.outcome_reason}
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openReschedule(m)} title="Reprogramar fecha/hora">
                        <CalendarClock className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => handleDelete(m)} title="Eliminar reunión">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {sortedWeekMeetings.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No hay reuniones agendadas en esta semana.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!pendingUnq} onOpenChange={(o) => { if (!o) { setPendingUnq(null); setUnqReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar reunión como Unqualified</DialogTitle>
            <DialogDescription>
              {pendingUnq?.company_name} — explica por qué la reunión no calificó.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={4}
            value={unqReason}
            onChange={(e) => setUnqReason(e.target.value)}
            placeholder="Ej: No tienen presupuesto, fuera de ICP post-reunión, competidor..."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPendingUnq(null); setUnqReason(""); }}>Cancelar</Button>
            <Button onClick={confirmUnqualified} disabled={!unqReason.trim()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reschedFor} onOpenChange={(o) => { if (!o) { setReschedFor(null); setReschedValue(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprogramar reunión</DialogTitle>
            <DialogDescription>
              {reschedFor?.company_name} — selecciona la nueva fecha y hora.
              {reschedFor?.gcal_event_id ? " El evento de Google Calendar se actualizará automáticamente." : ""}
            </DialogDescription>
          </DialogHeader>
          <Input
            type="datetime-local"
            value={reschedValue}
            onChange={(e) => setReschedValue(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setReschedFor(null); setReschedValue(""); }}>Cancelar</Button>
            <Button onClick={confirmReschedule} disabled={!reschedValue}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// helper: get Monday Date for an ISO week (local time)
function isoWeekMonday(year: number, week: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay() || 7;
  const monday = new Date(simple);
  monday.setDate(simple.getDate() - dow + 1);
  return monday;
}