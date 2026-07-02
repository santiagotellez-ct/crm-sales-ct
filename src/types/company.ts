export type IcpFit = "ABM" | "HIGH" | "MID" | "MAYBE";

export const FIT_OPTIONS: IcpFit[] = ["ABM", "HIGH", "MID", "MAYBE"];

export const FIT_LABELS: Record<IcpFit, string> = {
  ABM: "ABM",
  HIGH: "High",
  MID: "Mid",
  MAYBE: "Maybe",
};

// Higher rank = higher priority (used for sorting)
export const FIT_RANK: Record<IcpFit, number> = {
  ABM: 4,
  HIGH: 3,
  MID: 2,
  MAYBE: 1,
};
export type Angle = "Hiring" | "Brand" | "Enterprise" | "Partnerships";
export type TimePeriod = "today" | "7days" | "all";

export type CompanyStatus =
  | "por_contactar"
  | "contactado"
  | "follow_up_1"
  | "follow_up_2"
  | "en_conversacion"
  | "agendado"
  | "reagendar"
  | "no_answer"
  | "no_interesado"
  | "unqualified"
  | "unqualified_post_meeting";

export const STATUS_LABELS: Record<CompanyStatus, string> = {
  por_contactar: "Por contactar",
  contactado: "Contactado",
  follow_up_1: "Follow Up 1",
  follow_up_2: "Follow Up 2",
  en_conversacion: "En conversación",
  agendado: "Agendado",
  reagendar: "Reagendar",
  no_answer: "No Answer",
  no_interesado: "No interesado",
  unqualified: "Unqualified",
  unqualified_post_meeting: "Unqualified Post-Reunión",
};

export const STATUS_OPTIONS: CompanyStatus[] = [
  "por_contactar",
  "contactado",
  "follow_up_1",
  "follow_up_2",
  "en_conversacion",
  "agendado",
  "reagendar",
  "no_answer",
  "no_interesado",
  "unqualified",
  "unqualified_post_meeting",
];

// "Mapi" remains in the union for historical data, but is no longer offered
// as an assignable SDR.
export type Sdr = "Jissad" | "Mapi" | "Juan" | "César" | "Self AE" | "Dani" | "Majo";
export const SDR_OPTIONS: Sdr[] = ["Jissad", "Juan", "César", "Dani", "Majo", "Self AE"];

export type ContactedFrom = "Nico" | "Majo" | "Liz" | "Lau" | "Toqui";
export const CONTACTED_FROM_OPTIONS: ContactedFrom[] = ["Nico", "Majo", "Liz", "Lau", "Toqui"];

export type CompanySize = "SMB" | "MID" | "ENTERPRISE";
export const SIZE_OPTIONS: CompanySize[] = ["SMB", "MID", "ENTERPRISE"];
export const SIZE_LABELS: Record<CompanySize, string> = {
  SMB: "SMB",
  MID: "Mid-Market",
  ENTERPRISE: "Enterprise",
};
export const SIZE_RANGES: Record<CompanySize, string> = {
  SMB: "11–99",
  MID: "100–999",
  ENTERPRISE: "1000+",
};

export type CompanySource = "inbound" | "outbound";
export const SOURCE_OPTIONS: CompanySource[] = ["inbound", "outbound"];
export const SOURCE_LABELS: Record<CompanySource, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
};

export interface Contact {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  linkedin: string;
  contacted_from?: ContactedFrom[];
}

export interface Company {
  id: string;
  company_name: string;
  domain: string;
  industry: string;
  size: CompanySize;
  country: string;
  linkedin_url: string;
  icp_fit: IcpFit;
  reasoning: string;
  angle: Angle;
  contacts: Contact[];
  status: CompanyStatus;
  unqualified_reason?: string;
  sdr?: Sdr | null;
  notes: string;
  amigos?: boolean;
  reviewed: boolean;
  created_at: string;
  experiencia_target?: string | null;
  source?: CompanySource | null;
}

export interface Activity {
  id: string;
  type: "status_change" | "contact_added";
  company_id: string;
  company_name: string;
  sdr: Sdr | null;
  date: string; // YYYY-MM-DD
  timestamp: number;
  from_status?: CompanyStatus;
  to_status?: CompanyStatus;
  contact_name?: string;
}

export interface Task {
  id: string;
  company_id: string;
  company_name: string;
  sdr: Sdr | null;
  title: string;
  due_at: number; // epoch ms
  completed: boolean;
  created_at: number;
}

export interface ProspectionSequence {
  id: string;
  company_id: string;
  sdr: Sdr | null;
  linkedin_account: ContactedFrom | null;
  started_at: number;
  ended_at: number | null;
  end_reason: string | null;
}

// Backwards-compat shim for any leftover references
export type CompanyTag = string;
