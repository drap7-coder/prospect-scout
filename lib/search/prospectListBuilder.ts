import type { SearchState } from "./searchState";
import { locationLabel } from "./searchState";
import {
  canonicalOrgTypeLabel,
  isCanonicalOrgTypeId,
} from "@/lib/discovery/canonicalOrgType";
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

interface BuilderStarterCategory {
  cardId: string;
  label: string;
  sectorId: string;
  industry?: string | null;
  organizationType?: string | null;
  ownership?: string | null;
  builderSources?: string[];
  builderSignals?: string[];
}

/** Primary starter searches shown in Step 1 of the guided builder. */
export const BUILDER_PRIMARY_CATEGORIES: BuilderStarterCategory[] = [
  {
    cardId: "healthcare",
    label: "Healthcare",
    sectorId: "healthcare",
  },
  {
    cardId: "manufacturers",
    label: "Manufacturers",
    sectorId: "manufacturing",
    industry: "industrial-products",
    organizationType: "manufacturer",
  },
  {
    cardId: "financial-services",
    label: "Financial Services",
    sectorId: "financial-services",
  },
  {
    cardId: "universities",
    label: "Universities",
    sectorId: "education",
    industry: "universities",
    organizationType: "university",
  },
  {
    cardId: "nonprofits",
    label: "Nonprofits",
    sectorId: "nonprofit",
    industry: "nonprofit",
    organizationType: "nonprofit",
    ownership: "nonprofit",
  },
  {
    cardId: "government-agencies",
    label: "Government Agencies",
    sectorId: "public-sector",
    industry: "state-agencies",
    organizationType: "government",
    ownership: "government",
  },
  {
    cardId: "public-companies",
    label: "Public Companies",
    sectorId: "technology",
    organizationType: "employer",
    ownership: "public",
    builderSources: ["SEC"],
    builderSignals: ["sec-filings"],
  },
] as const;

/** @deprecated Use BUILDER_PRIMARY_CATEGORIES */
export const BUILDER_FEATURED_SECTOR_IDS = BUILDER_PRIMARY_CATEGORIES.map(
  (c) => c.sectorId,
);

/** A guided industry entry point shown on the homepage hero. */
export interface HomepageIndustrySelector {
  id: string;
  label: string;
  description: string;
  emoji: string;
  /** null = no sector constraint (broad org-type search). */
  sectorId: string | null;
  industry?: string | null;
  organizationType?: string | null;
  ownership?: string | null;
  /** Matching BUILDER_PRIMARY_CATEGORIES cardId, when one exists. */
  builderCardId?: string;
}

/**
 * Homepage industry selector — the primary entry point into the builder flow.
 * Each option reuses existing taxonomy ids (sector / industry / organization
 * type) so it preloads the guided builder with a valid selection.
 */
export const HOMEPAGE_INDUSTRY_SELECTORS: HomepageIndustrySelector[] = [
  {
    id: "health-plans",
    label: "Health Plans",
    description: "Insurance companies and health plan organizations.",
    emoji: "🩺",
    sectorId: "healthcare",
    industry: "payers",
    organizationType: "health-plan",
    builderCardId: "healthcare",
  },
  {
    id: "hospitals",
    label: "Hospitals & Health Systems",
    description: "Hospitals, health systems, and clinics.",
    emoji: "🏥",
    sectorId: "healthcare",
    industry: "providers",
    organizationType: "hospital-health-system",
    builderCardId: "healthcare",
  },
  {
    id: "pbm-pharmacy",
    label: "PBMs / Pharmacy",
    description: "Pharmacy benefit managers and pharmacy services.",
    emoji: "💊",
    sectorId: "healthcare",
    industry: "payers",
    organizationType: "pbm",
    builderCardId: "healthcare",
  },
  {
    id: "manufacturers",
    label: "Manufacturers",
    description: "Industrial, consumer, and specialty manufacturers.",
    emoji: "🏭",
    sectorId: "manufacturing",
    industry: "industrial-products",
    organizationType: "manufacturer",
    builderCardId: "manufacturers",
  },
  {
    id: "employers",
    label: "Employers",
    description: "Mid-market and enterprise employer organizations.",
    emoji: "🏢",
    sectorId: null,
    organizationType: "employer",
  },
  {
    id: "nonprofits",
    label: "Nonprofits",
    description: "Nonprofit organizations and associations.",
    emoji: "🤝",
    sectorId: "nonprofit",
    industry: "nonprofit",
    organizationType: "nonprofit",
    ownership: "nonprofit",
    builderCardId: "nonprofits",
  },
  {
    id: "financial-services",
    label: "Financial Services",
    description: "Banks, credit unions, and financial institutions.",
    emoji: "🏦",
    sectorId: "financial-services",
    builderCardId: "financial-services",
  },
  {
    id: "restaurants-hospitality",
    label: "Restaurants / Hospitality",
    description: "Restaurants, hospitality groups, and venues.",
    emoji: "🍽️",
    sectorId: "hospitality-leisure",
    industry: "hospitality",
  },
];

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

