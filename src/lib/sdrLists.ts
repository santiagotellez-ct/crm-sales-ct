// Week-aware SDR lists for weekly dashboards.
//
// Changes by week:
//   - From 2026-W25 onward: Juan is shown as a real SDR (was previously
//     counted as "Self AE").
//   - From 2026-W25 onward: Mapi is removed from the dashboards.

export function weekKey(year: number, week: number): number {
  return year * 100 + week;
}

const JUAN_FROM = weekKey(2026, 25);
const MAPI_UNTIL = weekKey(2026, 25); // strictly less than this includes Mapi

export function sdrListForWeek(year: number, week: number): string[] {
  const k = weekKey(year, week);
  const list: string[] = ["César", "Jissad"];
  if (k >= JUAN_FROM) list.push("Juan");
  else list.push("Self AE");
  if (k < MAPI_UNTIL) list.push("Mapi");
  return list;
}