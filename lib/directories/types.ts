import type { BuyerPackId, ProviderId } from "@/lib/search/types";

/** Canonical organization types in the master directory. */
export type DirectoryOrganizationType =
  | "health-plan"
  | "health-system"
  | "manufacturer"
  | "employer"
  | "municipality"
  | "university";

/**
 * Master organization record — source of truth for who exists.
 * Providers attach enrichments; scoring works with partial or zero signals.
 */
export interface OrganizationRecord {
  id: string;
  name: string;
  aliases: string[];
  parentOrganization?: string;
  /** Legacy coarse type — prefer organizationTypeId when available. */
  organizationType: DirectoryOrganizationType;
  /** Taxonomy sector id, e.g. "manufacturing". */
  sectorId?: string;
  /** Taxonomy industry id, e.g. "food-beverage". */
  industryId?: string;
  /** Taxonomy organization type id, e.g. "food-beverage-company". */
  organizationTypeId?: string;
  /** Legacy industry string — prefer industryId. */
  industry: string;
  website?: string;
  headquarters: string;
  statesServed: string[];
  regions: string[];
  employeeEstimate?: number;
  memberEstimate?: number;
  commercial?: boolean;
  medicare?: boolean;
  medicaid?: boolean;
  exchange?: boolean;
  aso?: boolean;
  tpa?: boolean;
  publicCompany?: boolean;
  ticker?: string;
  cmsContracts?: string[];
  naicId?: string;
  npiIds?: string[];
  tags?: string[];
  /** Signal ids this org is known to exhibit (curated hints). */
  knownSignals?: string[];
  /** Providers that can enrich this record. */
  relevantProviders?: ProviderId[];
  /** Buyer pack this record belongs to. */
  buyerPack: BuyerPackId;
}

export interface DirectorySearchCriteria {
  query: string;
  buyerPack: BuyerPackId;
  region?: string;
  organizationType?: DirectoryOrganizationType;
  /** Taxonomy industry filter from query or UI. */
  industryId?: string;
  /** Taxonomy sector filter from query or UI. */
  sectorId?: string;
  /** Taxonomy organization type filter. */
  organizationTypeId?: string;
  /** US state postal code, e.g. PA */
  state?: string;
  commercial?: boolean;
  medicare?: boolean;
  medicaid?: boolean;
  exchange?: boolean;
  aso?: boolean;
  tpa?: boolean;
}

export interface DirectorySearchMatch {
  record: OrganizationRecord;
  score: number;
  matchedOn: string;
}

/** Default taxonomy fields for legacy directory records. */
export function normalizeDirectoryRecord(
  record: OrganizationRecord,
): OrganizationRecord {
  const defaults: Partial<OrganizationRecord> = {};
  if (!record.sectorId) {
    if (record.buyerPack === "health-plans") defaults.sectorId = "healthcare";
    else if (record.buyerPack === "health-systems") defaults.sectorId = "healthcare";
    else if (record.buyerPack === "manufacturers") defaults.sectorId = "manufacturing";
    else if (record.buyerPack === "public-sector") defaults.sectorId = "public-sector";
    else defaults.sectorId = "technology";
  }
  if (!record.industryId) {
    if (record.organizationType === "health-plan") defaults.industryId = "payers";
    else if (record.organizationType === "health-system") defaults.industryId = "providers";
    else if (record.organizationType === "manufacturer") defaults.industryId = record.industry || "industrial-products";
    else if (record.organizationType === "municipality") defaults.industryId = "municipalities";
    else if (record.organizationType === "university") defaults.industryId = "universities";
    else defaults.industryId = record.industry || "technology";
  }
  if (!record.organizationTypeId) {
    if (record.organizationType === "health-plan") defaults.organizationTypeId = "health-plan";
    else if (record.organizationType === "health-system") defaults.organizationTypeId = "health-system";
    else if (record.organizationType === "manufacturer") defaults.organizationTypeId = "manufacturer";
    else if (record.organizationType === "municipality") defaults.organizationTypeId = "municipality";
    else if (record.organizationType === "university") defaults.organizationTypeId = "university";
    else defaults.organizationTypeId = "employer";
  }
  return { ...defaults, ...record };
}
