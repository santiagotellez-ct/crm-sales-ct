import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TeamMemberRole = "sdr" | "ae" | "secondary_ae";

export interface TeamMember {
  id: string;
  name: string;
  role: TeamMemberRole;
  email: string | null;
  is_active: boolean;
  display_order: number;
  pipe_goal: number;
  meeting_goal: number;
  created_at: string;
}

const QUERY_KEY = ["team_members"] as const;

export function useTeamMembers() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as TeamMember[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useTeamMemberNames() {
  const { data = [], isLoading } = useTeamMembers();
  const active = data.filter((m) => m.is_active);
  return {
    sdrNames: active.filter((m) => m.role === "sdr").map((m) => m.name),
    aeNames: active.filter((m) => m.role === "ae").map((m) => m.name),
    secondaryAeNames: active.filter((m) => m.role === "secondary_ae").map((m) => m.name),
    isLoading,
  };
}

export function useAddTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (member: { name: string; role: TeamMemberRole; email?: string }) => {
      const { error } = await supabase.from("team_members").insert({
        name: member.name.trim(),
        role: member.role,
        email: member.email ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useToggleTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("team_members")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateTeamMemberGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      pipe_goal,
      meeting_goal,
    }: {
      id: string;
      pipe_goal?: number;
      meeting_goal?: number;
    }) => {
      const patch: Record<string, number> = {};
      if (pipe_goal !== undefined) patch.pipe_goal = pipe_goal;
      if (meeting_goal !== undefined) patch.meeting_goal = meeting_goal;
      const { error } = await supabase.from("team_members").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// ─── AE Quarterly Targets ───────────────────────────────────────────────────

const AE_TARGETS_KEY = ["ae_targets"] as const;

export interface AeTarget {
  ae_name: string;
  quarter_key: string;
  target: number;
}

export function useAeTargets() {
  return useQuery({
    queryKey: AE_TARGETS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("ae_targets").select("*");
      if (error) throw error;
      return data as AeTarget[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useSetAeTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ae_name, quarter_key, target }: AeTarget) => {
      const { error } = await supabase
        .from("ae_targets")
        .upsert({ ae_name, quarter_key, target, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: AE_TARGETS_KEY }),
  });
}
