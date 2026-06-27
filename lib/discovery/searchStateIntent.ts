import { parseSearchIntent } from "./intent";
import type { SearchIntent } from "./intent";
import { resolveSearchState, type SearchState } from "@/lib/search/searchState";

/** Map UI search state to discovery intent for catalog faceting. */
export function searchStateToDiscoveryIntent(state: SearchState): SearchIntent {
  const resolved = resolveSearchState(state);
  return parseSearchIntent(resolved.query, {
    sectorId: resolved.sector,
    industryId: resolved.industry,
    organizationTypeId: resolved.organizationType,
    state: resolved.state,
    region:
      resolved.location && resolved.location !== "nationwide"
        ? resolved.location
        : null,
  });
}
