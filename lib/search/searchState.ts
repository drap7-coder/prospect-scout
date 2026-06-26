import type { BuyerPackId, RawSearchInput } from "./types";
import { inferRegionFromText, normalizeRegion, ANY_REGION } from "./regions";

/** Structured search state for the company-discovery workflow. */
export interface SearchState {
  query: string;
  industry: string | null;
  organizationType: string | null;
  location: string | null;
  companySize: string | null;
  signals: string[];
  sources: string[];
  /** Optional advanced seller context (not required for search). */
  sellerContext: string | null;
}

export const EMPTY_SEARCH_STATE: SearchState = {
  query: "",
  industry: null,
  organizationType: null,
  location: null,
  companySize: null,
  signals: [],
  sources: [],
  sellerContext: null,
};

export const INDUSTRIES = [
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Financial Services",
  "Public Sector",
] as const;

export const ORGANIZATION_TYPES = [
  { id: "health-plan", label: "Health Plan", buyerPack: "health-plans" as BuyerPackId },
  { id: "hospital", label: "Hospital / Health System", buyerPack: "health-systems" as BuyerPackId },
  { id: "manufacturer", label: "Manufacturer", buyerPack: "manufacturers" as BuyerPackId },
  { id: "employer", label: "Employer", buyerPack: "employers" as BuyerPackId },
  { id: "municipality", label: "Municipality", buyerPack: "public-sector" as BuyerPackId },
  { id: "university", label: "University", buyerPack: "employers" as BuyerPackId },
] as const;

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

export const SIGNAL_FILTERS = [
  { id: "leadership-change", label: "Leadership Change" },
  { id: "growth-expansion", label: "Growth / Expansion" },
  { id: "regulatory-pressure", label: "Regulatory Pressure" },
  { id: "fda-recall", label: "FDA Recall" },
  { id: "cms-enrollment", label: "CMS Enrollment Growth" },
  { id: "star-ratings", label: "Star Ratings Pressure" },
  { id: "sec-filing", label: "SEC Filing Event" },
  { id: "hiring", label: "Hiring" },
  { id: "partnership-acquisition", label: "Partnership / Acquisition" },
] as const;

export const SOURCE_FILTERS = [
  { id: "CMS", label: "CMS" },
  { id: "SEC", label: "SEC EDGAR" },
  { id: "FDA", label: "FDA" },
  { id: "RSS", label: "RSS / News" },
  { id: "Public Web", label: "Public Web" },
  { id: "Mock", label: "Mock" },
] as const;

export const EXAMPLE_SEARCHES = [
  "Regional health plans in Pennsylvania",
  "Food manufacturers in Ohio",
  "Hospitals with merger activity",
  "Medicare Advantage plans in the Mid-Atlantic",
  "Manufacturers with FDA recalls",
  "Employers with benefits cost pressure",
] as const;

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  Healthcare: ["health", "hospital", "medicare", "medicaid", "payer", "clinical"],
  Manufacturing: ["manufacturer", "manufacturing", "plant", "factory", "food", "packaging"],
  Retail: ["retail", "store", "consumer", "grocery"],
  "Financial Services": ["bank", "financial", "insurance", "capital"],
  "Public Sector": ["municipal", "government", "public sector", "county", "city"],
};

const ORG_TYPE_KEYWORDS: Record<string, string[]> = {
  "health-plan": ["health plan", "payer", "medicare advantage", "mco", "insurer"],
  hospital: ["hospital", "health system", "medical center", "idn", "provider"],
  manufacturer: ["manufacturer", "manufacturing", "plant", "factory", "cpg"],
  employer: ["employer", "benefits", "workforce", "self-insured"],
  municipality: ["municipal", "municipality", "city", "county", "government"],
  university: ["university", "college", "campus", "higher ed"],
};

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

/** Reads structured search state from URL search params. */
export function parseSearchStateFromParams(
  params: URLSearchParams,
): SearchState {
  return {
    query: params.get("q") ?? "",
    industry: params.get("industry"),
    organizationType: params.get("org"),
    location: params.get("location"),
    companySize: params.get("size"),
    signals: parseList(params.get("signals")),
    sources: parseList(params.get("sources")),
    sellerContext: params.get("seller"),
  };
}

