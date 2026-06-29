import {
  EMPTY_SEARCH_STATE,
  resolveSearchState,
  type SearchState,
} from "@/lib/search/searchState";
import {
  industryLabel,
  organizationTypeLabel,
  sectorLabel,
} from "@/lib/taxonomy";
import type { IndustryCatalogNode } from "./types";

/** Warehouse catalog nodes can search on taxonomy/classification alone (no free text). */
export function catalogNodeSupportsEmptyQuery(node: IndustryCatalogNode): boolean {
  return (
    node.coverage === "warehouse" &&
    Boolean(
      node.sectorId ||
        node.industryId ||
        node.organizationTypeId ||
        node.classificationId,
    )
  );
}

export function buildQueryFromCatalogNode(node: IndustryCatalogNode): string {
  if (node.classificationId && node.label) {
    return node.label.toLowerCase();
  }
  if (node.organizationTypeId) {
    return organizationTypeLabel(node.organizationTypeId).toLowerCase();
  }
  if (node.industryId) {
    return industryLabel(node.industryId).toLowerCase();
  }
  if (node.sectorId) {
    return sectorLabel(node.sectorId).toLowerCase();
  }
  return node.label.toLowerCase();
}

export function catalogNodeToSearchState(
  node: IndustryCatalogNode,
): SearchState {
  return resolveSearchState({
    ...EMPTY_SEARCH_STATE,
    catalogNodeId: node.id,
    query: catalogNodeSupportsEmptyQuery(node)
      ? ""
      : buildQueryFromCatalogNode(node),
    sector: node.sectorId ?? null,
    industry: node.industryId ?? null,
    organizationType: node.organizationTypeId ?? null,
    classificationNamespace: node.classificationNamespace ?? null,
    classificationId: node.classificationId ?? null,
  });
}

export function catalogNodeIsSearchable(node: IndustryCatalogNode): boolean {
  if (node.coverage === "planned" && !node.sectorId && !node.industryId) {
    return false;
  }
  return true;
}
