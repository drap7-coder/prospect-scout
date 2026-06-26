import type { SearchState } from "./searchState";
import { locationLabel } from "./searchState";
import {
  industryLabel,
  organizationTypeLabel,
  sectorLabel,
} from "@/lib/taxonomy";
import { US_STATE_FILTERS } from "@/lib/taxonomy/data";

export const BUILDER_OWNERSHIP_OPTIONS = [
  { id: "public", label: "Public" },
  { id: "private", label: "Private" },
  { id: "nonprofit", label: "Nonprofit" },
  { id: "government", label: "Government" },
  { id: "education", label: "Education" },
] as const;

export const BUILDER_SIZE_OPTIONS = [
  { id: "Small", label: "Small" },
  { id: "Mid-Market", label: "Mid-market" },
  { id: "Large", label: "Large" },
  { id: "Enterprise", label: "Enterprise" },
] as const;

/** Homepage signal options — map to results filter signal ids where supported. */
export const BUILDER_SIGNAL_OPTIONS = [
  { id: "recent-news", label: "Recent news", signalId: "growth-expansion" },
  { id: "hiring", label: "Hiring activity", signalId: "hiring" },
  { id: "sec-filings", label: "SEC filings", signalId: "sec-filing" },
  { id: "government-contracts", label: "Government contracts", signalId: "growth-expansion" },
  { id: "regulatory", label: "Regulatory activity", signalId: "regulatory-pressure" },
  { id: "funding", label: "Funding / investment", signalId: "partnership-acquisition" },
  { id: "expansion", label: "Expansion / new locations", signalId: "growth-expansion" },
  { id: "website-changes", label: "Website changes", signalId: "hiring" },
  { id: "public-datasets", label: "Public datasets", signalId: null },
] as const;

/** Homepage source options — map to client-side source filter ids. */
export const BUILDER_SOURCE_OPTIONS = [
  { id: "SEC", label: "SEC", filterId: "SEC" },
  { id: "CMS", label: "CMS", filterId: "CMS" },
  { id: "FDA", label: "FDA", filterId: "FDA" },
  { id: "IRS", label: "IRS nonprofit data", filterId: "Directory" },
  { id: "SAM", label: "SAM.gov / contracts", filterId: "Public Web" },
  { id: "RSS", label: "News / RSS", filterId: "RSS" },
  { id: "WEB", label: "Website", filterId: "Public Web" },
  { id: "DIR", label: "Public directories", filterId: "Directory" },
] as const;

export const BUILDER_SORT_OPTIONS = [
  { id: "score", label: "Most relevant" },
  { id: "freshness", label: "Most recent signal" },
  { id: "evidence", label: "Most signals" },
  { id: "size", label: "Largest organizations" },
  { id: "name", label: "Alphabetical" },
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
