export type DomainIntelligenceSource =
  | "source_data"
  | "directory_match"
  | "identity_propagation"
  | "parent_propagation"
  | "derived"
  | "manual";

export type DomainConfidenceLabel = "high" | "medium" | "low";

/** Provenance for website/domain assignment (stored in sectorAttributes). */
export interface OrganizationDomainIntelligence {
  website: string | null;
  domain: string | null;
  source: DomainIntelligenceSource;
  confidence: number;
  confidenceLabel: DomainConfidenceLabel;
  matchMethod?: string;
  /** Parent organization when domain was inherited via propagation. */
  parentOrg?: string;
  /** Human-readable rule id describing why the domain was assigned. */
  matchedRule?: string;
  lastEnrichedAt: string;
}

export interface DomainLookupResult {
  website: string;
  domain: string;
  source: DomainIntelligenceSource;
  confidence: number;
  confidenceLabel: DomainConfidenceLabel;
  matchMethod: string;
  parentOrg?: string;
  matchedRule?: string;
}

export interface DomainCoverageBucket {
  label: string;
  total: number;
  withWebsite: number;
  withDomain: number;
  pctWebsite: number;
  pctDomain: number;
}

export interface DomainCoverageReport {
  generatedAt: string;
  total: number;
  withWebsite: number;
  withDomain: number;
  pctWebsite: number;
  pctDomain: number;
  byBuyerPack: DomainCoverageBucket[];
  bySector: DomainCoverageBucket[];
}

export const DOMAIN_INTELLIGENCE_SECTOR_KEY = "domainIntelligence";

/** Minimum confidence to persist a looked-up domain (no low-confidence guesses). */
export const DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD = 0.85;
