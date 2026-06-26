import type { SearchState } from "./searchState";
import { locationLabel } from "./searchState";
import {
  industryLabel,
  organizationTypeLabel,
  sectorLabel,
} from "@/lib/taxonomy";
import { US_STATE_FILTERS } from "@/lib/taxonomy/data";

export const BUILDER_OWNERSHIP_OPTIONS = [
  { id: "public", label: "Public companies", hint: "Listed on a stock exchange" },
  { id: "private", label: "Private companies", hint: "Not publicly traded" },
  { id: "nonprofit", label: "Nonprofits", hint: "Charities, foundations, NGOs" },
  { id: "government", label: "Government", hint: "Agencies and public bodies" },
  { id: "education", label: "Schools & universities", hint: "K-12, colleges, campuses" },
] as const;

export const BUILDER_SIZE_OPTIONS = [
  { id: "Small", label: "Small", hint: "Under ~200 employees" },
  { id: "Mid-Market", label: "Mid-size", hint: "Regional players" },
  { id: "Large", label: "Large", hint: "Major employers" },
  { id: "Enterprise", label: "Enterprise", hint: "National or global scale" },
] as const;

/** Featured sectors for the guided builder — full list remains available. */
export const BUILDER_FEATURED_SECTOR_IDS = [
  "manufacturing",
  "technology",
  "financial-services",
  "healthcare",
  "retail-consumer",
  "public-sector",
] as const;

export const BUILDER_SECTOR_HINTS: Record<string, string> = {
  healthcare: "Hospitals, payers, life sciences",
  manufacturing: "Plants, CPG, industrial",
  "financial-services": "Banks, insurance, fintech",
  "public-sector": "Agencies, cities, transit",
  "retail-consumer": "Retail chains, consumer brands",
  technology: "Software, SaaS, platforms",
  education: "Universities, school districts",
  "real-estate-construction": "Developers, contractors",
  "energy-utilities": "Power, oil & gas, utilities",
  "transportation-logistics": "Shipping, freight, airlines",
  "professional-services": "Consulting, legal, staffing",
  "hospitality-leisure": "Hotels, restaurants, travel",
  nonprofit: "Foundations and charities",
};

/** Homepage signal options — map to results filter signal ids where supported. */
export const BUILDER_SIGNAL_OPTIONS = [
  { id: "recent-news", label: "In the news", hint: "Recent headlines", signalId: "growth-expansion" },
  { id: "hiring", label: "Hiring", hint: "Open roles & growth", signalId: "hiring" },
  { id: "sec-filings", label: "SEC filings", hint: "Public company disclosures", signalId: "sec-filing" },
  { id: "government-contracts", label: "Gov contracts", hint: "Federal & state awards", signalId: "growth-expansion" },
  { id: "regulatory", label: "Regulatory activity", hint: "Compliance & enforcement", signalId: "regulatory-pressure" },
  { id: "funding", label: "Funding rounds", hint: "Investment & M&A", signalId: "partnership-acquisition" },
  { id: "expansion", label: "Expanding", hint: "New locations or markets", signalId: "growth-expansion" },
  { id: "website-changes", label: "Website updates", hint: "Recent site changes", signalId: "hiring" },
  { id: "public-datasets", label: "Public records", hint: "Government & registry data", signalId: null },
] as const;

/** Homepage source options — map to client-side source filter ids. */
export const BUILDER_SOURCE_OPTIONS = [
  { id: "SEC", label: "SEC filings", hint: "Public company records", filterId: "SEC" },
  { id: "CMS", label: "Medicare & Medicaid", hint: "CMS public data", filterId: "CMS" },
  { id: "FDA", label: "FDA records", hint: "Recalls & enforcement", filterId: "FDA" },
  { id: "IRS", label: "Nonprofit filings", hint: "IRS 990 data", filterId: "Directory" },
  { id: "SAM", label: "Government contracts", hint: "SAM.gov & awards", filterId: "Public Web" },
  { id: "RSS", label: "News feeds", hint: "Headlines & press", filterId: "RSS" },
  { id: "WEB", label: "Websites", hint: "Public web pages", filterId: "Public Web" },
  { id: "DIR", label: "Directories", hint: "Industry & registry lists", filterId: "Directory" },
] as const;

export const BUILDER_SORT_OPTIONS = [
  { id: "score", label: "Best match", hint: "Most relevant overall" },
  { id: "freshness", label: "Most recent", hint: "Newest signals first" },
  { id: "evidence", label: "Most signals", hint: "Richest evidence" },
  { id: "size", label: "Largest", hint: "Biggest organizations" },
  { id: "name", label: "A → Z", hint: "Alphabetical" },
] as const;

