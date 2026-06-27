import { inferStateFromQuery, inferRegionFromQuery } from "@/lib/directories/search";
import { inferTaxonomyFromQuery } from "@/lib/taxonomy";
import { inferRegionFromText, normalizeRegion, ANY_REGION } from "@/lib/search/regions";

/**
 * Structured search intent parsed from free text or explicit filters.
 * Used for organization discovery and structured ranking.
 */
export interface SearchIntent {
  /** Original query text. */
  query: string;
  /** Taxonomy sector id, e.g. "manufacturing". */
  sectorId: string | null;
  /** Taxonomy industry id, e.g. "food-beverage". */
  industryId: string | null;
  /** Taxonomy organization type id, e.g. "manufacturer". */
  organizationTypeId: string | null;
  /** US state postal code, e.g. "OH". */
  state: string | null;
  /** City/locality for proximity queries, e.g. "Philadelphia". */
  city: string | null;
  /** Cross-sector sector ids (e.g. pharma → manufacturing). */
  alternateSectorIds: string[];
  /** Cross-sector industry ids (e.g. life-sciences → pharma-manufacturing). */
  alternateIndustryIds: string[];
  /** Region bucket id, e.g. "midwest". "any" = no region filter. */
  region: string;
  /** Remaining significant keywords after structured extraction. */
  keywords: string[];
}

const GENERIC_TERMS = new Set([
  "the", "and", "for", "with", "that", "in", "near", "around", "based",
  "company", "companies", "organization", "organizations", "org", "orgs",
  "show", "find", "search", "looking", "target", "targeting",
]);

export interface ParseSearchIntentOptions {
  sectorId?: string | null;
  industryId?: string | null;
  organizationTypeId?: string | null;
  state?: string | null;
  region?: string | null;
}

/** When the query names a broad category (not a sub-industry), avoid narrow industry inference. */
function softenGenericListingIntent(
  query: string,
  taxonomy: ReturnType<typeof inferTaxonomyFromQuery>,
): ReturnType<typeof inferTaxonomyFromQuery> {
  const hay = query.toLowerCase();
  const out = { ...taxonomy };

  const genericManufacturer =
    /\bmanufacturers?\b/.test(hay) &&
    !/\b(food|beverage|packaging|device|pharma|pharmaceutical|chemical|automotive|aerospace|logistics)\b/.test(
      hay,
    );
  if (genericManufacturer) {
    out.sectorId = out.sectorId ?? "manufacturing";
    out.industryId = undefined;
    out.organizationTypeId = undefined;
  }

  const explicitPbm =
    /\b(pbms?|pharmacy benefit managers?|pharmacy benefit)\b/.test(hay);
  if (explicitPbm) {
    out.sectorId = out.sectorId ?? "healthcare";
    out.industryId = out.industryId ?? "payers";
    out.organizationTypeId = out.organizationTypeId ?? "pbm";
  }

  const explicitHealthPlan =
    /\b(health\s+plans?|insurers?|payers?|mcos?|managed care organizations?|medicare advantage plans?|medicaid mcos?|blue cross plans?|blues plans?)\b/.test(
      hay,
    );
  if (explicitHealthPlan && !explicitPbm) {
    out.sectorId = out.sectorId ?? "healthcare";
    out.industryId = out.industryId ?? "payers";
    out.organizationTypeId = "health-plan";
  }

  const genericBank =
    /\bbanks?\b/.test(hay) && !/\b(credit union|investment|mortgage)\b/.test(hay);
  if (genericBank) {
    out.sectorId = out.sectorId ?? "financial-services";
    out.industryId = out.industryId ?? "banks";
    out.organizationTypeId = out.organizationTypeId ?? "bank";
  }

  const genericUniversity =
    /\buniversities\b|\bcolleges\b/.test(hay) && !/\b(community college|medical school)\b/.test(hay);
  if (genericUniversity) {
    out.sectorId = out.sectorId ?? "education";
    out.industryId = out.industryId ?? "universities";
    out.organizationTypeId = out.organizationTypeId ?? "university";
  }

  return out;
}

