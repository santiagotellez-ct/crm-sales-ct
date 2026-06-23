import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PipeOwnerType = "ae" | "sdr";

export interface PipeGoal {
  id: string;
  iso_year: number;
  iso_week: number;
  owner_type: PipeOwnerType;
  owner_name: string;
  goal: number;
}

export const DEFAULT_AE_PIPE_GOALS: Record<string, number> = {
  Majo: 140000,
  Santi: 140000,
  Nico: 100000,
  Toqui: 100000,
};

export const DEFAULT_SDR_PIPE_GOALS: Record<string, number> = {
  "César": 192000,
  Jissad: 96000,
  Juan: 96000,
  "Self AE": 96000,
};

export const PIPE_TEAM_WEEKLY_GOAL = 480000;

export function usePipeGoals(year: number, week: number) {
  const [goals, setGoals] = useState<PipeGoal[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("pipe_goals" as any)
      .select("*")
      .eq("iso_year", year)
      .eq("iso_week", week);
    setGoals(((data as any[]) ?? []).map((r) => ({
      id: r.id,
      iso_year: r.iso_year,
      iso_week: r.iso_week,
      owner_type: r.owner_type,
      owner_name: r.owner_name,
      goal: Number(r.goal),
    })));
  }, [year, week]);

  useEffect(() => { load(); }, [load]);

  const goalFor = useCallback(
    (owner_type: PipeOwnerType, owner_name: string): number => {
      const row = goals.find(
        (g) => g.owner_type === owner_type && g.owner_name === owner_name
      );
      if (row) return row.goal;
      const defs = owner_type === "ae" ? DEFAULT_AE_PIPE_GOALS : DEFAULT_SDR_PIPE_GOALS;
      return defs[owner_name] ?? 0;
    },
    [goals]
  );

  const setGoal = useCallback(
    async (owner_type: PipeOwnerType, owner_name: string, goal: number) => {
      const existing = goals.find(
        (g) => g.owner_type === owner_type && g.owner_name === owner_name
      );
      if (existing) {
        setGoals((prev) => prev.map((g) => (g.id === existing.id ? { ...g, goal } : g)));
        await supabase.from("pipe_goals" as any).update({ goal }).eq("id", existing.id);
      } else {
        const { data } = await supabase
          .from("pipe_goals" as any)
          .insert({ iso_year: year, iso_week: week, owner_type, owner_name, goal })
          .select()
          .single();
        if (data) {
          const r: any = data;
          setGoals((prev) => [...prev, {
            id: r.id, iso_year: r.iso_year, iso_week: r.iso_week,
            owner_type: r.owner_type, owner_name: r.owner_name, goal: Number(r.goal),
          }]);
        }
      }
    },
    [goals, year, week]
  );

  return { goalFor, setGoal };
}