export type BuilderSortId = (typeof BUILDER_SORT_OPTIONS)[number]["id"];

export interface ProspectListBuilderState extends SearchState {
  metro: string | null;
  operatingStates: string[];
  builderSignals: string[];
  builderSources: string[];
  sort: BuilderSortId | null;
}

export const EMPTY_BUILDER_STATE: ProspectListBuilderState = {
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
  builderSignals: [],
  builderSources: [],
  sort: "score",
};

const OWNERSHIP_PHRASES: Record<string, string> = {
  public: "public companies",
  private: "private companies",
  nonprofit: "nonprofits",
  government: "government organizations",
  education: "universities and colleges",
};

const SIGNAL_QUERY_PHRASES: Record<string, string> = {
  "recent-news": "with recent news",
  hiring: "with hiring activity",
  "sec-filings": "with recent SEC filings",
  "government-contracts": "government contractors",
  regulatory: "with regulatory activity",
  funding: "with recent funding",
  expansion: "expanding",
  "website-changes": "with website updates",
  "public-datasets": "from public datasets",
};

function stateLabel(code: string): string {
  return US_STATE_FILTERS.find((s) => s.id === code)?.label ?? code;
}

/** Converts builder selections into a natural-language search query. */
export function buildSearchQueryFromBuilder(
  state: ProspectListBuilderState,
): string {
  const chunks: string[] = [];

  if (state.ownership && OWNERSHIP_PHRASES[state.ownership]) {
    chunks.push(OWNERSHIP_PHRASES[state.ownership]);
  } else if (state.organizationType) {
    chunks.push(organizationTypeLabel(state.organizationType).toLowerCase());
  } else if (state.industry) {
    chunks.push(industryLabel(state.industry).toLowerCase());
  } else if (state.sector) {
    chunks.push(sectorLabel(state.sector).toLowerCase());
  } else {
    chunks.push("organizations");
  }

  if (state.companySize && state.companySize !== "Small") {
    chunks.push(state.companySize.toLowerCase());
  }

  const loc: string[] = [];
  if (state.metro?.trim()) loc.push(state.metro.trim());
  if (state.state) loc.push(stateLabel(state.state));
  if (state.location && state.location !== "nationwide") {
    loc.push(locationLabel(state.location));
  }
  if (state.operatingStates.length > 0) {
    loc.push(
      `operating in ${state.operatingStates.map(stateLabel).join(", ")}`,
    );
  }
  if (loc.length > 0) chunks.push(`in ${loc.join(", ")}`);

  for (const sig of state.builderSignals) {
    const phrase = SIGNAL_QUERY_PHRASES[sig];
    if (phrase) chunks.push(phrase);
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

/** Maps builder UI state to URL-serializable search state. */
export function builderToSearchState(
  builder: ProspectListBuilderState,
): SearchState {
  const signalIds = new Set<string>();
  for (const id of builder.builderSignals) {
    const opt = BUILDER_SIGNAL_OPTIONS.find((o) => o.id === id);
    if (opt?.signalId) signalIds.add(opt.signalId);
  }

  const sourceIds = new Set<string>();
  for (const id of builder.builderSources) {
    const opt = BUILDER_SOURCE_OPTIONS.find((o) => o.id === id);
    if (opt?.filterId) sourceIds.add(opt.filterId);
  }

  const query =
    builder.query.trim() || buildSearchQueryFromBuilder(builder);

  return {
    query,
    sector: builder.sector,
    industry: builder.industry,
    organizationType: builder.organizationType,
    location: builder.location,
    companySize: builder.companySize,
    signals: [...signalIds],
    sources: [...sourceIds],
    freshness: builder.freshness,
    sellerContext: null,
    ownership: builder.ownership,
    state: builder.state,
    metro: builder.metro?.trim() || null,
    operatingStates: builder.operatingStates,
    sort: builder.sort && builder.sort !== "score" ? builder.sort : null,
  };
}

export function hasBuilderFilters(builder: ProspectListBuilderState): boolean {
  return Boolean(
    builder.industry ||
      builder.organizationType ||
      builder.sector ||
      builder.ownership ||
      builder.companySize ||
      builder.location ||
      builder.state ||
      builder.metro?.trim() ||
      builder.operatingStates.length ||
      builder.builderSignals.length ||
      builder.builderSources.length ||
      builder.freshness,
  );
}
