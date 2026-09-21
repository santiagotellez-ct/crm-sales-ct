import { describe, it, expect } from "vitest";
import {
  extractDomain,
  registrableDomain,
  isGenericDomain,
  normalizeLinkedinUrl,
  compactName,
  levenshtein,
  findCompanyCreationGate,
  findContactCreationGate,
} from "./duplicates";
import { Company, Contact } from "@/types/company";

function company(partial: Partial<Company> & Pick<Company, "id" | "company_name">): Company {
  return {
    domain: "",
    industry: "",
    size: "MID",
    country: "Colombia",
    linkedin_url: "",
    icp_fit: "MID",
    reasoning: "",
    angle: "Brand",
    contacts: [],
    status: "por_contactar",
    notes: "",
    reviewed: false,
    created_at: "2026-01-01",
    ...partial,
  };
}

describe("extractDomain / registrableDomain", () => {
  it("strips protocol, www, and path", () => {
    expect(extractDomain("https://www.rappi.com/foo")).toBe("rappi.com");
    expect(registrableDomain("https://www.rappi.com")).toBe("rappi.com");
  });

  it("extracts host from email", () => {
    expect(extractDomain("alguien@rappi.com")).toBe("rappi.com");
    expect(registrableDomain("alguien@rappi.com")).toBe("rappi.com");
  });

  it("treats co.rappi.com as rappi.com root", () => {
    expect(registrableDomain("co.rappi.com")).toBe("rappi.com");
    expect(registrableDomain("https://co.rappi.com/")).toBe("rappi.com");
  });

  it("keeps three labels for rappi.com.co", () => {
    expect(registrableDomain("www.rappi.com.co")).toBe("rappi.com.co");
  });

  it("ignores generic mailbox domains", () => {
    expect(isGenericDomain("alguien@gmail.com")).toBe(true);
    expect(isGenericDomain("hotmail.com")).toBe(true);
    expect(isGenericDomain("rappi.com")).toBe(false);
  });
});

describe("normalizeLinkedinUrl", () => {
  it("lowercases and strips slash/query", () => {
    expect(normalizeLinkedinUrl("https://www.LinkedIn.com/in/Jane/?trk=x")).toBe("linkedin.com/in/jane");
  });
});

describe("compactName + levenshtein", () => {
  it("normalizes Mercado Libre variants", () => {
    expect(compactName("Mercado Libre S.A.S.")).toBe("mercadolibre");
    expect(compactName("MercadoLibre")).toBe("mercadolibre");
  });

  it("keeps Indriver / inDrive distinguishable by one char", () => {
    expect(compactName("inDrive")).toBe("indrive");
    expect(compactName("Indriver")).toBe("indriver");
    expect(levenshtein("indrive", "indriver")).toBe(1);
  });

  it("does not empty Colombia Tech Week names", () => {
    expect(compactName("Colombia Tech Week")).toBe("colombiatechweek");
  });

  it("levenshtein distances", () => {
    expect(levenshtein("a", "a")).toBe(0);
    expect(levenshtein("abc", "ab")).toBe(1);
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("findCompanyCreationGate", () => {
  const pool = [
    company({ id: "1", company_name: "inDrive", domain: "indrive.com", industry: "Tecnología", sdr: "Camila" }),
    company({ id: "2", company_name: "Rappi", domain: "https://www.rappi.com", industry: "Delivery", sdr: "Felipe" }),
    company({ id: "3", company_name: "MercadoLibre S.A.S.", domain: "mercadolibre.com" }),
  ];

  it("hard-blocks exact registrable domain", () => {
    const g = findCompanyCreationGate({ company_name: "Rappi SAC", domain: "alguien@rappi.com" }, pool);
    expect(g.hard?.id).toBe("2");
    expect(g.hardReason).toBe("domain");
    expect(g.suggestions).toHaveLength(0);
  });

  it("hard-blocks subdomain vs root", () => {
    const g = findCompanyCreationGate({ company_name: "Rappi CO", domain: "co.rappi.com" }, pool);
    expect(g.hard?.id).toBe("2");
  });

  it("does not hard-block gmail", () => {
    const g = findCompanyCreationGate({ company_name: "Totally New Co", domain: "foo@gmail.com" }, pool);
    expect(g.hard).toBeNull();
  });

  it("suggests Indriver when inDrive exists", () => {
    const g = findCompanyCreationGate({ company_name: "Indriver" }, pool);
    expect(g.hard).toBeNull();
    expect(g.suggestions.map((c) => c.id)).toContain("1");
  });

  it("suggests Mercado Libre vs MercadoLibre", () => {
    const g = findCompanyCreationGate({ company_name: "Mercado Libre" }, pool);
    expect(g.suggestions.map((c) => c.id)).toContain("3");
  });

  it("returns empty for unrelated name", () => {
    const g = findCompanyCreationGate({ company_name: "Completely Different Corp" }, pool);
    expect(g.hard).toBeNull();
    expect(g.suggestions).toHaveLength(0);
  });

  it("fail-opens on empty pool", () => {
    const g = findCompanyCreationGate({ company_name: "Indriver", domain: "rappi.com" }, []);
    expect(g.hard).toBeNull();
    expect(g.suggestions).toHaveLength(0);
  });

  it("hard-blocks matching company LinkedIn", () => {
    const withLi = [
      company({ id: "li", company_name: "Acme", linkedin_url: "https://www.linkedin.com/company/acme/" }),
    ];
    const g = findCompanyCreationGate(
      { company_name: "Acme Inc", linkedin_url: "https://linkedin.com/company/acme" },
      withLi,
    );
    expect(g.hard?.id).toBe("li");
    expect(g.hardReason).toBe("linkedin");
  });
});

describe("findContactCreationGate", () => {
  const contact: Contact = {
    name: "Ana Pérez",
    role: "CEO",
    email: "ana@acme.com",
    linkedin: "https://www.linkedin.com/in/ana-perez/",
  };
  const companies = [company({ id: "c1", company_name: "Acme", contacts: [contact] })];

  it("hard-blocks exact email", () => {
    const g = findContactCreationGate({ email: "Ana@Acme.com" }, companies);
    expect(g.hard?.reason).toBe("email");
    expect(g.hard?.contact.name).toBe("Ana Pérez");
    expect(g.hard?.company.id).toBe("c1");
  });

  it("hard-blocks normalized LinkedIn", () => {
    const g = findContactCreationGate({ linkedin: "https://linkedin.com/in/ana-perez" }, companies);
    expect(g.hard?.reason).toBe("linkedin");
  });

  it("ignores self when editing", () => {
    const g = findContactCreationGate(
      {
        email: "ana@acme.com",
        linkedin: "https://linkedin.com/in/ana-perez",
        ignoreEmail: "ana@acme.com",
        ignoreLinkedin: "https://www.linkedin.com/in/ana-perez/",
      },
      companies,
    );
    expect(g.hard).toBeNull();
  });

  it("allows new email", () => {
    const g = findContactCreationGate({ email: "new@acme.com" }, companies);
    expect(g.hard).toBeNull();
  });
});