/** Secondary sector cards for users who want a broader taxonomy entry point. */
export const BUILDER_SECONDARY_CATEGORIES = [
  { cardId: "healthcare", sectorId: "healthcare", label: "Healthcare" },
  { cardId: "technology", sectorId: "technology", label: "Technology" },
  { cardId: "financial-services", sectorId: "financial-services", label: "Financial Services" },
  { cardId: "public-sector", sectorId: "public-sector", label: "Public Sector" },
  { cardId: "education", sectorId: "education", label: "Education" },
  { cardId: "construction", sectorId: "real-estate-construction", label: "Construction" },
  { cardId: "retail", sectorId: "retail-consumer", label: "Retail" },
  { cardId: "logistics", sectorId: "transportation-logistics", label: "Logistics" },
  {
    cardId: "food-beverage",
    sectorId: "manufacturing",
    label: "Food & Beverage",
    industry: "food-beverage",
  },
] as const;

/** Featured org-type refinements shown before industry chips. */
export const BUILDER_ORG_TYPE_REFINEMENTS: Record<
  string,
  { id: string; label: string; sectorId: string; industry?: string | null }[]
> = {
  healthcare: [
    { id: "health-plan", label: "Health Plans", sectorId: "healthcare", industry: "payers" },
    { id: "pbm", label: "PBMs", sectorId: "healthcare", industry: "payers" },
    { id: "hospital-health-system", label: "Hospitals", sectorId: "healthcare", industry: "providers" },
    { id: "provider-group", label: "Provider Groups", sectorId: "healthcare", industry: "providers" },
    { id: "pharma-manufacturer", label: "Pharma", sectorId: "healthcare", industry: "life-sciences" },
    { id: "medical-device", label: "Medical Device", sectorId: "healthcare", industry: "life-sciences" },
  ],
  manufacturing: [
    { id: "manufacturer", label: "Manufacturers", sectorId: "manufacturing", industry: "industrial-products" },
    { id: "food-beverage-company", label: "Food & Beverage", sectorId: "manufacturing", industry: "food-beverage" },
    { id: "chemical-company", label: "Chemicals", sectorId: "manufacturing", industry: "chemicals" },
    { id: "packaging-company", label: "Packaging", sectorId: "manufacturing", industry: "packaging" },
    { id: "automotive-manufacturer", label: "Automotive", sectorId: "manufacturing", industry: "automotive" },
    { id: "manufacturer", label: "Industrial", sectorId: "manufacturing", industry: "industrial-products" },
  ],
  "financial-services": [
    { id: "bank", label: "Banks", sectorId: "financial-services", industry: "banks" },
    { id: "credit-union", label: "Credit Unions", sectorId: "financial-services", industry: "credit-unions" },
    { id: "insurance-carrier", label: "Insurance Carriers", sectorId: "financial-services", industry: "insurance-carriers" },
    { id: "asset-manager", label: "Asset Managers", sectorId: "financial-services", industry: "asset-managers" },
    { id: "fintech-company", label: "Fintech", sectorId: "financial-services", industry: "fintech" },
  ],
  education: [
    { id: "university", label: "Universities", sectorId: "education", industry: "universities" },
    { id: "community-college", label: "Community Colleges", sectorId: "education", industry: "community-colleges" },
    { id: "school-district", label: "School Districts", sectorId: "education", industry: "school-districts" },
    { id: "private-school", label: "Private Schools", sectorId: "education", industry: "private-schools" },
  ],
  "public-sector": [
    { id: "government", label: "Government Agencies", sectorId: "public-sector", industry: "state-agencies" },
    { id: "municipality", label: "Municipalities", sectorId: "public-sector", industry: "municipalities" },
    { id: "transit-authority", label: "Transit Authorities", sectorId: "public-sector", industry: "transit-authorities" },
  ],
  nonprofit: [
    { id: "nonprofit", label: "Nonprofits", sectorId: "nonprofit", industry: "nonprofit" },
  ],
};

