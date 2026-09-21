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
  | "unqualified_post_meeting"
  | "touch_point_2"
  | "touch_point_3"
  | "touch_point_4"
  | "touch_point_5"
  | "touch_point_6"
  | "caliente"
  | "reunion_agendada"
  | "en_nutricion";

/** Spec SDR ladder used by the contact kanban (Phase B cutover). */
export type ContactStatus =
  | "por_contactar"
  | "contactado"
  | "touch_point_2"
  | "touch_point_3"
  | "touch_point_4"
  | "touch_point_5"
  | "touch_point_6"
  | "caliente"
  | "reunion_agendada"
  | "reagendar"
  | "unqualified"
  | "no_interesado"
  | "en_nutricion";

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  por_contactar: "Por contactar",
  contactado: "Contactado",
  touch_point_2: "Touch point 2",
  touch_point_3: "Touch point 3",
  touch_point_4: "Touch point 4",
  touch_point_5: "Touch point 5",
  touch_point_6: "Touch point 6",
  caliente: "Caliente",
  reunion_agendada: "Reunión agendada",
  reagendar: "Reagendar",
  unqualified: "Unqualified",
  no_interesado: "No interesado",
  en_nutricion: "En nutrición",
};

export const CONTACT_KANBAN_COLUMNS: ContactStatus[] = [
  "por_contactar",
  "contactado",
  "touch_point_2",
  "touch_point_3",
  "touch_point_4",
  "touch_point_5",
  "touch_point_6",
  "caliente",
  "reunion_agendada",
  "reagendar",
  "unqualified",
  "no_interesado",
  "en_nutricion",
];

/** Stages the SDR may set explicitly (not via generic touch). */
export const CONTACT_EXPLICIT_STATUSES: ContactStatus[] = [
  "caliente",
  "reunion_agendada",
  "reagendar",
  "unqualified",
  "no_interesado",
  "en_nutricion",
];

/** Map legacy / raw contact status into a kanban column key. */
export function normalizeContactStatus(status: string | null | undefined): ContactStatus {
  const s = (status ?? "").trim() || "por_contactar";
  switch (s) {
    case "follow_up_1":
      return "touch_point_2";
    case "follow_up_2":
      return "touch_point_3";
    case "en_conversacion":
      return "touch_point_4";
    case "agendado":
      return "reunion_agendada";
    case "no_answer":
      return "en_nutricion";
    case "unqualified_post_meeting":
      return "unqualified";
    default:
      if ((CONTACT_KANBAN_COLUMNS as string[]).includes(s)) return s as ContactStatus;
      return "por_contactar";
  }
}

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
  touch_point_2: "Touch point 2",
  touch_point_3: "Touch point 3",
  touch_point_4: "Touch point 4",
  touch_point_5: "Touch point 5",
  touch_point_6: "Touch point 6",
  caliente: "Caliente",
  reunion_agendada: "Reunión agendada",
  en_nutricion: "En nutrición",
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

export type Sdr = string;
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
  id?: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  linkedin: string;
  contacted_from?: ContactedFrom[];
  /** Contact-level SDR stage (spec ladder). Independent of companies.status until cutover. */
  status?: string | null;
  status_entered_at?: string | null;
  sdr?: Sdr | null;
}

/** Row from public.touches — contact outreach history. */
export interface ContactTouch {
  id: string;
  contact_id: string;
  company_id: string;
  touched_at: string;
  channel: string | null;
  account_used: string | null;
  sdr: string | null;
  note: string | null;
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
