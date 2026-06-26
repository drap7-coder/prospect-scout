export { TAXONOMY_SECTORS } from "./sectors";
export { TAXONOMY_INDUSTRIES } from "./industries";
export { TAXONOMY_ORGANIZATION_TYPES } from "./organizationTypes";
export { TAXONOMY_SIGNAL_FILTERS } from "./signals";
export {
  SOURCE_SUMMARY_LABELS,
  TAXONOMY_SOURCE_FILTERS,
} from "./sources";

/** Display label for pipeline target — used instead of legacy buyer-pack names. */
export const TAXONOMY_TARGET_LABELS: Record<string, string> = {
  "health-plans": "Health Plan",
  "health-systems": "Health System",
  manufacturers: "Manufacturer",
  employers: "Organization",
  "public-sector": "Public Agency",
};

export const FRESHNESS_FILTERS = [
  { id: "any", label: "Any time" },
  { id: "30d", label: "Last 30 days", maxDays: 30 },
  { id: "90d", label: "Last 90 days", maxDays: 90 },
  { id: "12mo", label: "Last 12 months", maxDays: 365 },
] as const;

export const EXAMPLE_SEARCHES = [
  "Manufacturers in Ohio",
  "Nonprofits in Pennsylvania",
  "Public companies with recent SEC filings",
  "Restaurants expanding in Texas",
  "Software companies hiring sales leaders",
  "Construction firms in the Midwest",
  "Universities with research activity",
  "Government contractors in Virginia",
] as const;

/** Ownership filter options for results and builder. */
export const OWNERSHIP_FILTERS = [
  { id: "public", label: "Public company" },
  { id: "private", label: "Private company" },
  { id: "nonprofit", label: "Nonprofit" },
  { id: "government", label: "Government" },
  { id: "education", label: "Education" },
] as const;

/** US state options for location filtering. */
export const US_STATE_FILTERS = [
  { id: "OH", label: "Ohio" },
  { id: "PA", label: "Pennsylvania" },
  { id: "NY", label: "New York" },
  { id: "VA", label: "Virginia" },
  { id: "TX", label: "Texas" },
  { id: "FL", label: "Florida" },
  { id: "CA", label: "California" },
  { id: "IL", label: "Illinois" },
  { id: "MI", label: "Michigan" },
  { id: "GA", label: "Georgia" },
  { id: "NC", label: "North Carolina" },
  { id: "NJ", label: "New Jersey" },
  { id: "MA", label: "Massachusetts" },
  { id: "WA", label: "Washington" },
  { id: "CO", label: "Colorado" },
] as const;
