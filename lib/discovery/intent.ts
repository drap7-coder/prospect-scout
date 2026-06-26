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

  const genericHealthPlan =
    /\bhealth\s+plans?\b/.test(hay) && !/\b(medicare|medicaid|commercial|blues|tpa)\b/.test(hay);
  if (genericHealthPlan) {
    out.sectorId = out.sectorId ?? "healthcare";
    out.industryId = out.industryId === "payers" ? undefined : out.industryId;
    out.organizationTypeId = undefined;
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

  return {
    query: trimmed,
    sectorId,
    industryId,
    organizationTypeId,
    state,
    region,
    keywords: [...new Set(keywords)],
  };
}
