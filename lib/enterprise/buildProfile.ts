import type { Organization } from "@/lib/discovery/organization";
import type { OrganizationClassification } from "@/lib/organization/model";
import { readDomainIntelligence } from "@/lib/domainIntelligence/enrichOrganization";
import { promoteEnterpriseDomain, enterpriseDomainIsAmbiguous } from "./promoteDomain";
import type { EnterpriseProfile, EnterpriseSegmentEvidence, ResolvedEnterpriseKey } from "./types";

function parseHq(headquarters: string | null | undefined): { city: string | null; state: string | null } {
  if (!headquarters?.trim()) return { city: null, state: null };
  const parts = headquarters.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const stateMatch = parts[parts.length - 1]!.match(/\b([A-Z]{2})\b/);
    return { city: parts[0] ?? null, state: stateMatch?.[1] ?? null };
  }
  const stateOnly = headquarters.match(/\b([A-Z]{2})\b/);
  return { city: null, state: stateOnly?.[1] ?? null };
}

function classificationIds(org: Organization): string[] {
  return (org.classifications ?? [])
    .filter((c) => c.namespace === "health-plans")
    .map((c) => c.id);
}

function childDomainForEvidence(org: Organization): string | null {
  const intel = readDomainIntelligence(org.sectorAttributes);
  if (intel?.domain && intel.confidence >= 0.85) return intel.domain;
  if (org.domain?.trim()) return org.domain;
  return null;
}

function segmentEvidenceFor(org: Organization): EnterpriseSegmentEvidence {
  return {
    sourceOrganizationId: org.id,
    sourceName: org.canonicalName,
    classificationIds: classificationIds(org),
    states: org.geography?.states ?? org.states ?? [],
    domain: childDomainForEvidence(org),
  };
}

function tickerFromOrg(org: Organization): string | null {
  const ext = org.externalIds?.find((e) => e.idType === "ticker");
  return ext?.idValue?.toUpperCase() ?? null;
}

function aggregateClassifications(orgs: Organization[]): string[] {
  const ids = new Set<string>();
  for (const org of orgs) {
    for (const id of classificationIds(org)) ids.add(id);
  }
  return [...ids].sort();
}

function aggregateStates(orgs: Organization[]): string[] {
  const states = new Set<string>();
  for (const org of orgs) {
    for (const s of org.geography?.states ?? org.states ?? []) {
      if (s) states.add(s.toUpperCase());
    }
  }
  return [...states].sort();
}

function aggregateOwnership(orgs: Organization[]): string[] {
  const types = new Set<string>();
  for (const org of orgs) {
    if (org.ownership) types.add(org.ownership);
  }
  return [...types];
}

/** Build one enterprise profile from a group of child organizations. */
export function buildEnterpriseProfile(
  key: ResolvedEnterpriseKey,
  children: Organization[],
): EnterpriseProfile {
  const registry = key.registryEntry;
  const operatingBrands = new Set<string>();
  const subsidiaries = new Set<string>();

  for (const child of children) {
    const name = child.canonicalName.trim();
    if (name && name !== key.displayName) {
      subsidiaries.add(name);
      operatingBrands.add(name);
    }
  }

  const promoted = promoteEnterpriseDomain({ key, children, registry });
  const ambiguous = enterpriseDomainIsAmbiguous(children);

  let totalCoveredLives = 0;
  let hasLives = false;
  let employees = 0;
  let hasEmployees = false;

  for (const child of children) {
    if (child.memberEstimate != null && child.memberEstimate > 0) {
      totalCoveredLives += child.memberEstimate;
      hasLives = true;
    }
    const emp = child.employeeRange ? Number(String(child.employeeRange).replace(/[^\d]/g, "")) : 0;
    if (emp > 0) {
      employees += emp;
      hasEmployees = true;
    }
  }

  const hqSource =
    children.find((c) => c.headquarters && registry?.hqState && c.headquarters.includes(registry.hqState)) ??
    children.find((c) => c.headquarters) ??
    null;
  const hq = parseHq(registry?.hqCity ? `${registry.hqCity}, ${registry.hqState ?? ""}` : hqSource?.headquarters);

  const ticker =
    registry?.ticker ??
    children.map(tickerFromOrg).find((t) => t) ??
    null;

  const canonicalDomain = promoted?.canonicalDomain ?? null;
  const website = promoted?.website ?? null;

  return {
    id: key.enterpriseId,
    name: key.displayName,
    canonicalDomain,
    website,
    domainConfidence: promoted?.domainConfidence ?? null,
    domainSource: promoted?.domainSource ?? null,
    domainEvidenceCount: promoted?.domainEvidenceCount ?? 0,
    domainAmbiguous: ambiguous && !promoted,
    logo: canonicalDomain ? `https://www.google.com/s2/favicons?domain=${canonicalDomain}&sz=64` : null,
    hqCity: registry?.hqCity ?? hq.city,
    hqState: registry?.hqState ?? hq.state,
    ticker,
    exchange: registry?.exchange ?? (ticker ? "NYSE" : null),
    revenue: null,
    employees: hasEmployees ? employees : null,
    totalCoveredLives: hasLives ? totalCoveredLives : null,
    opportunityScore: null,
    linesOfBusiness: aggregateClassifications(children),
    statesServed: aggregateStates(children),
    ownershipTypes: aggregateOwnership(children),
    operatingBrands: [...operatingBrands].sort(),
    subsidiaries: [...subsidiaries].sort(),
    sourceOrganizationIds: children.map((c) => c.id),
    segmentEvidence: children.map(segmentEvidenceFor),
    rollupKey: key.key,
    rollupMethod: key.method,
    childCount: children.length,
  };
}

export function enterpriseProfileToClassifications(
  profile: EnterpriseProfile,
): OrganizationClassification[] {
  return profile.linesOfBusiness.map((id) => ({
    namespace: "health-plans",
    id,
    label: id.replace(/_/g, " "),
  }));
}
