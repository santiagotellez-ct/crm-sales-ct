import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CONTACTED_FROM_OPTIONS,
  FIT_OPTIONS,
  FIT_LABELS,
  SIZE_OPTIONS,
  SIZE_LABELS,
  SOURCE_OPTIONS,
  SOURCE_LABELS,
  ContactedFrom,
} from "@/types/company";

export type CatalogKey =
  | "unqualified_reason"
  | "not_interested_reason"
  | "lost_reason"
  | "product"
  | "channel"
  | "linkedin_seat"
  | "icp_fit"
  | "company_size"
  | "source"
  | "contact_role";

export interface CatalogOption {
  id: string;
  catalog_key: string;
  label: string;
  code: string;
  requires_note: boolean;
  sort_order: number;
  is_active: boolean;
}

function fallbackFor(key: CatalogKey): CatalogOption[] {
  const wrap = (code: string, label: string, i: number, requires_note = false): CatalogOption => ({
    id: `fallback-${key}-${code}`,
    catalog_key: key,
    code,
    label,
    requires_note,
    sort_order: i + 1,
    is_active: true,
  });

  switch (key) {
    case "linkedin_seat":
      return CONTACTED_FROM_OPTIONS.map((c, i) => wrap(c.toLowerCase(), c, i));
    case "icp_fit":
      return FIT_OPTIONS.map((c, i) => wrap(c, FIT_LABELS[c], i));
    case "company_size":
      return SIZE_OPTIONS.map((c, i) => wrap(c, SIZE_LABELS[c], i));
    case "source":
      return SOURCE_OPTIONS.map((c, i) => wrap(c, SOURCE_LABELS[c], i));
    case "channel":
      return [
        wrap("linkedin", "LinkedIn", 0),
        wrap("whatsapp", "WhatsApp", 1),
        wrap("email", "Correo", 2),
        wrap("call", "Llamada", 3),
      ];
    case "product":
      return [
        wrap("ctw", "CTW", 0),
        wrap("ctf", "CTF", 1),
        wrap("ai_summit", "AI Summit", 2),
        wrap("govtech", "GovTech", 3),
        wrap("always_on", "Always-On", 4),
        wrap("media", "Media Company", 5),
      ];
    case "unqualified_reason":
      return [
        wrap("wrong_industry", "No es la industria correcta", 0),
        wrap("wrong_size", "Empresa muy pequeña / muy grande para el ticket", 1),
        wrap("already_customer", "Ya es cliente por otro canal", 2),
        wrap("duplicate", "Duplicado en el CRM", 3),
        wrap("other", "Otro", 4, true),
      ];
    case "not_interested_reason":
      return [
        wrap("no_budget", "Sin presupuesto en este momento", 0),
        wrap("similar_event", "Ya tiene un evento similar contratado", 1),
        wrap("exhausted_tps", "Agotó los 6 touch points sin respuesta", 2),
        wrap("explicit_no", "Dijo NO explícito", 3),
        wrap("other", "Otro", 4, true),
      ];
    case "lost_reason":
      return [
        wrap("no_budget", "Sin presupuesto", 0),
        wrap("timing", "Timing — no es el momento", 1),
        wrap("competition", "Se fue con la competencia", 2),
        wrap("no_response", "Dejó de responder", 3),
        wrap("other", "Otro", 4, true),
      ];
    case "contact_role":
      return [
        wrap("champion", "Champion", 0),
        wrap("decisor", "Tomador de decisión", 1),
      ];
    default:
      return [];
  }
}

/**
 * Dual-read catalog. On error or empty result, returns hardcoded fallback
 * so selects never render empty.
 */
export function useCatalog(catalogKey: CatalogKey) {
  const query = useQuery({
    queryKey: ["catalog_options", catalogKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_options")
        .select("*")
        .eq("catalog_key", catalogKey)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CatalogOption[];
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const fromDb = query.data ?? [];
  const options =
    query.isError || fromDb.length === 0 ? fallbackFor(catalogKey) : fromDb;

  return {
    options,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    source: (query.isError || fromDb.length === 0 ? "fallback" : "db") as "fallback" | "db",
  };
}

/** LinkedIn seats as ContactedFrom labels when possible. */
export function useLinkedinSeatOptions(): ContactedFrom[] {
  const { options, source } = useCatalog("linkedin_seat");
  if (source === "fallback") return [...CONTACTED_FROM_OPTIONS];
  const mapped = options
    .map((o) => o.label)
    .filter((l): l is ContactedFrom =>
      (CONTACTED_FROM_OPTIONS as string[]).includes(l),
    );
  return mapped.length > 0 ? mapped : [...CONTACTED_FROM_OPTIONS];
}
