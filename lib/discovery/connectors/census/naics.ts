import type { SearchState } from "@/lib/search/searchState";
import { resolveSearchState } from "@/lib/search/searchState";

/** Sector / industry → default NAICS prefix for CBP queries. */
const INDUSTRY_NAICS: Record<string, string> = {
  payers: "524",
  providers: "62",
  "food-beverage": "311",
  pharma: "3254",
  "medical-devices": "3391",
  packaging: "3261",
  chemicals: "325",
  automotive: "3361",
  aerospace: "3364",
  banks: "522",
  "asset-management": "523",
  fintech: "5223",
  universities: "6113",
  "k12-education": "6111",
  retail: "44",
  logistics: "48",
  software: "5112",
};

const SECTOR_NAICS: Record<string, string> = {
  healthcare: "62",
  manufacturing: "31",
  "financial-services": "52",
  education: "61",
  "public-sector": "92",
  nonprofit: "813",
  "retail-consumer": "44",
  technology: "51",
};

/** Normalize a NAICS code to 2–6 digits; falls back to 00 (all industries). */
export function normalizeNaicsCode(naics: string | null | undefined): string {
  if (!naics?.trim()) return "00";
  const digits = naics.replace(/\D/g, "");
  if (!digits) return "00";
  if (digits.length > 6) return digits.slice(0, 6);
  return digits;
}

/** Infer NAICS from structured search state when not explicitly provided. */
export function inferNaicsFromSearchState(state: SearchState): string {
  const resolved = resolveSearchState(state);
  if (resolved.industry && INDUSTRY_NAICS[resolved.industry]) {
    return INDUSTRY_NAICS[resolved.industry]!;
  }
  if (resolved.sector && SECTOR_NAICS[resolved.sector]) {
    return SECTOR_NAICS[resolved.sector]!;
  }

  const hay = resolved.query.toLowerCase();
  if (/\b(manufactur|factory|plant)\b/.test(hay)) return "31";
  if (/\b(hospital|health system|provider|clinic)\b/.test(hay)) return "62";
  if (/\b(health plan|payer|insurer|mco|medicare|medicaid)\b/.test(hay)) {
    return "524";
  }
  if (/\b(bank|credit union|financial)\b/.test(hay)) return "52";
  if (/\b(university|college|school)\b/.test(hay)) return "61";
  if (/\b(retail|store|grocery)\b/.test(hay)) return "44";

  return "00";
}

export function marketSizeQueryFromSearchState(
  state: SearchState,
  extras?: { county?: string | null; zip?: string | null; naics?: string | null },
): {
  state: string | null;
  county: string | null;
  zip: string | null;
  naics: string;
} {
  const resolved = resolveSearchState(state);
  return {
    state: resolved.state,
    county: extras?.county ?? null,
    zip: extras?.zip ?? null,
    naics: normalizeNaicsCode(extras?.naics ?? inferNaicsFromSearchState(state)),
  };
}
