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

export function buildQueryFromCatalogNode(node: IndustryCatalogNode): string {
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
    query: buildQueryFromCatalogNode(node),
    sector: node.sectorId ?? null,
    industry: node.industryId ?? null,
    organizationType: node.organizationTypeId ?? null,
  });
}

export function catalogNodeIsSearchable(node: IndustryCatalogNode): boolean {
  if (node.coverage === "planned" && !node.sectorId && !node.industryId) {
    return false;
  }
  return true;
}
