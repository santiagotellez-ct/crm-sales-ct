import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Settings2, CalendarIcon, Download, CalendarRange, ChevronDown } from "lucide-react";
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { useDealsData } from "@/hooks/useDealsData";
import { Deal } from "@/types/deal";
import { DealCard } from "@/components/deals/DealCard";
import { DealDialog } from "@/components/deals/DealDialog";
import { DealDetailDrawer } from "@/components/deals/DealDetailDrawer";
import { StagesConfigDialog } from "@/components/deals/StagesConfigDialog";
import { NextTaskDialog } from "@/components/deals/NextTaskDialog";
import { CommitedFieldsDialog, CommitedFields } from "@/components/deals/CommitedFieldsDialog";
import { ExportDealsDialog } from "@/components/deals/ExportDealsDialog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AE_OPTIONS, AccountExecutive, SECONDARY_AE_OPTIONS, SecondaryAe } from "@/types/meeting";
import { toast } from "sonner";
import { QUARTERS, QuarterKey, dealInQuarter, getQuarter } from "@/lib/quarters";

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function StageColumn({
  id, name, probability, deals, onCardClick, requireTask,
}: {
  id: string; name: string; probability: number; deals: Deal[]; onCardClick: (d: Deal) => void; requireTask: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const total = deals.reduce((acc, d) => acc + d.value, 0);
  const weighted = (total * probability) / 100;
  return (
    <div
      ref={setNodeRef}
      className={`w-72 flex-shrink-0 rounded-lg border ${isOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"} flex flex-col`}
    >
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{name}</h3>
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{probability}%</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {deals.length} · {money(total)} · forecast {money(weighted)}
        </div>
      </div>
      <div className="p-2 space-y-2 flex-1 min-h-[120px]">
        {deals.map((d) => <DealCard key={d.id} deal={d} requireTask={requireTask} onClick={() => onCardClick(d)} />)}
      </div>
    </div>
  );
}

function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
  width = "w-[160px]",
  formatLabel = (v: T) => v,
}: {
  label: string;
  options: T[];
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
  width?: string;
  formatLabel?: (v: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.size === options.length && options.length > 0;
  const display = selected.size === 0 ? label : `${selected.size} seleccionados`;
  const toggle = (v: T) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };
  const toggleAll = () => onChange(allSelected ? new Set<T>() : new Set<T>(options));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 text-xs justify-between", width)}>
          {display}
          <ChevronDown className="h-3.5 w-3.5 ml-1.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-semibold">{label}</span>
          {options.length > 0 && (
            <button onClick={toggleAll} className="text-[10px] text-primary hover:underline">
              {allSelected ? "Ninguno" : "Todos"}
            </button>
          )}
        </div>
        <div className="mt-1 space-y-0.5 max-h-56 overflow-auto">
          {options.map((o) => (
            <label key={o} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
              <Checkbox checked={selected.has(o)} onCheckedChange={() => toggle(o)} />
              <span className="text-xs">{formatLabel(o)}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Deals() {
  const {
    stages, deals, forecast, createDeal, updateDeal, deleteDeal,
    addDealTask, toggleDealTask, updateDealTask, deleteDealTask, updateStage,
  } = useDealsData();

  const [createOpen, setCreateOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [detail, setDetail] = useState<Deal | null>(null);
  const [pendingMove, setPendingMove] = useState<{ deal: Deal; toStageId: string } | null>(null);
  const [pendingCommited, setPendingCommited] = useState<{ deal: Deal; toStageId: string } | null>(null);
  const [pendingNextTask, setPendingNextTask] = useState<{ deal: Deal; completedTitle: string } | null>(null);
  const [aeFilter, setAeFilter] = useState<Set<AccountExecutive>>(new Set());
  const [secondaryAeFilter, setSecondaryAeFilter] = useState<Set<SecondaryAe>>(new Set());
  const [qFilter, setQFilter] = useState<QuarterKey>("ALL");
  const [eventFilter, setEventFilter] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [createdDate, setCreatedDate] = useState<Date | undefined>(undefined);
  const [createdDir, setCreatedDir] = useState<"before" | "after" | "ALL">("ALL");
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(undefined);
  const [rangeTo, setRangeTo] = useState<Date | undefined>(undefined);
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filteredDeals = useMemo(() => {
    let arr = deals;
    if (aeFilter.size > 0 || secondaryAeFilter.size > 0) {
      arr = arr.filter((d) => {
        const primaryMatch = aeFilter.size === 0 || aeFilter.has(d.account_executive);
        const secondaryMatch = secondaryAeFilter.size === 0 || (d.secondary_ae && secondaryAeFilter.has(d.secondary_ae));
        if (d.account_executive === "Otro AE") return primaryMatch && secondaryMatch;
        return primaryMatch;
      });
    }
    if (eventFilter.size > 0) {
      arr = arr.filter((d) => {
        if (d.event && eventFilter.has(d.event)) return true;
        if (!d.event && eventFilter.has("__none")) return true;
        return false;
      });
    }
    if (qFilter !== "ALL") {
      const q = getQuarter(qFilter);
      arr = arr.filter((d) => dealInQuarter(d, q));
    }
    if (rangeFrom && rangeTo) {
      const from = rangeFrom.getTime();
      const to = rangeTo.getTime() + 86400000 - 1;
      arr = arr.filter((d) => d.created_at >= from && d.created_at <= to);
    } else if (createdDir !== "ALL" && createdDate) {
      const ts = createdDate.getTime();
      arr = arr.filter((d) =>
        createdDir === "before" ? d.created_at <= ts : d.created_at >= ts
      );
    }
    return arr;
  }, [deals, aeFilter, secondaryAeFilter, qFilter, eventFilter, createdDir, createdDate, rangeFrom, rangeTo]);

  const eventOptions = useMemo(() => {
    const set = new Set<string>();
    deals.forEach((d) => { if (d.event) set.add(d.event); });
    return Array.from(set).sort();
  }, [deals]);

  const closedStageIds = useMemo(
    () => new Set(stages.filter((s) => s.is_won || s.name === "Commited").map((s) => s.id)),
    [stages]
  );
  const openStageIds = useMemo(
    () => new Set(stages.filter((s) => !s.is_won && !s.is_lost && s.name !== "Commited").map((s) => s.id)),
    [stages]
  );

  const breakdown = useMemo(() => {
    const aes = aeFilter.size > 0 ? Array.from(aeFilter) : AE_OPTIONS;
    const q = qFilter === "ALL" ? null : getQuarter(qFilter);
    return aes.map((ae) => {
      let aeDeals = deals.filter((d) => d.account_executive === ae);
      if (ae === "Otro AE" && secondaryAeFilter.size > 0) {
        aeDeals = aeDeals.filter((d) => d.secondary_ae && secondaryAeFilter.has(d.secondary_ae));
      }
      if (q) aeDeals = aeDeals.filter((d) => dealInQuarter(d, q));
      if (eventFilter.size > 0) {
        aeDeals = aeDeals.filter((d) => {
          if (d.event && eventFilter.has(d.event)) return true;
          if (!d.event && eventFilter.has("__none")) return true;
          return false;
        });
      }
      const cerrado = aeDeals.filter((d) => closedStageIds.has(d.stage_id)).reduce((a, d) => a + d.value, 0);
      const openPipe = aeDeals.filter((d) => openStageIds.has(d.stage_id)).reduce((a, d) => a + d.value, 0);
      return { ae, cerrado, openPipe };
    });
  }, [deals, aeFilter, secondaryAeFilter, qFilter, eventFilter, closedStageIds, openStageIds]);

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    stages.forEach((s) => map.set(s.id, []));
    filteredDeals.forEach((d) => {
      const arr = map.get(d.stage_id) ?? [];
      arr.push(d);
      map.set(d.stage_id, arr);
    });
    return map;
  }, [stages, filteredDeals]);

  const handleDragEnd = async (e: DragEndEvent) => {
    if (!e.over) return;
    const dealId = e.active.id as string;
    const newStageId = e.over.id as string;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === newStageId) return;
    const newStage = stages.find((s) => s.id === newStageId);
    const missingCommitedFields =
      newStage?.name === "Commited" &&
      (!deal.paquete_vendido || !deal.sponsor_pain || !deal.sponsor_icp);
    if (missingCommitedFields) {
      setPendingCommited({ deal, toStageId: newStageId });
      return;
    }
    const openTasks = deal.tasks.filter((t) => !t.completed);
    if (openTasks.length === 0 && !newStage?.is_won && !newStage?.is_lost) {
      setPendingMove({ deal, toStageId: newStageId });
      return;
    }
    await updateDeal(dealId, { stage_id: newStageId });
    toast.success(`Deal movido a ${newStage?.name}`);
  };

  const liveDetail = detail ? deals.find((d) => d.id === detail.id) ?? null : null;

  const handleToggleTaskWithPrompt = async (taskId: string, completed: boolean) => {
    await toggleDealTask(taskId, completed);
    if (!completed || !liveDetail) return;
    const t = liveDetail.tasks.find((x) => x.id === taskId);
    if (!t) return;
    const stillOpen = liveDetail.tasks.some((x) => x.id !== taskId && !x.completed);
    const currentStage = stages.find((s) => s.id === liveDetail.stage_id);
    if (stillOpen || currentStage?.is_won || currentStage?.is_lost) return;
    setPendingNextTask({ deal: liveDetail, completedTitle: t.title });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Pipeline
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Deals</h1>
              <p className="text-sm text-muted-foreground">
                {deals.length} deals · Forecast {money(forecast.total)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MultiSelectFilter<AccountExecutive>
              label="Filtrar por AE"
              options={AE_OPTIONS}
              selected={aeFilter}
              onChange={setAeFilter}
              width="w-[150px]"
            />
            <MultiSelectFilter<SecondaryAe>
              label="Sub-AE"
              options={SECONDARY_AE_OPTIONS}
              selected={secondaryAeFilter}
              onChange={setSecondaryAeFilter}
              width="w-[140px]"
            />
            <MultiSelectFilter<string>
              label="Evento"
              options={["__none", ...eventOptions]}
              selected={eventFilter}
              onChange={setEventFilter}
              width="w-[150px]"
              formatLabel={(v) => v === "__none" ? "Sin evento" : v}
            />
            {(() => {
              const hasFilter =
                qFilter !== "ALL" ||
                (createdDir !== "ALL" && !!createdDate) ||
                (!!rangeFrom && !!rangeTo);
              const label = qFilter !== "ALL"
                ? QUARTERS.find((q) => q.key === qFilter)?.label ?? "Filtro de fecha"
                : rangeFrom && rangeTo
                ? `${format(rangeFrom, "dd/MM/yy")} → ${format(rangeTo, "dd/MM/yy")}`
                : createdDir !== "ALL" && createdDate
                ? `${createdDir === "before" ? "Antes de" : "Después de"} ${format(createdDate, "dd/MM/yy")}`
                : "Filtro de fecha";
              const clearAll = () => {
                setQFilter("ALL");
                setCreatedDir("ALL");
                setCreatedDate(undefined);
                setRangeFrom(undefined);
                setRangeTo(undefined);
              };
              return (
                <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={hasFilter ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs"
                    >
                      <CalendarRange className="h-3.5 w-3.5 mr-1.5" />
                      {label}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[340px] p-3 space-y-3">
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Por Quarter</Label>
                      <Select
                        value={qFilter}
                        onValueChange={(v) => {
                          setQFilter(v as QuarterKey);
                          if (v !== "ALL") {
                            setCreatedDir("ALL");
                            setCreatedDate(undefined);
                            setRangeFrom(undefined);
                            setRangeTo(undefined);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Quarter" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Todos los Q</SelectItem>
                          {QUARTERS.map((q) => <SelectItem key={q.key} value={q.key}>{q.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="border-t border-border pt-3">
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Rango personalizado</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("h-8 text-xs justify-start font-normal", !rangeFrom && "text-muted-foreground")}>
                              <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                              {rangeFrom ? format(rangeFrom, "dd/MM/yy") : "Desde"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={rangeFrom} onSelect={(d) => { setRangeFrom(d); setQFilter("ALL"); setCreatedDir("ALL"); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("h-8 text-xs justify-start font-normal", !rangeTo && "text-muted-foreground")}>
                              <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                              {rangeTo ? format(rangeTo, "dd/MM/yy") : "Hasta"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={rangeTo} onSelect={(d) => { setRangeTo(d); setQFilter("ALL"); setCreatedDir("ALL"); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="border-t border-border pt-3">
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Antes / Después de</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <Select
                          value={createdDir}
                          onValueChange={(v) => {
                            setCreatedDir(v as "before" | "after" | "ALL");
                            if (v !== "ALL") { setQFilter("ALL"); setRangeFrom(undefined); setRangeTo(undefined); }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">—</SelectItem>
                            <SelectItem value="before">Antes de</SelectItem>
                            <SelectItem value="after">Después de</SelectItem>
                          </SelectContent>
                        </Select>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={createdDir === "ALL"}
                              className={cn("h-8 text-xs justify-start font-normal", !createdDate && "text-muted-foreground")}
                            >
                              <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                              {createdDate ? format(createdDate, "dd/MM/yy") : "Fecha"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={createdDate} onSelect={setCreatedDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearAll}>Limpiar</Button>
                      <Button size="sm" className="h-8 text-xs" onClick={() => setDateFilterOpen(false)}>Aplicar</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })()}
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Stages
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo deal
            </Button>
          </div>
        </div>
        <div className="max-w-[1600px] mx-auto px-6 pb-3 flex flex-wrap gap-2">
          {breakdown.map((b) => (
            <div
              key={b.ae}
              className="text-xs px-2.5 py-1.5 rounded-md bg-muted text-foreground flex items-center gap-2"
            >
              <span className="font-semibold">{b.ae}</span>
              <span className="text-score-high">
                Cerrado <span className="font-semibold">{money(b.cerrado)}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-primary">
                Open Pipe <span className="font-semibold">{money(b.openPipe)}</span>
              </span>
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-5 overflow-x-auto">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 min-w-min">
            {stages.map((s) => (
              <StageColumn
                key={s.id}
                id={s.id}
                name={s.name}
                probability={s.probability}
                deals={dealsByStage.get(s.id) ?? []}
                onCardClick={setDetail}
                requireTask={!s.is_won}
              />
            ))}
          </div>
        </DndContext>
      </main>

      <DealDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={async (input, name) => {
          await createDeal(input, name);
          toast.success("Deal creado");
        }}
      />

      <StagesConfigDialog
        open={configOpen}
        stages={stages}
        onOpenChange={setConfigOpen}
        onSave={async (updates) => {
          for (const u of updates) await updateStage(u.id, { name: u.name, probability: u.probability });
          toast.success("Stages actualizados");
        }}
      />

      {liveDetail && (
        <DealDetailDrawer
          deal={liveDetail}
          stages={stages}
          onClose={() => setDetail(null)}
          onUpdate={updateDeal}
          onAddTask={addDealTask}
          onToggleTask={handleToggleTaskWithPrompt}
          onUpdateTask={updateDealTask}
          onDeleteTask={deleteDealTask}
          onDelete={deleteDeal}
        />
      )}

      <NextTaskDialog
        open={!!pendingMove}
        reason={`Mover "${pendingMove?.deal.company_name}" a "${stages.find((s) => s.id === pendingMove?.toStageId)?.name}" requiere una siguiente tarea.`}
        onOpenChange={(o) => { if (!o) setPendingMove(null); }}
        onConfirm={async (title, dueAt) => {
          if (!pendingMove) return;
          await addDealTask(pendingMove.deal.id, title, dueAt, pendingMove.deal.account_executive);
          await updateDeal(pendingMove.deal.id, { stage_id: pendingMove.toStageId });
          toast.success("Deal movido y tarea creada");
          setPendingMove(null);
        }}
      />

      <NextTaskDialog
        open={!!pendingNextTask}
        reason={`Completaste "${pendingNextTask?.completedTitle}" en ${pendingNextTask?.deal.company_name}. Define la siguiente acción.`}
        onOpenChange={(o) => { if (!o) setPendingNextTask(null); }}
        onConfirm={async (title, dueAt) => {
          if (!pendingNextTask) return;
          await addDealTask(pendingNextTask.deal.id, title, dueAt, pendingNextTask.deal.account_executive);
          toast.success("Siguiente tarea creada");
          setPendingNextTask(null);
        }}
      />

      <CommitedFieldsDialog
        open={!!pendingCommited}
        companyName={pendingCommited?.deal.company_name ?? ""}
        eventName={pendingCommited?.deal.event ?? null}
        initial={pendingCommited ? {
          paquete_vendido: pendingCommited.deal.paquete_vendido ?? "",
          adicionales_paquete: pendingCommited.deal.adicionales_paquete ?? "",
          sponsor_pain: pendingCommited.deal.sponsor_pain ?? "",
          sponsor_icp: pendingCommited.deal.sponsor_icp ?? "",
          commit_speaking_main: pendingCommited.deal.commit_speaking_main,
          commit_speaking_second: pendingCommited.deal.commit_speaking_second,
          commit_workshop: pendingCommited.deal.commit_workshop,
          commit_stand: pendingCommited.deal.commit_stand,
          commit_experience_id: pendingCommited.deal.commit_experience_id,
        } : undefined}
        onOpenChange={(o) => { if (!o) setPendingCommited(null); }}
        onConfirm={async (fields: CommitedFields) => {
          if (!pendingCommited) return;
          const { deal, toStageId } = pendingCommited;
          await updateDeal(deal.id, { ...fields });
          // Notify handoff channel in Slack with the commit summary
          supabase.functions.invoke("send-commit-handoff", { body: { deal_id: deal.id } })
            .catch((err) => console.error("send-commit-handoff failed", err));
          const openTasks = deal.tasks.filter((t) => !t.completed);
          if (openTasks.length === 0) {
            setPendingCommited(null);
            setPendingMove({ deal: { ...deal, ...fields }, toStageId });
            return;
          }
          await updateDeal(deal.id, { stage_id: toStageId });
          toast.success("Deal movido a Commited");
          setPendingCommited(null);
        }}
      />

      <ExportDealsDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        deals={filteredDeals}
        stages={stages}
      />
    </div>
  );
}