import { useCallback, useEffect, useState, createContext, useContext, ReactNode, createElement } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as {
  from: (t: string) => any;
  channel: (n: string) => any;
  removeChannel: (c: any) => void;
};

export interface EventRecord {
  id: string;
  name: string;
  slots_main_stage: number;
  slots_second_stage: number;
  slots_workshop: number;
  slots_stand: number;
}

export interface EventExperience {
  id: string;
  event_id: string;
  name: string;
  total_slots: number;
}

function useEventsDataInternal() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [experiences, setExperiences] = useState<EventExperience[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [evRes, expRes] = await Promise.all([
      db.from("events").select("*").order("name", { ascending: true }),
      db.from("event_experiences").select("*").order("name", { ascending: true }),
    ]);
    setEvents((evRes.data ?? []) as EventRecord[]);
    setExperiences((expRes.data ?? []) as EventExperience[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const ch = db
      .channel(`events-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_experiences" }, refresh)
      .subscribe();
    return () => db.removeChannel(ch);
  }, [refresh]);

  const createEvent = useCallback(async (name: string) => {
    await db.from("events").insert({ name });
    await refresh();
  }, [refresh]);

  const updateEvent = useCallback(async (id: string, patch: Partial<EventRecord>) => {
    const dbPatch: Record<string, unknown> = {};
    (["name", "slots_main_stage", "slots_second_stage", "slots_workshop", "slots_stand"] as const).forEach((k) => {
      if (k in patch) dbPatch[k] = (patch as any)[k];
    });
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    await db.from("events").update(dbPatch).eq("id", id);
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    await db.from("events").delete().eq("id", id);
  }, []);

  const createExperience = useCallback(async (event_id: string, name: string, total_slots: number) => {
    await db.from("event_experiences").insert({ event_id, name, total_slots });
    await refresh();
  }, [refresh]);

  const updateExperience = useCallback(async (id: string, patch: Partial<EventExperience>) => {
    const dbPatch: Record<string, unknown> = {};
    (["name", "total_slots"] as const).forEach((k) => { if (k in patch) dbPatch[k] = (patch as any)[k]; });
    setExperiences((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    await db.from("event_experiences").update(dbPatch).eq("id", id);
  }, []);

  const deleteExperience = useCallback(async (id: string) => {
    setExperiences((prev) => prev.filter((e) => e.id !== id));
    await db.from("event_experiences").delete().eq("id", id);
  }, []);

  return {
    loading, events, experiences,
    createEvent, updateEvent, deleteEvent,
    createExperience, updateExperience, deleteExperience,
    refresh,
  };
}

type Ctx = ReturnType<typeof useEventsDataInternal>;
const EventsDataContext = createContext<Ctx | null>(null);

export function EventsDataProvider({ children }: { children: ReactNode }) {
  const value = useEventsDataInternal();
  return createElement(EventsDataContext.Provider, { value }, children);
}

export function useEventsData() {
  const ctx = useContext(EventsDataContext);
  if (!ctx) throw new Error("useEventsData must be used within EventsDataProvider");
  return ctx;
}