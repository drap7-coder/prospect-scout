export type {
  CatalogCoverageStatus,
  CatalogCoverageSummary,
  CatalogPhase,
  IndustryCatalogNode,
} from "./types";

export {
  INDUSTRY_CATALOG,
  CATALOG_INDEX,
  buildCatalogIndex,
  getCatalogNode,
  topLevelCatalogNodes,
} from "./registry";

export {
  coverageSummary,
  resolveCatalogNodeForIntent,
  resolveCatalogNodeForSearchState,
  resolveCoverageForIntent,
  intentUsesWarehouse,
  aggregateSectorCoverage,
  catalogWarehouseNodeCount,
  catalogNodesByPhase,
  COVERAGE_LABELS,
} from "./routing";

export {
  hydrateSearchStateFromCatalog,
  searchIsExecutable,
  shouldUseWarehouseForCatalogNode,
  resolveDiscoveryRouteMode,
  catalogNodeForSearchState,
  catalogCoverageStatus,
} from "./normalize";

export type { DiscoveryRouteMode } from "./normalize";

export {
  buildQueryFromCatalogNode,
  catalogNodeSupportsEmptyQuery,
  catalogNodeToSearchState,
  catalogNodeIsSearchable,
} from "./launch";
