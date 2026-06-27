import type { BuyerPackId, RawSearchInput } from "./types";
import { inferRegionFromText, normalizeRegion, ANY_REGION } from "./regions";
import {
  EXAMPLE_SEARCHES,
  FRESHNESS_FILTERS,
  OWNERSHIP_FILTERS,
  TAXONOMY_ORGANIZATION_TYPES,
  TAXONOMY_SECTORS,
  TAXONOMY_SIGNAL_FILTERS,
  TAXONOMY_SOURCE_FILTERS,
  US_STATE_FILTERS,
  getIndustry,
  getIndustryByLabel,
  industriesForSector,
  industryLabel,
  inferTaxonomyFromQuery,
  legacyIndustryToSectorId,
  normalizeOrganizationTypeId,
  organizationTypeLabel,
  resolveTaxonomyTarget,
  sectorLabel,
  taxonomyTargetsForIndustry,
  taxonomyTargetsForSector,
} from "@/lib/taxonomy";

/** Structured search state for universal organization discovery. */
export interface SearchState {
  query: string;
  sector: string | null;
  industry: string | null;
  organizationType: string | null;
  location: string | null;
  companySize: string | null;
  signals: string[];
  sources: string[];
  freshness: string | null;
  /** Optional outreach personalization — not required for search. */
  sellerContext: string | null;
  /** Public vs private ownership filter. */
  ownership: string | null;
  /** US state postal code filter, e.g. OH. */
  state: string | null;
  /** City or metro area (builder / query hint). */
  metro: string | null;
  /** Additional operating states from builder. */
  operatingStates: string[];
  /** Results sort preference from builder. */
  sort: string | null;
}

export const EMPTY_SEARCH_STATE: SearchState = {
  query: "",
  sector: null,
  industry: null,
  organizationType: null,
  location: null,
  companySize: null,
  signals: [],
  sources: [],
  freshness: null,
  sellerContext: null,
  ownership: null,
  state: null,
  metro: null,
  operatingStates: [],
  sort: null,
};

export { EXAMPLE_SEARCHES, FRESHNESS_FILTERS };

export const SECTORS = TAXONOMY_SECTORS;

export const ORGANIZATION_TYPES = TAXONOMY_ORGANIZATION_TYPES.map((o) => ({
  id: o.id,
  label: o.label,
  sectorId: o.sectorId,
  industryId: o.industryId,
  taxonomyTarget: o.taxonomyTarget,
}));

export const LOCATIONS = [
  { id: "northeast", label: "Northeast" },
  { id: "mid-atlantic", label: "Mid-Atlantic" },
  { id: "southeast", label: "Southeast" },
  { id: "midwest", label: "Midwest" },
  { id: "southwest", label: "Southwest" },
  { id: "mountain-west", label: "Mountain West" },
  { id: "west", label: "West" },
  { id: "nationwide", label: "Nationwide" },
] as const;

export const COMPANY_SIZES = [
  "Small",
  "Mid-Market",
  "Large",
  "Enterprise",
] as const;

export const SIGNAL_FILTERS = TAXONOMY_SIGNAL_FILTERS;

export const SOURCE_FILTERS = TAXONOMY_SOURCE_FILTERS;

export { OWNERSHIP_FILTERS, US_STATE_FILTERS };

/** @deprecated Use SECTORS — kept for import compatibility. */
export const INDUSTRIES = SECTORS.map((s) => s.label);

const SIGNAL_MATCHERS: Record<string, (text: string) => boolean> = {
  "leadership-change": (t) =>
    /leadership|executive|ceo|cfo|chief|president|officer/.test(t),
  "growth-expansion": (t) =>
    /growth|expan|merger|acquisition|new facility|footprint/.test(t),
  "regulatory-pressure": (t) => /regulat|compliance|enforcement|340b|star rating/.test(t),
  "fda-recall": (t) => /fda|recall|enforcement|packaging|contamination/.test(t),
  "cms-enrollment": (t) => /cms|medicare|enrollment|advantage|part d/.test(t),
  "star-ratings": (t) => /star rating|quality rating/.test(t),
  "sec-filing": (t) => /sec|filing|10-k|10-q|8-k|edgar/.test(t),
  hiring: (t) => /hiring|workforce|recruit|open role|director of/.test(t),
  "partnership-acquisition": (t) => /partnership|acquisition|merger|joint venture/.test(t),
};

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function normalizeSectorParam(value: string | null): string | null {
  if (!value) return null;
  if (SECTORS.some((s) => s.id === value)) return value;
  return legacyIndustryToSectorId(value);
}

