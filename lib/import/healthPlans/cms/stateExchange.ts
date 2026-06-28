/** States operating a State-Based Marketplace (SBM) or SBM-FP in PY2025. */
export const STATE_BASED_MARKETPLACE_STATES = new Set([
  "CA",
  "CO",
  "CT",
  "DC",
  "ID",
  "KY",
  "ME",
  "MD",
  "MA",
  "MN",
  "NV",
  "NJ",
  "NM",
  "NY",
  "OR",
  "PA",
  "RI",
  "VT",
  "VA",
  "WA",
]);

export const US_STATES_AND_DC = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

export type UsStateCode = (typeof US_STATES_AND_DC)[number];

/** Infer marketplace type from state participation model. */
export function marketplaceForState(state: string): "HealthCare.gov" | "State-Based" {
  return STATE_BASED_MARKETPLACE_STATES.has(state.toUpperCase())
    ? "State-Based"
    : "HealthCare.gov";
}
