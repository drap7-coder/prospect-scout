import type { SearchState } from "./searchState";
import { locationLabel } from "./searchState";
import {
  industryLabel,
  organizationTypeLabel,
  sectorLabel,
} from "@/lib/taxonomy";
import { US_STATE_FILTERS } from "@/lib/taxonomy/data";

export const BUILDER_OWNERSHIP_OPTIONS = [
  { id: "public", label: "Public", hint: "Listed on a stock exchange" },
  { id: "private", label: "Private", hint: "Not publicly traded" },
  { id: "government", label: "Government", hint: "Agencies and public bodies" },
  { id: "nonprofit", label: "Nonprofit", hint: "Charities and foundations" },
] as const;

export const BUILDER_SIZE_OPTIONS = [
  { id: "Small", label: "Small business", hint: "Under ~200 employees" },
  { id: "Mid-Market", label: "Mid-market", hint: "Regional players" },
  { id: "Large", label: "Enterprise", hint: "Major national employers" },
  { id: "Enterprise", label: "Global", hint: "Multinational scale" },
] as const;

/** Primary category cards shown in Step 1 of the guided builder. */
export const BUILDER_PRIMARY_CATEGORIES = [
  { cardId: "manufacturing", sectorId: "manufacturing", label: "Manufacturing" },
  { cardId: "technology", sectorId: "technology", label: "Technology" },
  { cardId: "healthcare", sectorId: "healthcare", label: "Healthcare" },
  { cardId: "public-sector", sectorId: "public-sector", label: "Government" },
  { cardId: "education", sectorId: "education", label: "Education" },
  { cardId: "financial-services", sectorId: "financial-services", label: "Financial Services" },
  { cardId: "construction", sectorId: "real-estate-construction", label: "Construction" },
  { cardId: "retail", sectorId: "retail-consumer", label: "Retail" },
  { cardId: "logistics", sectorId: "transportation-logistics", label: "Logistics" },
  {
    cardId: "agriculture",
    sectorId: "manufacturing",
    label: "Agriculture",
    presetIndustry: "food-beverage",
  },
] as const;

/** @deprecated Use BUILDER_PRIMARY_CATEGORIES */
export const BUILDER_FEATURED_SECTOR_IDS = BUILDER_PRIMARY_CATEGORIES.map(
  (c) => c.sectorId,
);

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
  { id: "hiring", label: "Hiring", hint: "Open roles and growth", signalId: "hiring" },
  { id: "recent-news", label: "In the news", hint: "Recent headlines", signalId: "growth-expansion" },
  { id: "expansion", label: "Expanding", hint: "New locations or markets", signalId: "growth-expansion" },
  { id: "funding", label: "Funding", hint: "Investment and M&A", signalId: "partnership-acquisition" },
  { id: "government-contracts", label: "Government contracts", hint: "Federal and state awards", signalId: "growth-expansion" },
  { id: "sec-filings", label: "SEC filings", hint: "Public disclosures", signalId: "sec-filing" },
  { id: "website-changes", label: "Website updates", hint: "Recent site changes", signalId: "hiring" },
  { id: "regulatory", label: "Regulatory activity", hint: "Compliance and enforcement", signalId: "regulatory-pressure" },
  { id: "new-products", label: "New products", hint: "Launches and announcements", signalId: "growth-expansion" },
  { id: "growth", label: "Growth", hint: "Footprint and revenue signals", signalId: "growth-expansion" },
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
  hiring: "that are hiring",
  "sec-filings": "with recent SEC filings",
  "government-contracts": "government contractors",
  regulatory: "with regulatory activity",
  funding: "with recent funding",
  expansion: "that are expanding",
  "website-changes": "with website updates",
  "new-products": "launching new products",
  growth: "showing growth",
};

const SIGNAL_SUMMARY_PHRASES: Record<string, string> = {
  hiring: "are hiring",
  "recent-news": "are in the news",
  expansion: "are expanding",
  funding: "have recent funding activity",
  "government-contracts": "have government contracts",
  "sec-filings": "have recent SEC filings",
  "website-changes": "have website updates",
  regulatory: "have regulatory activity",
  "new-products": "are launching new products",
  growth: "are showing growth",
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

function formatSignalList(phrases: string[]): string {
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0]!;
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(", ")}, and ${phrases.at(-1)}`;
}

/** Conversational one-line summary for the guided builder footer. */
export function buildNaturalLanguageSummary(
  state: ProspectListBuilderState,
): string {
  let subject = "organizations";

  if (state.organizationType) {
    subject = organizationTypeLabel(state.organizationType).toLowerCase();
  } else if (state.industry) {
    subject = `${industryLabel(state.industry).toLowerCase()} companies`;
  } else if (state.sector) {
    subject = `${sectorLabel(state.sector).toLowerCase()} companies`;
  }

  if (state.ownership) {
    const own = BUILDER_OWNERSHIP_OPTIONS.find((o) => o.id === state.ownership);
    if (own) subject = `${own.label.toLowerCase()} ${subject}`;
  }

  if (state.companySize) {
    const size = BUILDER_SIZE_OPTIONS.find((s) => s.id === state.companySize);
    if (size && state.companySize !== "Small") {
      subject = `${size.label.toLowerCase()} ${subject}`;
    }
  }

  const locParts: string[] = [];
  if (state.metro?.trim()) locParts.push(state.metro.trim());
  if (state.state) locParts.push(stateLabel(state.state));
  if (state.location === "nationwide") locParts.push("nationwide");
  else if (state.location && state.location !== "nationwide") {
    locParts.push(locationLabel(state.location));
  }
  if (state.operatingStates.length > 0) {
    locParts.push(
      `operating in ${state.operatingStates.map(stateLabel).join(", ")}`,
    );
  }

  const signalPhrases = state.builderSignals
    .map((id) => SIGNAL_SUMMARY_PHRASES[id])
    .filter(Boolean);

  let sentence = `We'll search for ${subject}`;
  if (locParts.length > 0) sentence += ` in ${locParts.join(", ")}`;
  if (signalPhrases.length > 0) {
    sentence += ` that ${formatSignalList(signalPhrases)}`;
  }
  return `${sentence}.`;
}
