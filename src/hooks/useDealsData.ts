import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Deal, DealInput, DealStage, DealTask } from "@/types/deal";
import { AccountExecutive, SecondaryAe } from "@/types/meeting";
import { Sdr } from "@/types/company";

// Supabase typegen lags new tables; cast through any.
const db = supabase as unknown as {
  from: (t: string) => any;
  channel: (n: string) => any;
  removeChannel: (c: any) => void;
};

function mapStage(r: any): DealStage {
  return {
    id: r.id,
    name: r.name,
    order: r.order,
    probability: r.probability,
    is_won: r.is_won,
    is_lost: r.is_lost,
  };
}

function mapTask(r: any): DealTask {
  return {
    id: r.id,
    deal_id: r.deal_id,
    title: r.title,
    due_at: new Date(r.due_at).getTime(),
    assignee: (r.assignee as AccountExecutive) ?? null,
    completed: !!r.completed,
    created_at: new Date(r.created_at).getTime(),
  };
}

function mapDeal(r: any, contactIds: string[], tasks: DealTask[], stageEnteredAt: number): Deal {
  return {
    id: r.id,
    name: r.name ?? r.company_name ?? "",
    company_id: r.company_id,
    company_name: r.company_name,
    stage_id: r.stage_id,
    account_executive: r.account_executive as AccountExecutive,
    secondary_ae: (r.secondary_ae as SecondaryAe) ?? null,
    sdr: (r.sdr as Sdr) ?? null,
    value: Number(r.value ?? 0),
    currency: r.currency ?? "USD",
    event: r.event ?? null,
    expected_close_date: r.expected_close_date ?? null,
    billing_date: r.billing_date ?? null,
    collection_date: r.collection_date ?? null,
    notes: r.notes ?? "",
    meeting_id: r.meeting_id ?? null,
    lost_reason: r.lost_reason ?? null,
    paquete_vendido: r.paquete_vendido ?? null,
    adicionales_paquete: r.adicionales_paquete ?? null,
    sponsor_pain: r.sponsor_pain ?? null,
    sponsor_icp: r.sponsor_icp ?? null,
    commit_speaking_main: !!r.commit_speaking_main,
    commit_speaking_second: !!r.commit_speaking_second,
    commit_workshop: !!r.commit_workshop,
    commit_stand: !!r.commit_stand,
    commit_experience_id: r.commit_experience_id ?? null,
    won_at: r.won_at ?? null,
    checklist: (r.checklist as Deal["checklist"]) ?? {},
    contact_ids: contactIds,
    created_at: new Date(r.created_at).getTime(),
    stage_entered_at: stageEnteredAt,
    tasks,
    updated_at: r.updated_at ? new Date(r.updated_at).getTime() : new Date(r.created_at).getTime(),
  };
}

