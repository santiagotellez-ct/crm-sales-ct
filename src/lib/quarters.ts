import { AccountExecutive } from "@/types/meeting";

export type QuarterKey = "ALL" | "Q4-2025" | "Q1-2026" | "Q2-2026" | "Q3-2026";

export interface Quarter {
  key: QuarterKey;
  label: string;
  start: Date;
  end: Date; // inclusive
}

// Custom fiscal quarters
export const QUARTERS: Quarter[] = [
  { key: "Q4-2025", label: "Q4 2025 (antes 10 Ene)", start: new Date(0), end: new Date(2026, 0, 9, 23, 59, 59) },
  { key: "Q1-2026", label: "Q1 2026 (10 Ene–31 Mar)", start: new Date(2026, 0, 10), end: new Date(2026, 2, 31, 23, 59, 59) },
  { key: "Q2-2026", label: "Q2 2026 (1 Abr–7 Ago)", start: new Date(2026, 3, 1), end: new Date(2026, 7, 7, 23, 59, 59) },
  { key: "Q3-2026", label: "Q3 2026 (8 Ago–10 Dic)", start: new Date(2026, 7, 8), end: new Date(2026, 11, 10, 23, 59, 59) },
];

export const AE_QUARTER_TARGETS: Record<Exclude<QuarterKey, "ALL">, Partial<Record<AccountExecutive, number>>> = {
  "Q4-2025": {},
  "Q1-2026": {},
  "Q2-2026": { Toqui: 140000, Nico: 140000, Santi: 210000, Majo: 210000 },
  "Q3-2026": {},
};

export function getQuarter(key: QuarterKey): Quarter {
  if (key === "ALL") {
    return { key: "ALL", label: "Todos los Q", start: new Date(0), end: new Date(8640000000000000) };
  }
  return QUARTERS.find((q) => q.key === key) ?? QUARTERS[1];
}

export function getCurrentQuarter(now = new Date()): Quarter {
  return QUARTERS.find((q) => now >= q.start && now <= q.end) ?? QUARTERS[1];
}

export function getAeTarget(qKey: QuarterKey, ae: AccountExecutive): number {
  if (qKey === "ALL") return 0;
  return AE_QUARTER_TARGETS[qKey]?.[ae] ?? 0;
}

/** Weekly team closing target (USD). */
export const WEEKLY_TEAM_TARGET = 72000;

export function weeksRemainingInQuarter(q: Quarter, now = new Date()): number {
  if (q.key === "ALL") return 0;
  if (now > q.end) return 0;
  const from = now < q.start ? q.start : now;
  const ms = q.end.getTime() - from.getTime();
  return Math.max(1, Math.ceil(ms / (7 * 86400000)));
}

/** Bucket deals into quarters by creation date. */
export function dealInQuarter(d: { created_at: number }, q: Quarter): boolean {
  if (q.key === "ALL") return true;
  const ref = new Date(d.created_at);
  return ref >= q.start && ref <= q.end;
}