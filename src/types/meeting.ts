export type AccountExecutive = string;
export const AE_OPTIONS: AccountExecutive[] = ["Nico", "Majo", "Santi", "Toqui", "Otro AE"];

export type SecondaryAe = string;
export const SECONDARY_AE_OPTIONS: SecondaryAe[] = ["Nath", "Liz", "Lau", "Fernando", "Carlos Alberto"];

export interface Meeting {
  id: string;
  company_id: string;
  company_name: string;
  account_executive: AccountExecutive;
  sdr: string | null;
  scheduled_at: number; // epoch ms
  iso_year: number;
  iso_week: number;
  notes: string;
  created_at: number;
  outcome?: "qualified" | "unqualified" | "no_show" | null;
  outcome_reason?: string | null;
  gcal_event_id?: string | null;
}

export interface MeetingGoal {
  id: string;
  iso_year: number;
  iso_week: number;
  account_executive: AccountExecutive;
  goal: number;
}