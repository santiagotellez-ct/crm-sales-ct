import { Company, Contact } from "@/types/company";

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

/** Domains that identify a person mailbox, not a company. */
export const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "aol.com",
  "yopmail.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
]);

/**
 * Extract a host from a URL, bare domain, or email (part after @).
 * Returns "" when nothing recognizable is found.
 */
export function extractDomain(emailOrUrl: string | undefined | null): string {
  if (!emailOrUrl) return "";
  const raw = String(emailOrUrl).trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("@")) {
    const host = raw.split("@").pop() ?? "";
    return normalizeDomain(host);
  }
  return normalizeDomain(raw);
}

/**
 * Registrable root domain: last 2 labels, or 3 when the SLD is a common
 * public suffix under a 2-letter ccTLD (e.g. rappi.com.co).
 * co.rappi.com → rappi.com
 */
export function registrableDomain(emailOrUrl: string | undefined | null): string {
  const host = extractDomain(emailOrUrl);
  if (!host) return "";
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  const PUBLIC_SLDS = new Set(["co", "com", "org", "gob", "gov", "net", "edu"]);
  if (tld.length === 2 && PUBLIC_SLDS.has(sld) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

export function isGenericDomain(emailOrUrl: string | undefined | null): boolean {
  const root = registrableDomain(emailOrUrl);
  return !!root && GENERIC_EMAIL_DOMAINS.has(root);
}

/** Lowercase LinkedIn URL without query/hash and without trailing slash. */
export function normalizeLinkedinUrl(url: string | undefined | null): string {
  if (!url) return "";
  let s = String(url).trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/[?#].*$/, "");
  s = s.replace(/\/+$/, "");
  return s;
}

const LEGAL_SUFFIX_RE =
  /\b(s\.?\s*a\.?\s*s\.?|s\.?\s*a\.?|sas|sa|inc\.?|llc\.?|ltd\.?|ltda\.?|corp\.?|co\.?|group|holdings?)\b/gi;

/**
 * Compact name for Levenshtein gate (PR 0). Distinct from nameTokens/STOPWORDS
 * used by /duplicates — those strip "colombia/tech/week" and empty CTW names.
 */
export function compactName(name: string | undefined | null): string {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(LEGAL_SUFFIX_RE, "")
    .replace(/[^a-z0-9]/g, "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const prev = new Array<number>(cols);
  const curr = new Array<number>(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;
  for (let i = 1; i < rows; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j < cols; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j < cols; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export interface CompanyCreationInput {
  company_name: string;
  domain?: string;
  linkedin_url?: string;
  excludeId?: string;
}

export interface CompanyCreationGate {
  hard: Company | null;
  hardReason: "domain" | "linkedin" | null;
  suggestions: Company[];
}

/**
 * Manual-create gate: exact domain/LinkedIn → hard block;
 * compactName Levenshtein ≤ 2 → soft suggestions (top 5).
 * Fail-open when pool is empty: returns no matches.
 */
export function findCompanyCreationGate(
  input: CompanyCreationInput,
  pool: Company[],
): CompanyCreationGate {
  const empty: CompanyCreationGate = { hard: null, hardReason: null, suggestions: [] };
  if (!pool?.length) return empty;

  const excludeId = input.excludeId;
  const candidates = excludeId ? pool.filter((c) => c.id !== excludeId) : pool;

  const inputRoot = (() => {
    const raw = (input.domain ?? "").trim();
    if (!raw) return "";
    const root = registrableDomain(raw);
    if (!root || isGenericDomain(root)) return "";
    return root;
  })();

  if (inputRoot) {
    for (const c of candidates) {
      const existingRoot = registrableDomain(c.domain);
      if (existingRoot && existingRoot === inputRoot) {
        return { hard: c, hardReason: "domain", suggestions: [] };
      }
    }
  }

  const inputLi = normalizeLinkedinUrl(input.linkedin_url);
  if (inputLi) {
    for (const c of candidates) {
      if (normalizeLinkedinUrl(c.linkedin_url) === inputLi) {
        return { hard: c, hardReason: "linkedin", suggestions: [] };
      }
    }
  }

  const needle = compactName(input.company_name);
  if (needle.length < 3) return empty;

  const scored: { company: Company; dist: number }[] = [];
  for (const c of candidates) {
    const hay = compactName(c.company_name);
    if (hay.length < 3) continue;
    const dist = levenshtein(needle, hay);
    if (dist <= 2) scored.push({ company: c, dist });
  }
  scored.sort((a, b) => a.dist - b.dist || a.company.company_name.localeCompare(b.company.company_name));
  const seen = new Set<string>();
  const suggestions: Company[] = [];
  for (const s of scored) {
    if (seen.has(s.company.id)) continue;
    seen.add(s.company.id);
    suggestions.push(s.company);
    if (suggestions.length >= 5) break;
  }
  return { hard: null, hardReason: null, suggestions };
}

export interface ContactCreationInput {
  email?: string;
  linkedin?: string;
  /** When editing, ignore the contact currently being edited. */
  ignoreLinkedin?: string;
  ignoreEmail?: string;
}

export interface ContactHardMatch {
  contact: Contact;
  company: Company;
  reason: "email" | "linkedin";
}

export interface ContactCreationGate {
  hard: ContactHardMatch | null;
}

/**
 * Contact create gate: exact email or LinkedIn across the whole CRM → hard block.
 * No fuzzy name matching for people.
 */
export function findContactCreationGate(
  input: ContactCreationInput,
  companies: Company[],
): ContactCreationGate {
  if (!companies?.length) return { hard: null };

  const email = (input.email ?? "").trim().toLowerCase();
  const ignoreEmail = (input.ignoreEmail ?? "").trim().toLowerCase();
  const linkedin = normalizeLinkedinUrl(input.linkedin);
  const ignoreLi = normalizeLinkedinUrl(input.ignoreLinkedin);

  if (email && email !== ignoreEmail) {
    for (const company of companies) {
      for (const contact of company.contacts ?? []) {
        const ce = (contact.email ?? "").trim().toLowerCase();
        if (ce && ce === email) {
          return { hard: { contact, company, reason: "email" } };
        }
      }
    }
  }

  if (linkedin && linkedin !== ignoreLi) {
    for (const company of companies) {
      for (const contact of company.contacts ?? []) {
        if (normalizeLinkedinUrl(contact.linkedin) === linkedin) {
          return { hard: { contact, company, reason: "linkedin" } };
        }
      }
    }
  }

  return { hard: null };
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