export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          company_id: string
          company_name: string
          contact_name: string | null
          created_at: string
          from_status: string | null
          id: string
          sdr: string | null
          sequence_id: string | null
          to_status: string | null
          type: string
        }
        Insert: {
          company_id: string
          company_name: string
          contact_name?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          sdr?: string | null
          sequence_id?: string | null
          to_status?: string | null
          type: string
        }
        Update: {
          company_id?: string
          company_name?: string
          contact_name?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          sdr?: string | null
          sequence_id?: string | null
          to_status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "prospection_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          amigos: boolean
          angle: string
          archived_at: string | null
          company_name: string
          country: string
          created_at: string
          domain: string
          experiencia_target: string | null
          icp_fit: string
          id: string
          industry: string
          linkedin_url: string
          notes: string
          reasoning: string
          reviewed: boolean
          sdr: string | null
          size: string
          source: string | null
          status: string
          status_entered_at: string | null
          unqualified_reason: string | null
          updated_at: string
        }
        Insert: {
          amigos?: boolean
          angle?: string
          archived_at?: string | null
          company_name: string
          country?: string
          created_at?: string
          domain?: string
          experiencia_target?: string | null
          icp_fit?: string
          id?: string
          industry?: string
          linkedin_url?: string
          notes?: string
          reasoning?: string
          reviewed?: boolean
          sdr?: string | null
          size?: string
          source?: string | null
          status?: string
          status_entered_at?: string | null
          unqualified_reason?: string | null
          updated_at?: string
        }
        Update: {
          amigos?: boolean
          angle?: string
          archived_at?: string | null
          company_name?: string
          country?: string
          created_at?: string
          domain?: string
          experiencia_target?: string | null
          icp_fit?: string
          id?: string
          industry?: string
          linkedin_url?: string
          notes?: string
          reasoning?: string
          reviewed?: boolean
          sdr?: string | null
          size?: string
          source?: string | null
          status?: string
          status_entered_at?: string | null
          unqualified_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          archived_at: string | null
          company_id: string
          contacted_from: string[] | null
          created_at: string
          email: string | null
          id: string
          linkedin: string
          name: string
          notes: string
          phone: string | null
          role: string
          sdr: string | null
          status: string | null
          status_entered_at: string | null
        }
        Insert: {
          archived_at?: string | null
          company_id: string
          contacted_from?: string[] | null
          created_at?: string
          email?: string | null
          id?: string
          linkedin: string
          name: string
          notes?: string
          phone?: string | null
          role?: string
          sdr?: string | null
          status?: string | null
          status_entered_at?: string | null
        }
        Update: {
          archived_at?: string | null
          company_id?: string
          contacted_from?: string[] | null
          created_at?: string
          email?: string | null
          id?: string
          linkedin?: string
          name?: string
          notes?: string
          phone?: string | null
          role?: string
          sdr?: string | null
          status?: string | null
          status_entered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_contacts: {
        Row: {
          contact_id: string
          created_at: string
          deal_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          deal_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_memory: {
        Row: {
          action_items: string | null
          company_name: string
          created_at: string | null
          deal_id: string | null
          id: string
          meeting_id: string | null
          summary: string | null
          transcript: string | null
          updated_at: string | null
        }
        Insert: {
          action_items?: string | null
          company_name: string
          created_at?: string | null
          deal_id?: string | null
          id?: string
          meeting_id?: string | null
          summary?: string | null
          transcript?: string | null
          updated_at?: string | null
        }
        Update: {
          action_items?: string | null
          company_name?: string
          created_at?: string | null
          deal_id?: string | null
          id?: string
          meeting_id?: string | null
          summary?: string | null
          transcript?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_memory_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          created_at: string
          deal_id: string
          entered_at: string
          id: string
          stage_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          entered_at?: string
          id?: string
          stage_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          entered_at?: string
          id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          order: number
          probability: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          order: number
          probability?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          order?: number
          probability?: number
          updated_at?: string
        }
        Relationships: []
      }
      deal_tasks: {
        Row: {
          assignee: string | null
          completed: boolean
          created_at: string
          deal_id: string
          due_at: string
          id: string
          title: string
        }
        Insert: {
          assignee?: string | null
          completed?: boolean
          created_at?: string
          deal_id: string
          due_at: string
          id?: string
          title: string
        }
        Update: {
          assignee?: string | null
          completed?: boolean
          created_at?: string
          deal_id?: string
          due_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_touchpoints: {
        Row: {
          body: string | null
          canal: string | null
          created_by: string | null
          deal_id: string | null
          gmail_draft_id: string | null
          id: string
          sent_at: string | null
          subject: string | null
          tipo: string | null
        }
        Insert: {
          body?: string | null
          canal?: string | null
          created_by?: string | null
          deal_id?: string | null
          gmail_draft_id?: string | null
          id?: string
          sent_at?: string | null
          subject?: string | null
          tipo?: string | null
        }
        Update: {
          body?: string | null
          canal?: string | null
          created_by?: string | null
          deal_id?: string | null
          gmail_draft_id?: string | null
          id?: string
          sent_at?: string | null
          subject?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_touchpoints_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          account_executive: string
          adicionales_paquete: string | null
          billing_date: string | null
          checklist: Json
          collection_date: string | null
          commit_experience_id: string | null
          commit_speaking_main: boolean
          commit_speaking_second: boolean
          commit_stand: boolean
          commit_workshop: boolean
          company_id: string
          company_name: string
          created_at: string
          currency: string
          event: string | null
          expected_close_date: string | null
          id: string
          lost_reason: string | null
          meeting_id: string | null
          name: string
          notes: string
          paquete_vendido: string | null
          sdr: string | null
          secondary_ae: string | null
          sponsor_icp: string | null
          sponsor_pain: string | null
          stage_id: string
          circleback_url: string | null
          contact_role: string | null
          updated_at: string
          value: number
        }
        Insert: {
          account_executive: string
          adicionales_paquete?: string | null
          billing_date?: string | null
          checklist?: Json
          collection_date?: string | null
          commit_experience_id?: string | null
          commit_speaking_main?: boolean
          commit_speaking_second?: boolean
          commit_stand?: boolean
          commit_workshop?: boolean
          company_id: string
          company_name: string
          created_at?: string
          currency?: string
          event?: string | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          meeting_id?: string | null
          name?: string
          notes?: string
          paquete_vendido?: string | null
          sdr?: string | null
          secondary_ae?: string | null
          sponsor_icp?: string | null
          sponsor_pain?: string | null
          stage_id: string
          circleback_url?: string | null
          contact_role?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          account_executive?: string
          adicionales_paquete?: string | null
          billing_date?: string | null
          checklist?: Json
          collection_date?: string | null
          commit_experience_id?: string | null
          commit_speaking_main?: boolean
          commit_speaking_second?: boolean
          commit_stand?: boolean
          commit_workshop?: boolean
          company_id?: string
          company_name?: string
          created_at?: string
          currency?: string
          event?: string | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          meeting_id?: string | null
          name?: string
          notes?: string
          paquete_vendido?: string | null
          sdr?: string | null
          secondary_ae?: string | null
          sponsor_icp?: string | null
          sponsor_pain?: string | null
          stage_id?: string
          circleback_url?: string | null
          contact_role?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_experiences: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          total_slots: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          total_slots?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          total_slots?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_experiences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: string
          name: string
          slots_main_stage: number
          slots_second_stage: number
          slots_stand: number
          slots_workshop: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slots_main_stage?: number
          slots_second_stage?: number
          slots_stand?: number
          slots_workshop?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slots_main_stage?: number
          slots_second_stage?: number
          slots_stand?: number
          slots_workshop?: number
          updated_at?: string
        }
        Relationships: []
      }
      meeting_goals: {
        Row: {
          account_executive: string
          created_at: string
          goal: number
          id: string
          iso_week: number
          iso_year: number
          updated_at: string
        }
        Insert: {
          account_executive: string
          created_at?: string
          goal?: number
          id?: string
          iso_week: number
          iso_year: number
          updated_at?: string
        }
        Update: {
          account_executive?: string
          created_at?: string
          goal?: number
          id?: string
          iso_week?: number
          iso_year?: number
          updated_at?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          account_executive: string
          company_id: string
          company_name: string
          contact_ids: string[]
          created_at: string
          gcal_event_id: string | null
          id: string
          iso_week: number
          iso_year: number
          meet_link: string | null
          meeting_ends_at: string | null
          notes: string
          origin: string | null
          outcome: string | null
          outcome_reason: string | null
          scheduled_at: string
          sdr: string | null
          sequence_id: string | null
          slack_channel_id: string | null
          slack_message_ts: string | null
          slack_prompt_sent_at: string | null
        }
        Insert: {
          account_executive: string
          company_id: string
          company_name: string
          contact_ids?: string[]
          created_at?: string
          gcal_event_id?: string | null
          id?: string
          iso_week: number
          iso_year: number
          meet_link?: string | null
          meeting_ends_at?: string | null
          notes?: string
          origin?: string | null
          outcome?: string | null
          outcome_reason?: string | null
          scheduled_at: string
          sdr?: string | null
          sequence_id?: string | null
          slack_channel_id?: string | null
          slack_message_ts?: string | null
          slack_prompt_sent_at?: string | null
        }
        Update: {
          account_executive?: string
          company_id?: string
          company_name?: string
          contact_ids?: string[]
          created_at?: string
          gcal_event_id?: string | null
          id?: string
          iso_week?: number
          iso_year?: number
          meet_link?: string | null
          meeting_ends_at?: string | null
          notes?: string
          origin?: string | null
          outcome?: string | null
          outcome_reason?: string | null
          scheduled_at?: string
          sdr?: string | null
          sequence_id?: string | null
          slack_channel_id?: string | null
          slack_message_ts?: string | null
          slack_prompt_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "prospection_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      pipe_goals: {
        Row: {
          created_at: string
          goal: number
          id: string
          iso_week: number
          iso_year: number
          owner_name: string
          owner_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          goal?: number
          id?: string
          iso_week: number
          iso_year: number
          owner_name: string
          owner_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          goal?: number
          id?: string
          iso_week?: number
          iso_year?: number
          owner_name?: string
          owner_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      prospection_sequences: {
        Row: {
          company_id: string
          created_at: string
          end_reason: string | null
          ended_at: string | null
          id: string
          linkedin_account: string | null
          sdr: string | null
          started_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          linkedin_account?: string | null
          sdr?: string | null
          started_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          linkedin_account?: string | null
          sdr?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospection_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_meeting_goals: {
        Row: {
          created_at: string
          goal: number
          id: string
          iso_week: number
          iso_year: number
          sdr: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          goal?: number
          id?: string
          iso_week: number
          iso_year: number
          sdr: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          goal?: number
          id?: string
          iso_week?: number
          iso_year?: number
          sdr?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          company_id: string
          company_name: string
          completed: boolean
          created_at: string
          due_at: string
          id: string
          sdr: string | null
          title: string
        }
        Insert: {
          company_id: string
          company_name: string
          completed?: boolean
          created_at?: string
          due_at: string
          id?: string
          sdr?: string | null
          title: string
        }
        Update: {
          company_id?: string
          company_name?: string
          completed?: boolean
          created_at?: string
          due_at?: string
          id?: string
          sdr?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ae_targets: {
        Row: {
          ae_name: string
          quarter_key: string
          target: number
          updated_at: string
        }
        Insert: {
          ae_name: string
          quarter_key: string
          target?: number
          updated_at?: string
        }
        Update: {
          ae_name?: string
          quarter_key?: string
          target?: number
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          name: string
          role: string
          email: string | null
          is_active: boolean
          display_order: number
          pipe_goal: number
          meeting_goal: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          role: string
          email?: string | null
          is_active?: boolean
          display_order?: number
          pipe_goal?: number
          meeting_goal?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: string
          email?: string | null
          is_active?: boolean
          display_order?: number
          pipe_goal?: number
          meeting_goal?: number
          created_at?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_lost: boolean
          is_won: boolean
          key: string
          kind: string
          label: string
          pipeline: string
          probability: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          key: string
          kind?: string
          label: string
          pipeline: string
          probability?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_lost?: boolean
          is_won?: boolean
          key?: string
          kind?: string
          label?: string
          pipeline?: string
          probability?: number
          sort_order?: number
        }
        Relationships: []
      }
      catalog_options: {
        Row: {
          catalog_key: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          requires_note: boolean
          sort_order: number
        }
        Insert: {
          catalog_key: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          requires_note?: boolean
          sort_order?: number
        }
        Update: {
          catalog_key?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          requires_note?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          created_at: string
          field_type: string
          id: string
          is_active: boolean
          key: string
          label: string
          options: Json
          sort_order: number
          stage_id: string
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          options?: Json
          sort_order?: number
          stage_id: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          options?: Json
          sort_order?: number
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      touches: {
        Row: {
          account_used: string | null
          channel: string | null
          company_id: string
          contact_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          sdr: string | null
          touched_at: string
        }
        Insert: {
          account_used?: string | null
          channel?: string | null
          company_id: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          sdr?: string | null
          touched_at?: string
        }
        Update: {
          account_used?: string | null
          channel?: string | null
          company_id?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          sdr?: string | null
          touched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "touches_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "touches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_touch_to_contact: {
        Args: {
          p_contact_id: string
          p_channel?: string | null
          p_account_used?: string | null
          p_sdr?: string | null
          p_note?: string | null
          p_touched_at?: string | null
        }
        Returns: Json
      }
      set_contact_status: {
        Args: {
          p_contact_id: string
          p_status: string
          p_reason?: string | null
        }
        Returns: Json
      }
      refresh_company_status_from_contacts: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_deals_for_followup: { Args: never; Returns: Json }
      get_deals_tp01: {
        Args: never
        Returns: {
          account_executive: string
          adicionales_paquete: string
          checklist: Json
          company_name: string
          contact: Json
          deal_name: string
          event: string
          id: string
          notes: string
          paquete_vendido: string
          sponsor_icp: string
          sponsor_pain: string
          stage_name: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
