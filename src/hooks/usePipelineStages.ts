import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_OPTIONS, STATUS_LABELS, CompanyStatus } from "@/types/company";

export type PipelineKind = "sdr" | "ae";

export interface PipelineStage {
  id: string;
  pipeline: PipelineKind;
  key: string;
  label: string;
  kind: "main" | "special" | "exit";
  sort_order: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
  is_active: boolean;
}

/** Fallback when pipeline_stages is empty or the query fails — never blank the kanban. */
function fallbackSdrStages(): PipelineStage[] {
  return STATUS_OPTIONS.map((key, i) => ({
    id: `fallback-${key}`,
    pipeline: "sdr" as const,
    key,
    label: STATUS_LABELS[key],
    kind: (["reagendar"].includes(key)
      ? "special"
      : ["no_answer", "no_interesado", "unqualified", "unqualified_post_meeting"].includes(key)
        ? "exit"
        : "main") as PipelineStage["kind"],
    sort_order: i + 1,
    probability: 0,
    is_won: false,
    is_lost: false,
    is_active: true,
  }));
}

/**
 * Dual-read: prefer DB catalog, fall back to STATUS_OPTIONS.
 * Kanban Board still uses hardcoded KANBAN_COLUMNS until cutover — this hook
 * is for future consumers and admin prep.
 */
export function usePipelineStages(pipeline: PipelineKind, opts?: { activeOnly?: boolean }) {
  const activeOnly = opts?.activeOnly ?? true;

  const query = useQuery({
    queryKey: ["pipeline_stages", pipeline, activeOnly],
    queryFn: async () => {
      let q = supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline", pipeline)
        .order("sort_order");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PipelineStage[];
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const fromDb = query.data ?? [];
  const stages =
    query.isError || fromDb.length === 0
      ? pipeline === "sdr"
        ? fallbackSdrStages()
        : fromDb
      : fromDb;

  return {
    stages,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    source: (query.isError || fromDb.length === 0 ? "fallback" : "db") as "fallback" | "db",
  };
}

/** Active SDR stage keys — safe for selects; never empty. */
export function useSdrStatusOptions(): CompanyStatus[] {
  const { stages, source } = usePipelineStages("sdr", { activeOnly: true });
  if (source === "fallback") return STATUS_OPTIONS;
  const keys = stages.map((s) => s.key).filter((k): k is CompanyStatus =>
    (STATUS_OPTIONS as string[]).includes(k),
  );
  return keys.length > 0 ? keys : STATUS_OPTIONS;
}
