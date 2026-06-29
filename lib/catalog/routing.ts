import type { SearchIntent } from "@/lib/discovery/intent";
import type { SearchState } from "@/lib/search/searchState";
import {
  CATALOG_INDEX,
  INDUSTRY_CATALOG,
} from "./registry";
import type { IndustryCatalogNode } from "./types";
import type { CatalogCoverageStatus, CatalogCoverageSummary } from "./types";

const COVERAGE_LABELS: Record<CatalogCoverageStatus, CatalogCoverageSummary> = {
  warehouse: {
    status: "warehouse",
    label: "Warehouse",
    description: "Curated organization warehouse with full intelligence",
  },
  "live-discovery": {
    status: "live-discovery",
    label: "Live Discovery",
    description: "Multi-connector discovery — coverage expanding",
  },
  planned: {
    status: "planned",
    label: "Planned",
    description: "On the warehouse roadmap",
  },
};

export function coverageSummary(
  status: CatalogCoverageStatus,
): CatalogCoverageSummary {
  return COVERAGE_LABELS[status];
}

export function resolveCatalogNodeForIntent(
  intent: Pick<
    SearchIntent,
    "sectorId" | "industryId" | "organizationTypeId"
  > & {
    classificationFilter?: SearchIntent["classificationFilter"];
  },
): IndustryCatalogNode | null {
  let best: IndustryCatalogNode | null = null;
  let bestScore = -1;

  for (const node of CATALOG_INDEX.values()) {
    let score = 0;
    if (
      intent.classificationFilter?.namespace &&
      intent.classificationFilter.ids.length > 0 &&
      node.classificationNamespace === intent.classificationFilter.namespace &&
      node.classificationId &&
      intent.classificationFilter.ids.includes(node.classificationId)
    ) {
      score += 8;
    }
    if (
      intent.organizationTypeId &&
      node.organizationTypeId === intent.organizationTypeId
    ) {
      score += 4;
    }
    if (intent.industryId && node.industryId === intent.industryId) {
      score += 2;
    }
    if (intent.sectorId && node.sectorId === intent.sectorId) {
      score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }

  return bestScore > 0 ? best : null;
}

export function resolveCatalogNodeForSearchState(
  state: Pick<
    SearchState,
    "sector" | "industry" | "organizationType" | "classificationNamespace" | "classificationId"
  >,
): IndustryCatalogNode | null {
  return resolveCatalogNodeForIntent({
    sectorId: state.sector,
    industryId: state.industry,
    organizationTypeId: state.organizationType,
    classificationFilter:
      state.classificationNamespace && state.classificationId
        ? {
            namespace: state.classificationNamespace,
            ids: [state.classificationId],
          }
        : null,
  });
}

export function resolveCoverageForIntent(
  intent: Pick<
    SearchIntent,
    "sectorId" | "industryId" | "organizationTypeId"
  > & {
    classificationFilter?: SearchIntent["classificationFilter"];
  },
): CatalogCoverageStatus {
  const node = resolveCatalogNodeForIntent(intent);
  if (node) return node.coverage;

  if (intent.sectorId === "healthcare" || intent.sectorId === "manufacturing") {
    return "warehouse";
  }
  if (intent.sectorId || intent.industryId || intent.organizationTypeId) {
    return "live-discovery";
  }
  return "live-discovery";
}

export function intentUsesWarehouse(
  intent: Pick<
    SearchIntent,
    | "sectorId"
    | "industryId"
    | "organizationTypeId"
    | "classificationFilter"
  >,
  catalogNodeId?: string | null,
): boolean {
  if (catalogNodeId) {
    const node = CATALOG_INDEX.get(catalogNodeId);
    if (node?.coverage === "warehouse" || node?.warehouseBuyerPack) return true;
  }

  if (intent.classificationFilter?.namespace === "health-plans") return true;

  const node = resolveCatalogNodeForIntent(intent);
  if (node?.coverage === "warehouse") return true;

  if (intent.organizationTypeId === "health-plan") return true;

  const healthcareWarehouseOrgTypes = new Set(["pbm", "tpa"]);
  if (
    intent.organizationTypeId &&
    healthcareWarehouseOrgTypes.has(intent.organizationTypeId)
  ) {
    return true;
  }

  const manufacturingOrgTypes = new Set([
    "manufacturer",
    "food-beverage-company",
    "packaging-company",
    "consumer-goods-company",
    "chemical-company",
    "automotive-manufacturer",
    "pharma-manufacturer",
    "medical-device",
  ]);
  if (
    intent.organizationTypeId &&
    manufacturingOrgTypes.has(intent.organizationTypeId)
  ) {
    return true;
  }

  if (intent.sectorId === "manufacturing" && !intent.organizationTypeId) {
    return true;
  }

  if (
    intent.industryId === "payers" &&
    intent.organizationTypeId === "health-plan"
  ) {
    return true;
  }

  return false;
}

export function aggregateSectorCoverage(
  node: IndustryCatalogNode,
): CatalogCoverageStatus {
  if (node.coverage === "warehouse") return "warehouse";
  if (!node.children?.length) return node.coverage;

  let hasWarehouse = false;
  let hasLive = false;
  for (const child of node.children) {
    const c = aggregateSectorCoverage(child);
    if (c === "warehouse") hasWarehouse = true;
    if (c === "live-discovery") hasLive = true;
  }
  if (hasWarehouse && !hasLive) return "warehouse";
  if (hasWarehouse) return "warehouse";
  if (hasLive) return "live-discovery";
  return node.coverage;
}

export function catalogWarehouseNodeCount(): number {
  let n = 0;
  for (const node of CATALOG_INDEX.values()) {
    if (node.coverage === "warehouse") n += 1;
  }
  return n;
}

export function catalogNodesByPhase(phase: 1 | 2 | 3 | 4): IndustryCatalogNode[] {
  return [...CATALOG_INDEX.values()].filter((n) => n.phase === phase);
}

export { INDUSTRY_CATALOG, COVERAGE_LABELS };
