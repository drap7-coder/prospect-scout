import type { SearchState } from "./searchState";

/** Builds the POST body shared across progressive search phases. */
export function searchRequestBody(state: SearchState): Record<string, unknown> {
  return {
    query: state.query,
    sector: state.sector,
    industry: state.industry,
    organizationType: state.organizationType,
    location: state.location,
    companySize: state.companySize,
    freshness: state.freshness,
    sellerContext: state.sellerContext,
  };
}
