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
