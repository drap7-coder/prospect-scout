import type { Organization } from "@/lib/discovery/organization";
import type { CmsImportStats } from "./cms/types";
import type { PossibleDuplicateReview } from "./cms/identityEnrichment";
import type { RegressionFinding } from "./importRegression";

export interface HealthPlanCatalogImportManifest {
  importedAt: string;
  mode: "production" | "fixture" | "bootstrap-seed";
  includeBootstrapSeed: boolean;
  cmsImportMode: "production" | "fixture";
  rawRecords: {
    cpsc: number;
    qhp: number;
    medicaid: number;
    medicaidEnrollment: number;
  };
  organizations: {
    total: number;
    merged: number;
    added: number;
    duplicateIds: number;
  };
  byHealthPlanType: {
    medicareAdvantage: number;
    acaMarketplace: number;
    medicaidManagedCare: number;
  };
  bySourceConnector: Record<string, number>;
  cmsStats: CmsImportStats;
  identityEnrichmentApplied: number;
  possibleDuplicatesNeedsReview: number;
  regressionFindings: RegressionFinding[];
  possibleDuplicates: import("./cms/identityEnrichment").PossibleDuplicateReview[];
}

let lastManifest: HealthPlanCatalogImportManifest | null = null;

export function setHealthPlanCatalogImportManifest(
  manifest: HealthPlanCatalogImportManifest,
): void {
  lastManifest = manifest;
}

export function getHealthPlanCatalogImportManifest(): HealthPlanCatalogImportManifest | null {
  return lastManifest;
}

export function countDuplicateOrganizationIds(organizations: Organization[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const org of organizations) {
    if (seen.has(org.id)) duplicates += 1;
    else seen.add(org.id);
  }
  return duplicates;
}

export function countOrganizationsByConnector(
  organizations: Organization[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const org of organizations) {
    for (const source of org.sources) {
      counts[source.connector] = (counts[source.connector] ?? 0) + 1;
    }
  }
  return counts;
}
