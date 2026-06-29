import type { SearchState } from "@/lib/search/searchState";
import type { SearchIntent } from "@/lib/discovery/intent";
import { getCatalogNode } from "./registry";
import { buildQueryFromCatalogNode, catalogNodeSupportsEmptyQuery } from "./launch";
import type { CatalogCoverageStatus, IndustryCatalogNode } from "./types";
import { intentUsesWarehouse } from "./routing";

export type DiscoveryRouteMode = "warehouse" | "live-discovery" | "planned";

/** Apply catalog node taxonomy defaults onto search state (explicit fields win). */
export function hydrateSearchStateFromCatalog(state: SearchState): SearchState {
  if (!state.catalogNodeId) return state;
  const node = getCatalogNode(state.catalogNodeId);
  if (!node) return state;

  return {
    ...state,
    sector: state.sector ?? node.sectorId ?? null,
    industry: state.industry ?? node.industryId ?? null,
    organizationType:
      state.organizationType ?? node.organizationTypeId ?? null,
    classificationNamespace:
      state.classificationNamespace ?? node.classificationNamespace ?? null,
    classificationId:
      state.classificationId ?? node.classificationId ?? null,
    query:
      state.query.trim() ||
      (catalogNodeSupportsEmptyQuery(node) ? "" : buildQueryFromCatalogNode(node)),
  };
}

/** Whether the UI/API can run a search for this state (query or catalog/taxonomy). */
export function searchIsExecutable(state: SearchState): boolean {
  const hydrated = hydrateSearchStateFromCatalog(state);
  return Boolean(
    hydrated.query.trim() ||
      hydrated.catalogNodeId ||
      hydrated.sector ||
      hydrated.industry ||
      hydrated.organizationType ||
      hydrated.state ||
      (hydrated.classificationNamespace && hydrated.classificationId),
  );
}

export function shouldUseWarehouseForCatalogNode(
  catalogNodeId: string | null | undefined,
): boolean {
  if (!catalogNodeId) return false;
  const node = getCatalogNode(catalogNodeId);
  if (!node) return false;
  return node.coverage === "warehouse" || Boolean(node.warehouseBuyerPack);
}

export function resolveDiscoveryRouteMode(input: {
  intent: Pick<
    SearchIntent,
    | "sectorId"
    | "industryId"
    | "organizationTypeId"
    | "classificationFilter"
  >;
  catalogNodeId?: string | null;
}): DiscoveryRouteMode {
  if (input.catalogNodeId) {
    const node = getCatalogNode(input.catalogNodeId);
    if (node?.coverage === "planned") return "planned";
    if (shouldUseWarehouseForCatalogNode(input.catalogNodeId)) return "warehouse";
    if (node?.coverage === "live-discovery") return "live-discovery";
  }
  if (intentUsesWarehouse(input.intent)) return "warehouse";
  return "live-discovery";
}

export function catalogNodeForSearchState(
  state: Pick<SearchState, "catalogNodeId">,
): IndustryCatalogNode | undefined {
  if (!state.catalogNodeId) return undefined;
  return getCatalogNode(state.catalogNodeId);
}

export function catalogCoverageStatus(
  catalogNodeId: string | null | undefined,
): CatalogCoverageStatus | null {
  if (!catalogNodeId) return null;
  return getCatalogNode(catalogNodeId)?.coverage ?? null;
}