/** Homepage signal options — map only to supported signal/source filters. */
export const BUILDER_SIGNAL_OPTIONS = [
  { id: "hiring", label: "Hiring", hint: "Open roles and growth", signalId: "hiring" },
  { id: "recent-news", label: "Recent news", hint: "Headlines and press", sourceId: "RSS" },
  { id: "expansion", label: "Growth / expansion", hint: "New locations or markets", signalId: "growth-expansion" },
  { id: "funding", label: "Funding / awards", hint: "Investment and awards", signalId: "partnership-acquisition" },
  { id: "sec-filings", label: "SEC filings", hint: "Public disclosures", signalId: "sec-filing" },
  { id: "regulatory", label: "Regulatory activity", hint: "Compliance and enforcement", signalId: "regulatory-pressure" },
  { id: "leadership", label: "Leadership changes", hint: "Executive movement", signalId: "leadership-change" },
] as const;

/** Homepage source options — map to client-side source filter ids. */
export const BUILDER_SOURCE_OPTIONS = [
  { id: "SEC", label: "SEC filings", hint: "Public company records", filterId: "SEC" },
  { id: "CMS", label: "CMS data", hint: "Medicare & Medicaid", filterId: "CMS" },
  { id: "FDA", label: "FDA records", hint: "Recalls & enforcement", filterId: "FDA" },
  { id: "WEB", label: "Public web", hint: "Public web pages", filterId: "Public Web" },
  { id: "RSS", label: "News", hint: "Headlines & press", filterId: "RSS" },
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
  classificationNamespace: null,
  classificationId: null,
  metro: null,
  operatingStates: [],
  builderSignals: [],
  builderSources: [],
  sort: "score",
  catalogNodeId: null,
};

/** Seeds a guided-builder state from a homepage industry selection. */
export function industrySelectorToBuilderState(
  selector: HomepageIndustrySelector,
): ProspectListBuilderState {
  return {
    ...EMPTY_BUILDER_STATE,
    sector: selector.sectorId,
    industry: selector.industry ?? null,
    organizationType: selector.organizationType ?? null,
    ownership: selector.ownership ?? null,
  };
}

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

function orgTypeDisplayLabel(id: string | null): string {
  if (!id) return "";
  if (isCanonicalOrgTypeId(id)) return canonicalOrgTypeLabel(id);
  return organizationTypeLabel(id);
}

type StructuredSelectionState = Pick<
  SearchState,
  "sector" | "industry" | "organizationType" | "ownership"
>;

export interface StructuredSelectionDisplay {
  primaryLabel: string;
  secondaryLabel: string | null;
  hiddenDuplicateFields: Array<keyof StructuredSelectionState>;
}

function normalizeDisplayLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(companies|company|organizations|organization|systems|system)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/s$/g, "");
}