/** Serializes search state to URL search params (omits empty values). */
export function searchStateToParams(state: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.query.trim()) p.set("q", state.query.trim());
  if (state.industry) p.set("industry", state.industry);
  if (state.organizationType) p.set("org", state.organizationType);
  if (state.location) p.set("location", state.location);
  if (state.companySize) p.set("size", state.companySize);
  if (state.signals.length) p.set("signals", state.signals.join(","));
  if (state.sources.length) p.set("sources", state.sources.join(","));
  if (state.sellerContext?.trim()) p.set("seller", state.sellerContext.trim());
  return p;
}

/** Infers optional filter fields from natural-language query text. */
export function inferSearchStateFromQuery(query: string): Partial<SearchState> {
  const hay = query.toLowerCase();
  const inferred: Partial<SearchState> = {};

  for (const industry of INDUSTRIES) {
    if (INDUSTRY_KEYWORDS[industry]?.some((kw) => hay.includes(kw))) {
      inferred.industry = industry;
      break;
    }
  }

  for (const org of ORGANIZATION_TYPES) {
    if (ORG_TYPE_KEYWORDS[org.id]?.some((kw) => hay.includes(kw))) {
      inferred.organizationType = org.id;
      break;
    }
  }

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
    signals: state.signals.length ? state.signals : (inferred.signals ?? []),
    sources: state.sources.length ? state.sources : (inferred.sources ?? []),
  };
}

function orgTypeToBuyerPack(orgId: string | null): BuyerPackId | undefined {
  if (!orgId) return undefined;
  return ORGANIZATION_TYPES.find((o) => o.id === orgId)?.buyerPack;
}

function industryToBuyerPack(industry: string | null): BuyerPackId | undefined {
  if (!industry) return undefined;
  const map: Record<string, BuyerPackId> = {
    Healthcare: "health-plans",
    Manufacturing: "manufacturers",
    Retail: "manufacturers",
    "Financial Services": "employers",
    "Public Sector": "public-sector",
  };
  return map[industry];
}

function locationToRegion(location: string | null): string | undefined {
  if (!location || location === "nationwide") return ANY_REGION;
  if (location === "mountain-west") return "west";
  return normalizeRegion(location);
}

/** Maps UI search state to the existing API / pipeline input shape. */
export function searchStateToRawInput(state: SearchState): RawSearchInput {
  const resolved = resolveSearchState(state);
  const buyerPack =
    orgTypeToBuyerPack(resolved.organizationType) ??
    industryToBuyerPack(resolved.industry);

  return {
    query: resolved.query.trim(),
    sells: resolved.sellerContext?.trim() ?? "",
    targets: resolved.query.trim(),
    buyerPack,
    region: locationToRegion(resolved.location),
  };
}

export function locationLabel(id: string | null): string {
  if (!id || id === "nationwide") return "Nationwide";
  return LOCATIONS.find((l) => l.id === id)?.label ?? id;
}

export function orgTypeLabel(id: string | null): string {
  if (!id) return "";
  return ORGANIZATION_TYPES.find((o) => o.id === id)?.label ?? id;
}

/** Human-readable summary for the results header. */
export function describeSearch(state: SearchState): string {
  const resolved = resolveSearchState(state);
  const parts: string[] = [];

  if (resolved.query.trim()) {
    parts.push(resolved.query.trim());
  } else {
    if (resolved.organizationType) parts.push(orgTypeLabel(resolved.organizationType));
    else if (resolved.industry) parts.push(resolved.industry.toLowerCase());
    else parts.push("organizations");
  }

  if (resolved.location && resolved.location !== "nationwide") {
    parts.push(`in ${locationLabel(resolved.location)}`);
  }

  if (parts.length === 1 && !resolved.query.trim()) {
    return `Showing opportunities for ${parts[0]}`;
  }

  return `Showing opportunities for ${parts.join(" ")}`;
}

export function mountainWestRegions(): string[] {
  return ["west", "southwest"];
}
