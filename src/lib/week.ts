// ISO week helpers (week starts Monday; week 1 contains Jan 4)
export function getIsoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function isoWeekKey(year: number, week: number) {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// Monday of the ISO week (local time)
export function isoWeekStart(year: number, week: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay() || 7;
  const monday = new Date(simple);
  monday.setDate(simple.getDate() - dow + 1);
  return monday;
}

export function formatWeekRange(year: number, week: number): string {
  const start = isoWeekStart(year, week);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  const fmt = (d: Date) =>
    d.toLocaleDateString("es", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}