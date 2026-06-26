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
  "Regional health plans in Pennsylvania",
  "Humana Medicare Advantage",
  "PepsiCo",
  "Food manufacturers in Ohio",
  "Hospitals with merger activity",
  "Municipalities in the Mid-Atlantic",
  "Universities with workforce growth",
  "Banks in the Northeast",
] as const;

/** Ownership filter options for results rail. */
export const OWNERSHIP_FILTERS = [
  { id: "public", label: "Public company" },
  { id: "private", label: "Private company" },
] as const;

/** US state options for location filtering. */
export const US_STATE_FILTERS = [
  { id: "OH", label: "Ohio" },
  { id: "PA", label: "Pennsylvania" },
  { id: "NY", label: "New York" },
  { id: "MI", label: "Michigan" },
  { id: "IL", label: "Illinois" },
  { id: "CA", label: "California" },
  { id: "TX", label: "Texas" },
  { id: "FL", label: "Florida" },
  { id: "NJ", label: "New Jersey" },
  { id: "MA", label: "Massachusetts" },
] as const;
