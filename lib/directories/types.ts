import type { BuyerPackId } from "@/lib/search/types";

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
  organizationType: DirectoryOrganizationType;
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
  /** Buyer pack this record belongs to. */
  buyerPack: BuyerPackId;
}

export interface DirectorySearchCriteria {
  query: string;
  buyerPack: BuyerPackId;
  region?: string;
  organizationType?: DirectoryOrganizationType;
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
