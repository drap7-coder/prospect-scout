import type { Organization } from "@/lib/discovery/organization";
import { getHealthPlanOrganizations } from "./memoryIndex";
import {
  getHealthPlanCatalogImportManifest,
  countDuplicateOrganizationIds,
  countOrganizationsByConnector,
} from "./catalogManifest";
import { cmsImportMode } from "./cms/resolvePaths";
import { shouldUseOrganizationWarehouse } from "@/lib/import/warehouse/featureFlag";

export interface HealthPlanCatalogDiagnostics {
  runtimeMode: "warehouse" | "bootstrap-seed";
  cmsImportMode: "production" | "fixture";
  totalHealthPlans: number;
  medicareAdvantage: number;
  medicaidMcos: number;
  marketplaceIssuers: number;
  bcbsOrganizations: number;
  nationalCarriers: number;
  regionalCarriers: number;
  providerSponsoredPlans: number;
  statesRepresented: number;
  states: string[];
  organizationsBySource: Record<string, number>;
  duplicateOrganizationIds: number;
  mergeCount: number | null;
  addedInLastImport: number | null;
  lastImportAt: string | null;
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

function classifyOrg(org: Organization): {
  bcbs: boolean;
  national: boolean;
  regional: boolean;
  providerSponsored: boolean;
} {
  const name = `${org.canonicalName} ${org.aliases.join(" ")}`;
  const national = NATIONAL_CARRIER_PATTERNS.some((pattern) => pattern.test(name));
  const bcbs = BCBS_PATTERN.test(name);
  const providerSponsored = PROVIDER_SPONSORED_PATTERN.test(name);
  const regional =
    !national &&
    org.states.length > 0 &&
    org.states.length <= 8 &&
    !org.regions.includes("national");
  return { bcbs, national, regional, providerSponsored };
}

/** Health plan catalog diagnostics for the /diagnostics page and audits. */
export function computeHealthPlanCatalogDiagnostics(
  organizations: Organization[] = getHealthPlanOrganizations(),
): HealthPlanCatalogDiagnostics {
  const manifest = getHealthPlanCatalogImportManifest();
  const states = new Set<string>();
  let medicareAdvantage = 0;
  let medicaidMcos = 0;
  let marketplaceIssuers = 0;
  let bcbsOrganizations = 0;
  let nationalCarriers = 0;
  let regionalCarriers = 0;
  let providerSponsoredPlans = 0;

  for (const org of organizations) {
    for (const state of org.states) states.add(state);
    if (org.healthPlanType === "medicare_advantage") medicareAdvantage += 1;
    if (org.healthPlanType === "medicaid_managed_care") medicaidMcos += 1;
    if (org.healthPlanType === "aca_marketplace") marketplaceIssuers += 1;

    const tags = classifyOrg(org);
    if (tags.bcbs) bcbsOrganizations += 1;
    if (tags.national) nationalCarriers += 1;
    if (tags.regional) regionalCarriers += 1;
    if (tags.providerSponsored) providerSponsoredPlans += 1;
  }

  return {
    runtimeMode: shouldUseOrganizationWarehouse() ? "warehouse" : "bootstrap-seed",
    cmsImportMode: cmsImportMode(),
    totalHealthPlans: organizations.length,
    medicareAdvantage,
    medicaidMcos,
    marketplaceIssuers,
    bcbsOrganizations,
    nationalCarriers,
    regionalCarriers,
    providerSponsoredPlans,
    statesRepresented: states.size,
    states: [...states].sort(),
    organizationsBySource: countOrganizationsByConnector(organizations),
    duplicateOrganizationIds: countDuplicateOrganizationIds(organizations),
    mergeCount: manifest?.organizations.merged ?? null,
    addedInLastImport: manifest?.organizations.added ?? null,
    lastImportAt: manifest?.importedAt ?? null,
  };
}
