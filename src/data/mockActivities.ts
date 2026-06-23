import { Activity, Sdr, CompanyStatus } from "@/types/company";
import { mockCompanies } from "./mockCompanies";

const SDRS: Sdr[] = ["Jissad", "Juan", "César"];

function dateStr(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0];
}

// Deterministic seed activities across the last 5 days so the dashboard isn't empty
const transitions: Array<{ from: CompanyStatus; to: CompanyStatus }> = [
  { from: "por_contactar", to: "contactado" },
  { from: "contactado", to: "agendado" },
  { from: "contactado", to: "reagendar" },
  { from: "por_contactar", to: "unqualified" },
  { from: "por_contactar", to: "contactado" },
  { from: "contactado", to: "agendado" },
];

export const seedActivities: Activity[] = (() => {
  const out: Activity[] = [];
  let counter = 0;
  for (let d = 0; d < 5; d++) {
    const date = dateStr(d);
    const dayBase = Date.now() - d * 86400000;
    // ~6 status changes per day, distributed across SDRs
    for (let i = 0; i < 6; i++) {
      const t = transitions[(i + d) % transitions.length];
      const sdr = SDRS[(i + d) % SDRS.length];
      const company = mockCompanies[(i * 2 + d) % mockCompanies.length];
      out.push({
        id: `seed-s-${counter++}`,
        type: "status_change",
        company_id: company.id,
        company_name: company.company_name,
        sdr,
        date,
        timestamp: dayBase - i * 3600000,
        from_status: t.from,
        to_status: t.to,
      });
    }
    // ~4 contacts added per day
    for (let i = 0; i < 4; i++) {
      const sdr = SDRS[(i + d + 1) % SDRS.length];
      const company = mockCompanies[(i * 3 + d) % mockCompanies.length];
      out.push({
        id: `seed-c-${counter++}`,
        type: "contact_added",
        company_id: company.id,
        company_name: company.company_name,
        sdr,
        date,
        timestamp: dayBase - i * 1800000,
        contact_name: `Contacto ${counter}`,
      });
    }
  }
  return out;
})();