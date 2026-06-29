import { resolveSearchState, type SearchState } from "./searchState";
import { searchIsExecutable } from "@/lib/catalog/normalize";

export { searchIsExecutable };

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
    classificationNamespace: resolved.classificationNamespace,
    classificationId: resolved.classificationId,
    catalogNodeId: resolved.catalogNodeId,
    catalog: resolved.catalogNodeId,
    metro: resolved.metro,
    opStates: resolved.operatingStates.join(","),
    sort: resolved.sort,
  };
}
