import type { Organization } from "@/lib/discovery/organization";
import { finalizeOrganization } from "@/lib/discovery/organization";
import type { SearchIntent } from "@/lib/discovery/intent";
import {
  filterIncompatibleOrganizations,
  limitResults,
  rankOrganizations,
  type RankedOrganization,
} from "@/lib/discovery/rank";
import { orgMatchesIntent } from "@/lib/discovery/catalog/catalogIndex";
import {
  classificationMatchesIntent,
  geographyMatchesIntent,
  organizationMatchesSignificantQueryText,
  significantQueryTerms,
} from "@/lib/import/warehouse/organizationCapabilities";
import { getWarehouseOrganizations } from "./organizations";
import { shouldUseOrganizationWarehouse } from "./featureFlag";

export interface WarehousePipelineStage {
  stage: string;
  count: number;
  removed: number;
  reason: string;
  codePath: string;
}

export interface WarehouseSearchPipelineTrace {
  query: string;
  warehouseEnabled: boolean;
  stages: WarehousePipelineStage[];
  warehouseTotal: number;
  matchingIntent: number;
  afterFilter: number;
  afterRank: number;
  returned: number;
}

function orgMatchesWarehouseQuery(org: Organization, intent: SearchIntent): boolean {
  if (!geographyMatchesIntent(org, intent)) return false;
  if (!classificationMatchesIntent(org, intent)) return false;
  if (!orgMatchesIntent(org, intent)) return false;

  const terms = significantQueryTerms(intent);
  if (terms.length > 0) {
    return organizationMatchesSignificantQueryText(org, intent);
  }
  return true;
}

function warehouseOrganizationsForIntent(intent: SearchIntent): Organization[] {
  const all = getWarehouseOrganizations().map((org) => finalizeOrganization(org));
  if (intent.organizationTypeId === "health-plan") {
    return all.filter(
      (org) =>
        org.buyerPack === "health-plans" || org.canonicalOrganizationType === "health-plan",
    );
  }
  if (
    intent.organizationTypeId === "manufacturer" ||
    intent.sectorId === "manufacturing"
  ) {
    return all.filter(
      (org) =>
        org.buyerPack === "manufacturers" || org.canonicalOrganizationType === "manufacturer",
    );
  }
  return all;
}

/** Trace the health-plan (or any) query through warehouse-only search stages. */
export function traceWarehouseSearchPipeline(
  intent: SearchIntent,
  maxResults = 5000,
): WarehouseSearchPipelineTrace {
  const stages: WarehousePipelineStage[] = [];
  const warehouseOrgs = warehouseOrganizationsForIntent(intent);
  const warehouseTotal = getWarehouseOrganizations().length;

  stages.push({
    stage: "Organization Warehouse",
    count: warehouseTotal,
    removed: 0,
    reason:
      "All canonical organizations across warehouse connectors (scoped subset used when intent specifies org type).",
    codePath: "lib/import/warehouse/organizations.ts → getWarehouseOrganizations()",
  });

  stages.push({
    stage: "CatalogIndex",
    count: warehouseOrgs.length,
    removed: warehouseTotal - warehouseOrgs.length,
    reason:
      "Scoped to connector buyer pack matching query intent (e.g. health-plans only for health plan queries).",
    codePath: "lib/import/warehouse/discover.ts → warehouseOrganizationsForIntent()",
  });

  const matching = warehouseOrgs.filter((org) => orgMatchesWarehouseQuery(org, intent));
  stages.push({
    stage: "Organizations matching query",
    count: matching.length,
    removed: warehouseOrgs.length - matching.length,
    reason:
      "Removed orgs failing intent filters (sector, industry, org type, state, region) and query text match.",
    codePath: "lib/import/warehouse/discover.ts → orgMatchesWarehouseQuery()",
  });

  stages.push({
    stage: "Organizations after connector merge",
    count: matching.length,
    removed: 0,
    reason:
      "Warehouse orgs are pre-merged at import; search does not assemble connectors at runtime.",
    codePath: "lib/import/warehouse/discover.ts (warehouse-primary search)",
  });

  const ranked = rankOrganizations(matching, intent);
  stages.push({
    stage: "Organizations after ranking",
    count: ranked.length,
    removed: 0,
    reason: "Ranking reorders; does not drop candidates.",
    codePath: "lib/discovery/rank.ts → rankOrganizations()",
  });

  const filtered = filterIncompatibleOrganizations(ranked, intent);
  stages.push({
    stage: "Organizations after filtering",
    count: filtered.length,
    removed: ranked.length - filtered.length,
    reason:
      "Removed low-relevance orgs with sector/industry/org-type mismatches (relevance thresholds).",
    codePath: "lib/discovery/rank.ts → filterIncompatibleOrganizations()",
  });

  const limited = limitResults(filtered, maxResults);
  stages.push({
    stage: "Organizations returned to UI",
    count: limited.length,
    removed: filtered.length - limited.length,
    reason: `Capped at maxResults=${maxResults}.`,
    codePath: "lib/discovery/rank.ts → limitResults()",
  });

  return {
    query: intent.query,
    warehouseEnabled: shouldUseOrganizationWarehouse(),
    stages,
    warehouseTotal,
    matchingIntent: matching.length,
    afterFilter: filtered.length,
    afterRank: ranked.length,
    returned: limited.length,
  };
}

export interface WarehouseDiscoverResult {
  organizations: RankedOrganization[];
  totalMatching: number;
  totalAfterFilter: number;
  totalReturned: number;
  trace: WarehouseSearchPipelineTrace;
}

/** Search exclusively against the Organization Warehouse index. */
export function discoverFromOrganizationWarehouse(
  intent: SearchIntent,
  options: { maxResults?: number } = {},
): WarehouseDiscoverResult {
  const maxResults = options.maxResults ?? 5000;
  const trace = traceWarehouseSearchPipeline(intent, maxResults);
  const warehouseOrgs = warehouseOrganizationsForIntent(intent);
  const matching = warehouseOrgs.filter((org) => orgMatchesWarehouseQuery(org, intent));
  const ranked = rankOrganizations(matching, intent);
  const filtered = filterIncompatibleOrganizations(ranked, intent);
  const limited = limitResults(filtered, maxResults);

  return {
    organizations: limited,
    totalMatching: matching.length,
    totalAfterFilter: filtered.length,
    totalReturned: limited.length,
    trace,
  };
}
