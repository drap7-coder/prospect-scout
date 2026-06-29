import type { Organization } from "@/lib/discovery/organization";
import { getWarehouseOrganizations } from "@/lib/import/warehouse/organizations";
import { readDomainIntelligence } from "@/lib/domainIntelligence/enrichOrganization";
import { DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD } from "@/lib/domainIntelligence/types";
import { rollupAllHealthPlanOrganizations } from "./rollup";
import type { EnterpriseProfile, EnterpriseRollupDiagnostics } from "./types";

function pct(n: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((n / total) * 1000) / 10;
}

function orgHasHighConfidenceDomain(org: Organization): boolean {
  const intel = readDomainIntelligence(org.sectorAttributes);
  return Boolean(intel?.domain && intel.confidence >= DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD);
}

function profileHasDomainChild(profile: EnterpriseProfile, orgs: Organization[]): boolean {
  const idSet = new Set(profile.sourceOrganizationIds);
  return orgs.some((org) => idSet.has(org.id) && orgHasHighConfidenceDomain(org));
}

/** Compute enterprise rollup diagnostics for warehouse health plans. */
export function computeEnterpriseRollupDiagnostics(
  organizations?: Organization[],
): EnterpriseRollupDiagnostics {
  const all = organizations ?? getWarehouseOrganizations();
  const healthPlans = all.filter(
    (o) => o.buyerPack === "health-plans" || o.canonicalOrganizationType === "health-plan",
  );
  const manufacturers = all.filter((o) => o.buyerPack === "manufacturers");

  const hpRollup = rollupAllHealthPlanOrganizations(healthPlans);
  const mfgRollup = rollupAllHealthPlanOrganizations(manufacturers);

  const profiles = hpRollup.profiles;
  const enterpriseProfilesWithDomain = profiles.filter((p) => p.canonicalDomain?.trim()).length;
  const enterpriseProfilesMissingDomain = profiles.filter((p) => !p.canonicalDomain?.trim()).length;

  const rawOrgsWithDomain = healthPlans.filter(orgHasHighConfidenceDomain).length;

  const enterpriseProfilesWithDomainBearingChildren = profiles.filter((p) =>
    profileHasDomainChild(p, healthPlans),
  ).length;

  const promotionFailureProfiles = profiles.filter(
    (p) => profileHasDomainChild(p, healthPlans) && !p.canonicalDomain?.trim(),
  );
  const promotionFailures = promotionFailureProfiles.length;

  const promotedFromChildRecords = profiles.filter(
    (p) =>
      p.canonicalDomain &&
      p.domainSource &&
      p.domainSource !== "curated_parent_mapping",
  ).length;

  const inheritedFromParentMappings = profiles.filter(
    (p) => p.canonicalDomain && p.domainSource === "curated_parent_mapping",
  ).length;

  const ambiguousEnterprises = profiles.filter((p) => p.domainAmbiguous).length;

  const promotionSuccessPct = pct(
    profiles.filter((p) => p.canonicalDomain && profileHasDomainChild(p, healthPlans)).length,
    enterpriseProfilesWithDomainBearingChildren,
  );

  const topEnterprisesMissingDomain = [...profiles]
    .filter((p) => !p.canonicalDomain?.trim())
    .sort((a, b) => b.childCount - a.childCount)
    .slice(0, 25)
    .map((p) => ({ name: p.name, id: p.id, childCount: p.childCount }));

  const topRollups = [...profiles]
    .sort((a, b) => b.childCount - a.childCount)
    .slice(0, 15)
    .map((p) => ({ name: p.name, id: p.id, childCount: p.childCount }));

  const avgChildren =
    profiles.length > 0
      ? Math.round(
          (profiles.reduce((sum, p) => sum + p.childCount, 0) / profiles.length) * 10,
        ) / 10
      : 0;

  const passthroughOrphans = hpRollup.orphanCount;

  return {
    generatedAt: new Date().toISOString(),
    rawOrganizationCount: all.length,
    searchResultCount: hpRollup.enterpriseCount,
    rollupProfileCount: profiles.length,
    passthroughOrphanCount: passthroughOrphans,
    passthroughOrphans,
    rawOrgDomainCoverage: {
      total: healthPlans.length,
      withDomain: rawOrgsWithDomain,
      pctDomain: pct(rawOrgsWithDomain, healthPlans.length),
    },
    enterpriseProfilesWithDomain,
    enterpriseProfilesMissingDomain,
    enterpriseProfilesWithDomainBearingChildren,
    promotionFailures,
    averageChildrenPerEnterprise: avgChildren,
    topRollupsByChildCount: topRollups,
    enterpriseDomainCoverage: {
      total: profiles.length,
      withDomain: enterpriseProfilesWithDomain,
      pctDomain: pct(enterpriseProfilesWithDomain, profiles.length),
    },
    domainPromotion: {
      promotedFromChildRecords,
      inheritedFromParentMappings,
      ambiguousEnterprises,
      missingCanonicalDomain: enterpriseProfilesMissingDomain,
      enterprisesWithDomainChildren: enterpriseProfilesWithDomainBearingChildren,
      promotionSuccessPct,
    },
    topEnterprisesMissingDomain,
    suppressedChildRecords: hpRollup.suppressedChildCount,
    orphanOrganizations: passthroughOrphans,
    byBuyerPack: {
      "health-plans": { raw: healthPlans.length, enterprises: hpRollup.enterpriseCount },
      manufacturers: { raw: manufacturers.length, enterprises: mfgRollup.enterpriseCount },
    },
  };
}

import { canonicalEnterpriseId } from "./canonicalId";

export function findEnterpriseProfileById(
  enterpriseId: string,
  organizations?: Organization[],
): EnterpriseProfile | null {
  const all = organizations ?? getWarehouseOrganizations();
  const healthPlans = all.filter((o) => o.buyerPack === "health-plans");
  const rollup = rollupAllHealthPlanOrganizations(healthPlans);
  const normalized = canonicalEnterpriseId(enterpriseId.replace(/^enterprise:/, ""));
  return rollup.profiles.find((p) => canonicalEnterpriseId(p.id) === normalized) ?? null;
}

export function getSourceOrganizationsForEnterprise(
  enterpriseId: string,
  organizations?: Organization[],
): Organization[] {
  const profile = findEnterpriseProfileById(enterpriseId, organizations);
  if (!profile) return [];
  const all = organizations ?? getWarehouseOrganizations();
  const idSet = new Set(profile.sourceOrganizationIds);
  return all.filter((o) => idSet.has(o.id));
}
