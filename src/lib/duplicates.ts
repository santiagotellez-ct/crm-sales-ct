import { Company } from "@/types/company";

export function normalizeDomain(domain: string | undefined | null): string {
  if (!domain) return "";
  return String(domain)
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\s+/g, "");
}

// Tokens that don't contribute to identifying a company (corp suffixes, event-tags, generic words)
const STOPWORDS = new Set([
  // corporate suffixes
  "sas", "sa", "sl", "inc", "llc", "ltd", "ltda", "corp", "co", "gmbh", "group",
  "holdings", "holding", "the", "company", "cia",
  // event / context tags frequently appended in this CRM
  "ctw", "ctw2026", "ctw2025", "ctw2024", "ctw26", "ctw25", "ctw24",
  "en", "de", "del", "la", "el", "for", "y", "and",
  "2023", "2024", "2025", "2026",
  "colombia", "tech", "week",
]);

/** Split a company name into meaningful tokens, dropping stopwords. */
export function nameTokens(name: string | undefined | null): string[] {
  if (!name) return [];
  const cleaned = String(name)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[._\-/&]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ");
  return cleaned.split(/\s+/).filter((t) => t && !STOPWORDS.has(t));
}

export function normalizeName(name: string | undefined | null): string {
  return nameTokens(name).sort().join("");
}

/** Two names are considered duplicate if their meaningful tokens fully overlap
 * one-way (a is a subset of b) AND they share at least one strong (>=4 chars) token. */
function tokensLookDuplicate(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const sa = new Set(a);
  const sb = new Set(b);
  const [small, big] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  for (const t of small) if (!big.has(t)) return false;
  for (const t of small) if (t.length >= 4) return true;
  // Both names are only short tokens (acronyms) — require exact set equality
  return sa.size === sb.size;
}

export interface DuplicateMatch {
  candidate: Company;
  existing: Company;
  reason: "domain" | "name";
}

/** Find first existing company that looks like a duplicate of `candidate`. */
export function findDuplicate(candidate: Company, pool: Company[]): { existing: Company; reason: "domain" | "name" } | null {
  const dom = normalizeDomain(candidate.domain);
  const toks = nameTokens(candidate.company_name);
  for (const c of pool) {
    if (c.id === candidate.id) continue;
    if (dom && normalizeDomain(c.domain) === dom) return { existing: c, reason: "domain" };
  }
  if (toks.length === 0) return null;
  for (const c of pool) {
    if (c.id === candidate.id) continue;
    if (tokensLookDuplicate(toks, nameTokens(c.company_name))) return { existing: c, reason: "name" };
  }
  return null;
}

/** Detect duplicates of each candidate against an existing pool AND against earlier candidates in the same batch. */
export function detectBatchDuplicates(candidates: Company[], existing: Company[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const accepted: Company[] = [];
  for (const c of candidates) {
    const m = findDuplicate(c, [...existing, ...accepted]);
    if (m) matches.push({ candidate: c, existing: m.existing, reason: m.reason });
    else accepted.push(c);
  }
  return matches;
}

/** Group existing companies into clusters of likely duplicates (size >= 2). */
export function findDuplicateClusters(companies: Company[]): Company[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let cur = x;
    while (parent.get(cur) !== r) {
      const next = parent.get(cur)!;
      parent.set(cur, r);
      cur = next;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  companies.forEach((c) => parent.set(c.id, c.id));

  // 1) Exact domain match
  const byDomain = new Map<string, string[]>();
  for (const c of companies) {
    const d = normalizeDomain(c.domain);
    if (!d) continue;
    const arr = byDomain.get(d) ?? [];
    arr.push(c.id);
    byDomain.set(d, arr);
  }
  for (const ids of byDomain.values())
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);

  // 2) Fuzzy name match via shared strong tokens (bucketed for performance)
  const tokensById = new Map<string, string[]>();
  const byToken = new Map<string, string[]>();
  for (const c of companies) {
    const toks = nameTokens(c.company_name);
    tokensById.set(c.id, toks);
    for (const t of new Set(toks)) {
      if (t.length < 4) continue; // index only strong tokens to avoid noise
      const arr = byToken.get(t) ?? [];
      arr.push(c.id);
      byToken.set(t, arr);
    }
  }
  const seenPair = new Set<string>();
  for (const ids of byToken.values()) {
    if (ids.length < 2 || ids.length > 80) continue; // skip noisy buckets
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (seenPair.has(k)) continue;
        seenPair.add(k);
        if (tokensLookDuplicate(tokensById.get(a)!, tokensById.get(b)!)) union(a, b);
      }
    }
  }

  const groups = new Map<string, Company[]>();
  for (const c of companies) {
    const r = find(c.id);
    const arr = groups.get(r) ?? [];
    arr.push(c);
    groups.set(r, arr);
  }
  return [...groups.values()].filter((g) => g.length >= 2);
}

/** Produce a merged company by combining a primary with secondaries. Primary fields win unless empty. */
export function mergeCompanyData(primary: Company, others: Company[]): Company {
  const pick = <K extends keyof Company>(key: K): Company[K] => {
    const v = primary[key];
    if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) return v;
    for (const o of others) {
      const ov = o[key];
      if (ov !== undefined && ov !== null && ov !== "" && !(Array.isArray(ov) && ov.length === 0)) return ov;
    }
    return v;
  };

  const contactsByKey = new Map<string, Company["contacts"][number]>();
  [primary, ...others].forEach((c) =>
    c.contacts.forEach((k) => {
      const key = (k.linkedin || k.email || k.name).toLowerCase();
      if (!contactsByKey.has(key)) contactsByKey.set(key, k);
    })
  );

  const notes = [primary.notes, ...others.map((o) => o.notes)].filter((n) => n && n.trim()).join("\n");

  return {
    ...primary,
    company_name: pick("company_name"),
    domain: pick("domain"),
    industry: pick("industry"),
    size: pick("size"),
    country: pick("country"),
    linkedin_url: pick("linkedin_url"),
    icp_fit: pick("icp_fit"),
    reasoning: pick("reasoning"),
    angle: pick("angle"),
    sdr: primary.sdr ?? others.find((o) => o.sdr)?.sdr ?? null,
    amigos: primary.amigos || others.some((o) => o.amigos),
    reviewed: primary.reviewed || others.some((o) => o.reviewed),
    notes,
    contacts: [...contactsByKey.values()],
  };
}