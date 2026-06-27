import { resolveSearchState, type SearchState } from "./searchState";

/** Builds the POST body shared across progressive search phases. */
export function searchRequestBody(state: SearchState): Record<string, unknown> {
  const resolved = resolveSearchState(state);
  return {
    query: resolved.query,
    sector: resolved.sector,
    industry: resolved.industry,
    organizationType: resolved.organizationType,
    location: resolved.location,
    companySize: resolved.companySize,
    freshness: resolved.freshness,
    sellerContext: resolved.sellerContext,
    ownership: resolved.ownership,
    state: resolved.state,
    metro: resolved.metro,
    opStates: resolved.operatingStates.join(","),
    sort: resolved.sort,
  };
}