function labelsOverlap(a: string, b: string): boolean {
  const left = normalizeDisplayLabel(a);
  const right = normalizeDisplayLabel(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function addSecondaryLabel(
  parts: string[],
  primaryLabel: string,
  label: string | null,
): boolean {
  if (!label) return false;
  if (labelsOverlap(primaryLabel, label)) return false;
  if (parts.some((part) => labelsOverlap(part, label))) return false;
  parts.push(label);
  return true;
}

/**
 * Formats structured taxonomy selections for humans while preserving the raw
 * SearchState underneath. This prevents UI-only chains like
 * "Health Plan / Payers / Healthcare" without changing search semantics.
 */
export function formatStructuredSelectionDisplay(
  state: Partial<StructuredSelectionState>,
): StructuredSelectionDisplay {
  const sector = state.sector ? sectorLabel(state.sector) : null;
  const industry = state.industry ? industryLabel(state.industry) : null;
  const orgType = state.organizationType
    ? orgTypeDisplayLabel(state.organizationType)
    : null;
  const hiddenDuplicateFields: Array<keyof StructuredSelectionState> = [];

  let primaryLabel = orgType ?? industry ?? sector ?? "Organizations";
  let forcedSecondary: string | null = null;

  if (state.organizationType === "health-plan") {
    primaryLabel = "Health Plans";
  } else if (state.organizationType === "hospital-health-system") {
    primaryLabel = "Hospitals & Health Systems";
  } else if (state.organizationType === "pbm") {
    primaryLabel = "PBMs / Pharmacy";
    forcedSecondary = "Pharmacy · Benefit Management";
  } else if (state.organizationType === "manufacturer") {
    primaryLabel = "Manufacturers";
  } else if (state.organizationType === "employer") {
    primaryLabel = state.ownership === "public" ? "Public Companies" : "Employers";
  } else if (state.organizationType === "nonprofit") {
    primaryLabel = "Nonprofits";
  } else if (
    !state.organizationType &&
    state.sector === "hospitality-leisure" &&
    state.industry === "hospitality"
  ) {
    primaryLabel = "Restaurants / Hospitality";
  }

  const secondaryParts: string[] = [];
  if (forcedSecondary) {
    secondaryParts.push(forcedSecondary);
  } else {
    if (sector && !addSecondaryLabel(secondaryParts, primaryLabel, sector)) {
      hiddenDuplicateFields.push("sector");
    }
    if (industry && !addSecondaryLabel(secondaryParts, primaryLabel, industry)) {
      hiddenDuplicateFields.push("industry");
    }
  }

  if (orgType && labelsOverlap(primaryLabel, orgType)) {
    hiddenDuplicateFields.push("organizationType");
  }

  return {
    primaryLabel,
    secondaryLabel: secondaryParts.length > 0 ? secondaryParts.join(" · ") : null,
    hiddenDuplicateFields,
  };
}

/** Converts builder selections into a natural-language search query. */
export function buildSearchQueryFromBuilder(
  state: ProspectListBuilderState,
): string {
  const chunks: string[] = [];

  if (state.ownership && OWNERSHIP_PHRASES[state.ownership]) {
    chunks.push(OWNERSHIP_PHRASES[state.ownership]);
  } else if (state.organizationType) {
    chunks.push(orgTypeDisplayLabel(state.organizationType).toLowerCase());
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
    if (opt && "signalId" in opt && opt.signalId) signalIds.add(opt.signalId);
  }

  const sourceIds = new Set<string>();
  for (const id of builder.builderSignals) {
    const opt = BUILDER_SIGNAL_OPTIONS.find((o) => o.id === id);
    if (opt && "sourceId" in opt && opt.sourceId) sourceIds.add(opt.sourceId);
  }
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
    classificationNamespace: builder.classificationNamespace,
    classificationId: builder.classificationId,
    metro: builder.metro?.trim() || null,
    operatingStates: builder.operatingStates,
    sort: builder.sort && builder.sort !== "score" ? builder.sort : null,
    catalogNodeId: builder.catalogNodeId ?? null,
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
  const display = formatStructuredSelectionDisplay(state);
  let subject = display.primaryLabel.toLowerCase();

  if (state.ownership) {
    const own = BUILDER_OWNERSHIP_OPTIONS.find((o) => o.id === state.ownership);
    if (own && !labelsOverlap(subject, own.label)) {
      subject = `${own.label.toLowerCase()} ${subject}`;
    }
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
