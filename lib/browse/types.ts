import type { DiscoveryRow } from "@/lib/discovery/discoveryRows";
import type { Prospect } from "@/lib/search/types";
import type { BuyerPackId } from "@/lib/search/types";
import type { SearchState } from "@/lib/search/searchState";

/** Browse lens — how carousel rows are grouped (not list/table presentation). */
export type BrowseLensId = "category" | "geography" | "opportunity" | "alphabet";

export interface BrowseLensDefinition {
  id: BrowseLensId;
  label: string;
  description: string;
}

export interface BrowseRowSummaryMetric {
  label: string;
  value: string;
}

export interface BrowseRowViewAll {
  label: string;
  filterPatch: Partial<SearchState>;
}

/** Extended discovery row for multi-dimensional browse. */
export interface BrowseRow extends DiscoveryRow {
  /** Full bucket size (equals prospects.length when uncapped). */
  totalCount: number;
  summaryMetrics?: BrowseRowSummaryMetric[];
  viewAll?: BrowseRowViewAll;
}

export interface BrowseContext {
  searchState: SearchState;
  /** Dominant buyer pack in current results, when known. */
  primaryBuyerPack: BuyerPackId | null;
  sectorId: string | null;
  industryId: string | null;
  organizationTypeId: string | null;
}

/** Connector-registered browse group (Layer 2 — not UI hard-coding). */
export interface BrowseGroupSpec {
  id: string;
  title: string;
  description: string;
  order: number;
  match: (prospect: Prospect) => boolean;
  viewAll?: BrowseRowViewAll;
}

export interface BrowseConnectorRegistration {
  buyerPacks: BuyerPackId[];
  /** Optional lens label overrides per connector. */
  lensLabels?: Partial<Record<BrowseLensId, string>>;
  categoryGroups: BrowseGroupSpec[];
}
