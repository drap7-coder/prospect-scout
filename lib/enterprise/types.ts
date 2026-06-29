import type { OrganizationClassification } from "@/lib/organization/model";

export const ENTERPRISE_PROFILE_SECTOR_KEY = "enterpriseProfile";

export interface EnterpriseSegmentEvidence {
  sourceOrganizationId: string;
  sourceName: string;
  classificationIds: string[];
  states: string[];
  domain: string | null;
}

/** Canonical enterprise prospect — rolled up from warehouse child organizations. */
export interface EnterpriseProfile {
  id: string;
  name: string;
  canonicalDomain: string | null;
  website: string | null;
  domainConfidence: number | null;
  domainSource: import("./promoteDomain").EnterpriseDomainSource | null;
  domainEvidenceCount: number;
  domainAmbiguous: boolean;
  logo: string | null;
  hqCity: string | null;
  hqState: string | null;
  ticker: string | null;
  exchange: string | null;
  revenue: number | null;
  employees: number | null;
  totalCoveredLives: number | null;
  opportunityScore: number | null;
  linesOfBusiness: string[];
  statesServed: string[];
  ownershipTypes: string[];
  operatingBrands: string[];
  subsidiaries: string[];
  sourceOrganizationIds: string[];
  segmentEvidence: EnterpriseSegmentEvidence[];
  rollupKey: string;
  rollupMethod: string;
  childCount: number;
}

export interface EnterpriseRegistryEntry {
  id: string;
  name: string;
  canonicalDomain: string;
  website: string;
  parentNames: string[];
  entityTokens: string[];
  ticker?: string | null;
  exchange?: string | null;
  hqCity?: string | null;
  hqState?: string | null;
  national?: boolean;
  states?: string[];
}

export interface ResolvedEnterpriseKey {
  key: string;
  enterpriseId: string;
  displayName: string;
  method: string;
  registryEntry?: EnterpriseRegistryEntry;
}

export interface EnterpriseRollupResult {
  profiles: EnterpriseProfile[];
  rawOrganizationCount: number;
  enterpriseCount: number;
  suppressedChildCount: number;
  orphanCount: number;
}

export interface EnterpriseRollupDiagnostics {
  generatedAt: string;
  rawOrganizationCount: number;
  /** Search-visible results after rollup (profiles + passthrough orphans). */
  searchResultCount: number;
  /** Built EnterpriseProfile objects (multi-child rollups + keyed singles). */
  rollupProfileCount: number;
  /** Standalone single-record orgs returned without an EnterpriseProfile. */
  passthroughOrphanCount: number;
  /** Alias — passthrough orphans are not forced into EnterpriseProfile. */
  passthroughOrphans: number;
  /** Raw health-plan org domain coverage (upstream of enterprise promotion). */
  rawOrgDomainCoverage: {
    total: number;
    withDomain: number;
    pctDomain: number;
  };
  enterpriseProfilesWithDomain: number;
  enterpriseProfilesMissingDomain: number;
  enterpriseProfilesWithDomainBearingChildren: number;
  /** Rollups with domain-bearing children that failed to receive a canonical domain. */
  promotionFailures: number;
  averageChildrenPerEnterprise: number;
  topRollupsByChildCount: { name: string; id: string; childCount: number }[];
  enterpriseDomainCoverage: {
    total: number;
    withDomain: number;
    pctDomain: number;
  };
  domainPromotion: {
    promotedFromChildRecords: number;
    inheritedFromParentMappings: number;
    ambiguousEnterprises: number;
    missingCanonicalDomain: number;
    /** Rollup profiles with at least one high-confidence child domain. */
    enterprisesWithDomainChildren: number;
    /** Share of domain-bearing rollups that received a canonical domain. */
    promotionSuccessPct: number;
  };
  topEnterprisesMissingDomain: { name: string; id: string; childCount: number }[];
  suppressedChildRecords: number;
  orphanOrganizations: number;
  byBuyerPack: Record<string, { raw: number; enterprises: number }>;
}

export type RankedOrgInput = {
  id: string;
  canonicalName: string;
  relevance: number;
  confidence: number;
  matchReasons: string[];
  classifications?: OrganizationClassification[];
  [key: string]: unknown;
};
