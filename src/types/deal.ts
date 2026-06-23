import { AccountExecutive } from "./meeting";
import { Sdr } from "./company";
import { SecondaryAe } from "./meeting";

export interface DealStage {
  id: string;
  name: string;
  order: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface DealTask {
  id: string;
  deal_id: string;
  title: string;
  due_at: number;
  assignee: AccountExecutive | null;
  completed: boolean;
  created_at: number;
}

export interface ChecklistEntry {
  checked: boolean;
  result: string;
}

export interface Deal {
  id: string;
  name: string;
  company_id: string;
  company_name: string;
  stage_id: string;
  account_executive: AccountExecutive;
  secondary_ae: SecondaryAe | null;
  sdr: Sdr | null;
  value: number;
  currency: string;
  event: string | null;
  expected_close_date: string | null;
  billing_date: string | null;
  collection_date: string | null;
  notes: string;
  meeting_id: string | null;
  lost_reason: string | null;
  paquete_vendido: string | null;
  adicionales_paquete: string | null;
  sponsor_pain: string | null;
  sponsor_icp: string | null;
  commit_speaking_main: boolean;
  commit_speaking_second: boolean;
  commit_workshop: boolean;
  commit_stand: boolean;
  commit_experience_id: string | null;
  contact_ids: string[];
  created_at: number;
  tasks: DealTask[];
  checklist: Record<string, ChecklistEntry | boolean>;
  updated_at: number;
}

export interface DealInput {
  company_id: string;
  name: string;
  stage_id?: string;
  account_executive: AccountExecutive;
  secondary_ae?: SecondaryAe | null;
  sdr?: Sdr | null;
  value: number;
  currency?: string;
  event?: string | null;
  expected_close_date?: string | null;
  billing_date?: string | null;
  collection_date?: string | null;
  notes?: string;
  meeting_id?: string | null;
  contact_ids: string[];
  firstTask: { title: string; due_at: number; assignee: AccountExecutive | null };
}