const CITY_ALIASES: Record<string, { city: string; state: string }> = {
  philadelphia: { city: "Philadelphia", state: "PA" },
  chicago: { city: "Chicago", state: "IL" },
  houston: { city: "Houston", state: "TX" },
  phoenix: { city: "Phoenix", state: "AZ" },
  "san francisco": { city: "San Francisco", state: "CA" },
  "los angeles": { city: "Los Angeles", state: "CA" },
  boston: { city: "Boston", state: "MA" },
  cleveland: { city: "Cleveland", state: "OH" },
  columbus: { city: "Columbus", state: "OH" },
  cincinnati: { city: "Cincinnati", state: "OH" },
  pittsburgh: { city: "Pittsburgh", state: "PA" },
  detroit: { city: "Detroit", state: "MI" },
  atlanta: { city: "Atlanta", state: "GA" },
  dallas: { city: "Dallas", state: "TX" },
  seattle: { city: "Seattle", state: "WA" },
};

function inferCityFromQuery(query: string): { city: string; state: string } | null {
  const hay = query.toLowerCase();
  const nearMatch = hay.match(/\bnear\s+([a-z\s]+?)(?:\s|$|,)/i);
  const inMatch = hay.match(/\bin\s+([a-z\s]+?)(?:\s|$|,)/i);
  const candidate = (nearMatch?.[1] ?? inMatch?.[1] ?? "").trim();
  if (!candidate) return null;
  return CITY_ALIASES[candidate] ?? null;
}

/** Add cross-sector alternates for manufacturer / life-sciences queries. */
function applyCrossSectorAlternates(
  query: string,
  intent: {
    sectorId: string | null;
    industryId: string | null;
    organizationTypeId: string | null;
  },
): { alternateSectorIds: string[]; alternateIndustryIds: string[] } {
  const hay = query.toLowerCase();
  const alternates = {
    alternateSectorIds: [] as string[],
    alternateIndustryIds: [] as string[],
  };

  const isPharma =
    /\b(pharma|pharmaceutical|drug maker|biotech)\b/.test(hay) &&
    /\b(manufacturers?|plant|company|companies)\b/.test(hay);
  const isDevice =
    /\b(medical device|medtech|device maker|device companies?)\b/.test(hay);

  if (isPharma) {
    alternates.alternateSectorIds.push("manufacturing");
    alternates.alternateIndustryIds.push("pharma-manufacturing");
    if (intent.sectorId === "healthcare") {
      alternates.alternateIndustryIds.push("life-sciences");
    }
  }

  if (isDevice) {
    alternates.alternateSectorIds.push("manufacturing");
    alternates.alternateIndustryIds.push("medical-device-manufacturing");
    if (intent.sectorId === "healthcare") {
      alternates.alternateIndustryIds.push("life-sciences");
    }
  }

  if (intent.organizationTypeId === "hospital") {
    alternates.alternateSectorIds.push("nonprofit");
  }

  return alternates;
}

/** Parse a query into structured search intent. Explicit options win over inference. */
export function parseSearchIntent(
  query: string,
  options: ParseSearchIntentOptions = {},
): SearchIntent {
  const trimmed = query.trim();
  const taxonomy = softenGenericListingIntent(
    trimmed,
    inferTaxonomyFromQuery(trimmed),
  );

  const sectorId =
    options.sectorId ?? taxonomy.sectorId ?? null;
  const industryId =
    options.industryId ?? taxonomy.industryId ?? null;
  const organizationTypeId =
    options.organizationTypeId ?? taxonomy.organizationTypeId ?? null;

  const state =
    options.state ?? inferStateFromQuery(trimmed) ?? null;

  const cityHint = inferCityFromQuery(trimmed);
  const resolvedState = state ?? cityHint?.state ?? null;
  const city = cityHint?.city ?? null;

  let region = ANY_REGION;
  if (options.region) {
    region = normalizeRegion(options.region);
  } else {
    const regionFromQuery = inferRegionFromQuery(trimmed);
    if (regionFromQuery) {
      region = regionFromQuery;
    } else {
      region = inferRegionFromText(trimmed);
    }
  }

  const keywords = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !GENERIC_TERMS.has(t));

  const crossSector = applyCrossSectorAlternates(trimmed, {
    sectorId,
    industryId,
    organizationTypeId,
  });

  return {
    query: trimmed,
    sectorId,
    industryId,
    organizationTypeId,
    state: resolvedState,
    city,
    alternateSectorIds: crossSector.alternateSectorIds,
    alternateIndustryIds: crossSector.alternateIndustryIds,
    region,
    keywords: [...new Set(keywords)],
  };
}
