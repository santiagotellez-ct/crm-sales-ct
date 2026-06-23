import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SdrMeetingGoal {
  id: string;
  iso_year: number;
  iso_week: number;
  sdr: string;
  goal: number;
}

export const DEFAULT_SDR_MEETING_GOALS: Record<string, number> = {
  "César": 24,
  Jissad: 12,
  Juan: 12,
  "Self AE": 12,
};

export function useSdrMeetingGoals(year: number, week: number) {
  const [goals, setGoals] = useState<SdrMeetingGoal[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("sdr_meeting_goals" as any)
      .select("*")
      .eq("iso_year", year)
      .eq("iso_week", week);
    setGoals(((data as any[]) ?? []).map((r) => ({
      id: r.id, iso_year: r.iso_year, iso_week: r.iso_week, sdr: r.sdr, goal: Number(r.goal),
    })));
  }, [year, week]);

  useEffect(() => { load(); }, [load]);

  const goalFor = useCallback((sdr: string): number => {
    const row = goals.find((g) => g.sdr === sdr);
    if (row) return row.goal;
    return DEFAULT_SDR_MEETING_GOALS[sdr] ?? 0;
  }, [goals]);

  const setGoal = useCallback(async (sdr: string, goal: number) => {
    const existing = goals.find((g) => g.sdr === sdr);
    if (existing) {
      setGoals((prev) => prev.map((g) => (g.id === existing.id ? { ...g, goal } : g)));
      await supabase.from("sdr_meeting_goals" as any).update({ goal }).eq("id", existing.id);
    } else {
      const { data } = await supabase
        .from("sdr_meeting_goals" as any)
        .insert({ iso_year: year, iso_week: week, sdr, goal })
        .select()
        .single();
      if (data) {
        const r: any = data;
        setGoals((prev) => [...prev, {
          id: r.id, iso_year: r.iso_year, iso_week: r.iso_week, sdr: r.sdr, goal: Number(r.goal),
        }]);
      }
    }
  }, [goals, year, week]);

  return { goalFor, setGoal };
}