function normalizeIndustryParam(value: string | null, sector: string | null): string | null {
  if (!value) return null;
  if (getIndustry(value)) return value;
  const byLabel = getIndustryByLabel(value);
  if (byLabel) return byLabel.id;
  if (sector) {
    const match = industriesForSector(sector).find(
      (i) => i.label.toLowerCase() === value.toLowerCase(),
    );
    if (match) return match.id;
  }
  return null;
}

/** Reads structured search state from URL search params. */
export function parseSearchStateFromParams(
  params: URLSearchParams,
): SearchState {
  const sector =
    normalizeSectorParam(params.get("sector")) ??
    legacyIndustryToSectorId(params.get("industry"));
  const industry = normalizeIndustryParam(params.get("industry"), sector);

  return {
    query: params.get("q") ?? "",
    sector,
    industry,
    organizationType: normalizeOrganizationTypeId(params.get("org")),
    location: params.get("location"),
    companySize: params.get("size"),
    signals: parseList(params.get("signals")),
    sources: parseList(params.get("sources")),
    freshness: params.get("freshness"),
    sellerContext: params.get("seller"),
    ownership: params.get("ownership"),
    state: params.get("state"),
    metro: params.get("metro"),
    operatingStates: parseList(params.get("opStates")),
    sort: params.get("sort"),
  };
}

/** Serializes search state to URL search params (omits empty values). */
export function searchStateToParams(state: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.query.trim()) p.set("q", state.query.trim());
  if (state.sector && !state.industry) p.set("sector", state.sector);
  if (state.industry) p.set("industry", state.industry);
  if (state.organizationType) p.set("org", state.organizationType);
  if (state.location) p.set("location", state.location);
  if (state.companySize) p.set("size", state.companySize);
  if (state.signals.length) p.set("signals", state.signals.join(","));
  if (state.sources.length) p.set("sources", state.sources.join(","));
  if (state.freshness) p.set("freshness", state.freshness);
  if (state.sellerContext?.trim()) p.set("seller", state.sellerContext.trim());
  if (state.ownership) p.set("ownership", state.ownership);
  if (state.state) p.set("state", state.state);
  if (state.metro?.trim()) p.set("metro", state.metro.trim());
  if (state.operatingStates.length) p.set("opStates", state.operatingStates.join(","));
  if (state.sort && state.sort !== "score") p.set("sort", state.sort);
  return p;
}

/** Infers optional filter fields from natural-language query text. */
export function inferSearchStateFromQuery(query: string): Partial<SearchState> {
  const hay = query.toLowerCase();
  const inferred: Partial<SearchState> = {};
  const taxonomy = inferTaxonomyFromQuery(query);

  if (taxonomy.sectorId) inferred.sector = taxonomy.sectorId;
  if (taxonomy.industryId) inferred.industry = taxonomy.industryId;
  if (taxonomy.organizationTypeId) inferred.organizationType = taxonomy.organizationTypeId;

  const regionFromText = inferRegionFromText(query);
  if (regionFromText !== ANY_REGION) {
    inferred.location = regionFromText;
  } else if (hay.includes("nationwide") || hay.includes("national")) {
    inferred.location = "nationwide";
  }

  const signals: string[] = [];
  for (const sig of SIGNAL_FILTERS) {
    if (SIGNAL_MATCHERS[sig.id]?.(hay)) signals.push(sig.id);
  }
  if (signals.length) inferred.signals = signals;

  if (hay.includes("fda")) inferred.sources = [...(inferred.sources ?? []), "FDA"];
  if (hay.includes("cms") || hay.includes("medicare")) {
    inferred.sources = [...new Set([...(inferred.sources ?? []), "CMS"])];
  }
  if (hay.includes("sec") || hay.includes("filing")) {
    inferred.sources = [...new Set([...(inferred.sources ?? []), "SEC"])];
  }

  const stateMatch = hay.match(/\b(ohio|pennsylvania|michigan|illinois|new york|california|texas|florida)\b/);
  if (stateMatch) {
    const stateMap: Record<string, string> = {
      ohio: "OH",
      pennsylvania: "PA",
      michigan: "MI",
      illinois: "IL",
      "new york": "NY",
      california: "CA",
      texas: "TX",
      florida: "FL",
    };
    inferred.state = stateMap[stateMatch[1]] ?? null;
  }

  return inferred;
}