export function useDealsData() {
  const [stages, setStages] = useState<DealStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [stagesRes, dealsRes, dcRes, dtRes, dshRes] = await Promise.all([
      db.from("deal_stages").select("*").order("order", { ascending: true }),
      db.from("deals").select("*").order("created_at", { ascending: false }),
      db.from("deal_contacts").select("*"),
      db.from("deal_tasks").select("*").order("due_at", { ascending: true }),
      db.from("deal_stage_history").select("*"),
    ]);
    const contactsByDeal = new Map<string, string[]>();
    (dcRes.data ?? []).forEach((r: any) => {
      const arr = contactsByDeal.get(r.deal_id) ?? [];
      arr.push(r.contact_id);
      contactsByDeal.set(r.deal_id, arr);
    });
    const tasksByDeal = new Map<string, DealTask[]>();
    (dtRes.data ?? []).forEach((r: any) => {
      const t = mapTask(r);
      const arr = tasksByDeal.get(t.deal_id) ?? [];
      arr.push(t);
      tasksByDeal.set(t.deal_id, arr);
    });
    const historyByDeal = new Map<string, { stage_id: string; entered_at: string }[]>();
    (dshRes.data ?? []).forEach((r: any) => {
      const arr = historyByDeal.get(r.deal_id) ?? [];
      arr.push({ stage_id: r.stage_id, entered_at: r.entered_at });
      historyByDeal.set(r.deal_id, arr);
    });
    setStages((stagesRes.data ?? []).map(mapStage));
    setDeals(
      (dealsRes.data ?? []).map((r: any) => {
        const matches = (historyByDeal.get(r.id) ?? []).filter((h) => h.stage_id === r.stage_id);
        const stageEnteredAt = matches.length > 0
          ? Math.max(...matches.map((h) => new Date(h.entered_at).getTime()))
          : new Date(r.created_at).getTime();
        return mapDeal(r, contactsByDeal.get(r.id) ?? [], tasksByDeal.get(r.id) ?? [], stageEnteredAt);
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const ch = db
      .channel(`deals-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_stages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_tasks" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_contacts" }, refresh)
      .subscribe();
    return () => db.removeChannel(ch);
  }, [refresh]);

  const createDeal = useCallback(
    async (input: DealInput, companyName: string): Promise<Deal | null> => {
      const stageId =
        input.stage_id ?? stages.find((s) => s.order === 1)?.id ?? stages[0]?.id;
      if (!stageId) return null;
      const { data: dealRow, error } = await db
        .from("deals")
        .insert({
          company_id: input.company_id,
          company_name: companyName,
          name: input.name,
          stage_id: stageId,
          account_executive: input.account_executive,
          secondary_ae: input.secondary_ae ?? null,
          sdr: input.sdr ?? null,
          value: input.value,
          currency: input.currency ?? "USD",
          event: input.event ?? null,
          expected_close_date: input.expected_close_date ?? null,
          billing_date: input.billing_date ?? null,
          collection_date: input.collection_date ?? null,
          notes: input.notes ?? "",
          meeting_id: input.meeting_id ?? null,
        })
        .select()
        .single();
      if (error || !dealRow) {
        console.error(error);
        return null;
      }
      const dealId = dealRow.id as string;
      if (input.contact_ids.length > 0) {
        await db
          .from("deal_contacts")
          .insert(input.contact_ids.map((cid) => ({ deal_id: dealId, contact_id: cid })));
      }
      await db.from("deal_tasks").insert({
        deal_id: dealId,
        title: input.firstTask.title,
        due_at: new Date(input.firstTask.due_at).toISOString(),
        assignee: input.firstTask.assignee,
        completed: false,
      });
      await refresh();
      return mapDeal(dealRow, input.contact_ids, [], new Date(dealRow.created_at).getTime());
    },
    [stages, refresh]
  );

  const updateDeal = useCallback(
    async (id: string, patch: Partial<Deal>) => {
      const dbPatch: Record<string, unknown> = {};
      const allowed: (keyof Deal)[] = [
        "name",
        "stage_id",
        "account_executive",
        "secondary_ae",
        "sdr",
        "value",
        "currency",
        "event",
        "company_name",
        "expected_close_date",
        "billing_date",
        "collection_date",
        "notes",
        "lost_reason",
        "paquete_vendido",
        "adicionales_paquete",
        "sponsor_pain",
        "sponsor_icp",
        "checklist",
        "commit_speaking_main",
        "commit_speaking_second",
        "commit_workshop",
        "commit_stand",
        "commit_experience_id",
      ];
      allowed.forEach((k) => {
        if (k in patch) dbPatch[k] = patch[k] as unknown;
      });
      if ("created_at" in patch && typeof patch.created_at === "number") {
        dbPatch.created_at = new Date(patch.created_at).toISOString();
      }
      setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
      await db.from("deals").update(dbPatch).eq("id", id);
    },
    []
  );

  const deleteDeal = useCallback(async (id: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== id));
    await db.from("deals").delete().eq("id", id);
  }, []);

  const addDealTask = useCallback(
    async (dealId: string, title: string, dueAt: number, assignee: AccountExecutive | null) => {
      await db.from("deal_tasks").insert({
        deal_id: dealId,
        title,
        due_at: new Date(dueAt).toISOString(),
        assignee,
        completed: false,
      });
      await refresh();
    },
    [refresh]
  );

  const toggleDealTask = useCallback(async (taskId: string, completed: boolean) => {
    setDeals((prev) =>
      prev.map((d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)),
      }))
    );
    await db.from("deal_tasks").update({ completed }).eq("id", taskId);
  }, []);

  const updateDealTask = useCallback(
    async (taskId: string, patch: { title?: string; due_at?: number; assignee?: AccountExecutive | null }) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.title !== undefined) dbPatch.title = patch.title;
      if (patch.due_at !== undefined) dbPatch.due_at = new Date(patch.due_at).toISOString();
      if (patch.assignee !== undefined) dbPatch.assignee = patch.assignee;
      setDeals((prev) =>
        prev.map((d) => ({
          ...d,
          tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
        }))
      );
      await db.from("deal_tasks").update(dbPatch).eq("id", taskId);
    },
    []
  );

  const deleteDealTask = useCallback(async (taskId: string) => {
    setDeals((prev) =>
      prev.map((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== taskId) }))
    );
    await db.from("deal_tasks").delete().eq("id", taskId);
  }, []);

  const setDealContacts = useCallback(
    async (dealId: string, contactIds: string[]) => {
      await db.from("deal_contacts").delete().eq("deal_id", dealId);
      if (contactIds.length > 0) {
        await db
          .from("deal_contacts")
          .insert(contactIds.map((cid) => ({ deal_id: dealId, contact_id: cid })));
      }
      await refresh();
    },
    [refresh]
  );

  const updateStage = useCallback(
    async (id: string, patch: Partial<DealStage>) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.probability !== undefined) dbPatch.probability = patch.probability;
      if (patch.order !== undefined) dbPatch.order = patch.order;
      setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      await db.from("deal_stages").update(dbPatch).eq("id", id);
    },
    []
  );

  const allDealTasks = useMemo(() => deals.flatMap((d) => d.tasks.map((t) => ({ ...t, deal: d }))), [deals]);

  const forecast = useMemo(() => {
    const stageMap = new Map(stages.map((s) => [s.id, s]));
    let total = 0;
    const byAe: Record<string, number> = {};
    for (const d of deals) {
      const s = stageMap.get(d.stage_id);
      if (!s || s.is_lost) continue;
      const w = (d.value * s.probability) / 100;
      total += w;
      byAe[d.account_executive] = (byAe[d.account_executive] ?? 0) + w;
    }
    return { total, byAe };
  }, [stages, deals]);

  return {
    loading,
    stages,
    deals,
    allDealTasks,
    forecast,
    createDeal,
    updateDeal,
    deleteDeal,
    addDealTask,
    toggleDealTask,
    updateDealTask,
    deleteDealTask,
    setDealContacts,
    updateStage,
    refresh,
  };
}