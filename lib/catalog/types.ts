import type { BuyerPackId } from "@/lib/search/types";

/** How organizations in this catalog node are sourced at search time. */
export type CatalogCoverageStatus = "warehouse" | "live-discovery" | "planned";

/** Roadmap phase for warehouse expansion (informational). */
export type CatalogPhase = 1 | 2 | 3 | 4;

/**
 * A node in the Industry Catalog — sectors, sub-industries, and org types.
 * Maps to taxonomy ids for search launch; coverage drives discovery routing.
 */
export interface IndustryCatalogNode {
  id: string;
  label: string;
  description: string;
  coverage: CatalogCoverageStatus;
  phase?: CatalogPhase;
  /** Optional display icon (emoji). */
  icon?: string;
  /** Taxonomy mapping — used to build SearchState when launching search. */
  sectorId?: string;
  industryId?: string;
  organizationTypeId?: string;
  /** When set, warehouse discovery scopes to this buyer pack. */
  warehouseBuyerPack?: BuyerPackId;
  /** Warehouse classification filter (e.g. health-plan LOB). */
  classificationNamespace?: string;
  classificationId?: string;
  children?: IndustryCatalogNode[];
}

export interface CatalogCoverageSummary {
  status: CatalogCoverageStatus;
  label: string;
  description: string;
}
