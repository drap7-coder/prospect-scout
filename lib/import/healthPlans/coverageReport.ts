import type { Organization } from "@/lib/discovery/organization";
import { getHealthPlanOrganizations } from "./memoryIndex";
import {
  getHealthPlanCatalogImportManifest,
  countDuplicateOrganizationIds,
  countOrganizationsByConnector,
} from "./catalogManifest";
import { cmsImportMode } from "./cms/resolvePaths";
import { shouldUseOrganizationWarehouse } from "@/lib/import/warehouse/featureFlag";
import { US_STATES_AND_DC, STATE_BASED_MARKETPLACE_STATES } from "./cms/stateExchange";
import { findPossibleDuplicates, type PossibleDuplicateReview } from "./cms/identityEnrichment";

export interface HealthPlanCoverageReport {
  generatedAt: string;
  runtimeMode: "warehouse" | "bootstrap-seed";
  cmsImportMode: "production" | "fixture";
  totalCanonicalHealthPlans: number;
  countBySource: Record<string, number>;
  countByMarket: {
    medicareAdvantage: number;
    partD: number;
    acaMarketplace: number;
    medicaidManagedCare: number;
    commercial: number;
    bcbs: number;
    providerSponsored: number;
  };
  countByState: Record<string, number>;
  missingStates: string[];
  sbeStatesCovered: string[];
  sbeStatesMissing: string[];
  duplicateOrganizationIds: number;
  possibleDuplicateCount: number;
  possibleDuplicates: PossibleDuplicateReview[];
  lastImportAt: string | null;
  netNewOrganizationsFromLatestImport: number | null;
  netNewQhpFromServiceArea: number | null;
  netNewMedicaidFromEnrollment: number | null;
  mergeCount: number | null;
  cmsStats: ReturnType<typeof getHealthPlanCatalogImportManifest> extends infer M
    ? M extends { cmsStats: infer S }
      ? S | null
      : null
    : null;
}

const NATIONAL_CARRIER_PATTERNS = [
  /unitedhealth/i,
  /cigna/i,
  /elevance/i,
  /anthem/i,
  /humana/i,
  /centene/i,
  /molina/i,
  /kaiser/i,
  /aetna/i,
];

const BCBS_PATTERN = /blue cross|blue shield|bcbs/i;
const PROVIDER_SPONSORED_PATTERN = /geisinger|upmc|intermountain|sentara|spectrum/i;

function classifyMarketTags(org: Organization): {
  partD: boolean;
  commercial: boolean;
  bcbs: boolean;
  providerSponsored: boolean;
} {
  const name = `${org.canonicalName} ${org.aliases.join(" ")}`;
  const tags = org.tags ?? [];
  return {
    partD: tags.includes("part-d") || /part d|pdp/i.test(name),
    commercial: tags.includes("commercial") || org.healthPlanType === "aca_marketplace",
    bcbs: BCBS_PATTERN.test(name),
    providerSponsored: PROVIDER_SPONSORED_PATTERN.test(name),
  };
}

/** Full health plan coverage report for diagnostics page and audits. */
export function computeHealthPlanCoverageReport(
  organizations: Organization[] = getHealthPlanOrganizations(),
): HealthPlanCoverageReport {
  const manifest = getHealthPlanCatalogImportManifest();
  const possibleDuplicates =
    manifest?.possibleDuplicates ??
    findPossibleDuplicates(
      organizations.map((organization) => ({ organization, externalIds: [] })),
    );
  const countByState: Record<string, number> = {};
  const countByMarket = {
    medicareAdvantage: 0,
    partD: 0,
    acaMarketplace: 0,
    medicaidManagedCare: 0,
    commercial: 0,
    bcbs: 0,
    providerSponsored: 0,
  };

  for (const org of organizations) {
    for (const state of org.states) {
      countByState[state] = (countByState[state] ?? 0) + 1;
    }
    if (org.healthPlanType === "medicare_advantage") countByMarket.medicareAdvantage += 1;
    if (org.healthPlanType === "aca_marketplace") countByMarket.acaMarketplace += 1;
    if (org.healthPlanType === "medicaid_managed_care") countByMarket.medicaidManagedCare += 1;

    const tags = classifyMarketTags(org);
    if (tags.partD) countByMarket.partD += 1;
    if (tags.commercial) countByMarket.commercial += 1;
    if (tags.bcbs) countByMarket.bcbs += 1;
    if (tags.providerSponsored) countByMarket.providerSponsored += 1;
  }

  const missingStates = US_STATES_AND_DC.filter((state) => !countByState[state]);
  const sbeStatesCovered = [...STATE_BASED_MARKETPLACE_STATES].filter(
    (state) => (countByState[state] ?? 0) > 0,
  );
  const sbeStatesMissing = [...STATE_BASED_MARKETPLACE_STATES].filter(
    (state) => !countByState[state],
  );

  const catalogEntries = organizations.map((organization) => ({
    organization,
    externalIds: [] as { idType: string; idValue: string }[],
  }));
  void catalogEntries;

  return {
    generatedAt: new Date().toISOString(),
    runtimeMode: shouldUseOrganizationWarehouse() ? "warehouse" : "bootstrap-seed",
    cmsImportMode: cmsImportMode(),
    totalCanonicalHealthPlans: organizations.length,
    countBySource: countOrganizationsByConnector(organizations),
    countByMarket,
    countByState,
    missingStates: [...missingStates],
    sbeStatesCovered,
    sbeStatesMissing,
    duplicateOrganizationIds: countDuplicateOrganizationIds(organizations),
    possibleDuplicateCount: possibleDuplicates.length,
    possibleDuplicates: possibleDuplicates.slice(0, 50),
    lastImportAt: manifest?.importedAt ?? null,
    netNewOrganizationsFromLatestImport: manifest?.organizations.added ?? null,
    netNewQhpFromServiceArea: manifest?.cmsStats?.qhpNetNewFromServiceArea ?? null,
    netNewMedicaidFromEnrollment: manifest?.cmsStats?.medicaidNetNewFromEnrollment ?? null,
    mergeCount: manifest?.organizations.merged ?? null,
    cmsStats: manifest?.cmsStats ?? null,
  };
}
