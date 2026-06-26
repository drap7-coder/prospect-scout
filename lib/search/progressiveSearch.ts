import type { SearchState } from "./searchState";

/** Builds the POST body shared across progressive search phases. */
export function searchRequestBody(state: SearchState): Record<string, unknown> {
  return {
    query: state.query,
    industry: state.industry,
    organizationType: state.organizationType,
    location: state.location,
    companySize: state.companySize,
    sellerContext: state.sellerContext,
  };
}