/** Merges explicit state with query-inferred defaults (explicit wins). */
export function resolveSearchState(state: SearchState): SearchState {
  const inferred = state.query.trim()
    ? inferSearchStateFromQuery(state.query)
    : {};
  return {
    ...EMPTY_SEARCH_STATE,
    ...inferred,
    ...state,
    query: state.query,
    sector: state.sector ?? inferred.sector ?? null,
    industry: state.industry ?? inferred.industry ?? null,
    organizationType: normalizeOrganizationTypeId(
      state.organizationType ?? inferred.organizationType ?? null,
    ),
    location: state.location ?? inferred.location ?? null,
    freshness: state.freshness ?? inferred.freshness ?? null,
    signals: state.signals?.length ? state.signals : (inferred.signals ?? []),
    sources: state.sources?.length ? state.sources : (inferred.sources ?? []),
    ownership: state.ownership ?? inferred.ownership ?? null,
    state: state.state ?? inferred.state ?? null,
    metro: state.metro ?? null,
    operatingStates: state.operatingStates?.length ? state.operatingStates : [],
    sort: state.sort ?? null,
  };
}

function locationToRegion(location: string | null): string | undefined {
  if (!location || location === "nationwide") return ANY_REGION;
  if (location === "mountain-west") return "west";
  return normalizeRegion(location);
}

/** Maps UI search state to the existing API / pipeline input shape. */
export function searchStateToRawInput(state: SearchState): RawSearchInput {
  const resolved = resolveSearchState(state);
  const buyerPack: BuyerPackId | undefined =
    resolveTaxonomyTarget({
      organizationTypeId: resolved.organizationType,
      industryId: resolved.industry,
      sectorId: resolved.sector,
    });

  return {
    query: resolved.query.trim(),
    sells: resolved.sellerContext?.trim() ?? "",
    targets: resolved.query.trim(),
    buyerPack,
    region: locationToRegion(resolved.location),
    sectorId: resolved.sector,
    industryId: resolved.industry,
    organizationTypeId: resolved.organizationType,
    state: resolved.state,
  };
}

export function locationLabel(id: string | null): string {
  if (!id || id === "nationwide") return "Nationwide";
  return LOCATIONS.find((l) => l.id === id)?.label ?? id;
}

export function orgTypeLabel(id: string | null): string {
  return organizationTypeLabel(id);
}

/** Human-readable summary for the results header. */
export function describeSearch(state: SearchState): string {
  const resolved = resolveSearchState(state);
  const parts: string[] = [];

  if (resolved.query.trim()) {
    parts.push(resolved.query.trim());
  } else if (resolved.organizationType) {
    parts.push(orgTypeLabel(resolved.organizationType).toLowerCase());
  } else if (resolved.industry) {
    parts.push(industryLabel(resolved.industry).toLowerCase());
  } else if (resolved.sector) {
    parts.push(sectorLabel(resolved.sector).toLowerCase());
  } else {
    parts.push("organizations");
  }

  if (resolved.location && resolved.location !== "nationwide") {
    parts.push(`in ${locationLabel(resolved.location)}`);
  }

  if (parts.length === 1 && !resolved.query.trim()) {
    return `Showing organizations · ${parts[0]}`;
  }

  return `Showing organizations · ${parts.join(" ")}`;
}

export function mountainWestRegions(): string[] {
  return ["west", "southwest"];
}

/** Stable key for fields that should trigger a new search request. */
export function searchFetchFingerprint(state: SearchState): string {
  const resolved = resolveSearchState(state);
  return [
    resolved.query.trim(),
    resolved.sector ?? "",
    resolved.industry ?? "",
    resolved.organizationType ?? "",
    resolved.location ?? "",
    resolved.state ?? "",
    resolved.metro ?? "",
    resolved.operatingStates.join(","),
    resolved.sellerContext?.trim() ?? "",
  ].join("|");
}

/** Taxonomy targets allowed when filtering by sector/industry (client-side). */
export function allowedTaxonomyTargets(state: SearchState): BuyerPackId[] | null {
  const resolved = resolveSearchState(state);
  if (resolved.organizationType) {
    const org = ORGANIZATION_TYPES.find((o) => o.id === resolved.organizationType);
    return org ? [org.taxonomyTarget] : null;
  }
  if (resolved.industry) return taxonomyTargetsForIndustry(resolved.industry);
  if (resolved.sector) return taxonomyTargetsForSector(resolved.sector);
  return null;
}
