/** Employer/group commercial evidence — distinct from ACA Marketplace or government LOBs. */

export const GROUP_COMMERCIAL_EVIDENCE_SECTOR_KEY = "groupCommercialEvidence";

export type GroupCommercialEvidenceType =
  | "group_commercial"
  | "employer_group_commercial"
  | "carrier_group_product"
  | "erisa_employer_plan"
  | "tpa_or_admin_only";

export type GroupCommercialEvidenceSource =
  | "curated"
  | "erisa"
  | "seed"
  | "manual";

export type GroupCommercialEvidenceConfidence = "high" | "medium" | "low";

/** Curated or imported evidence that an org offers employer/group commercial medical coverage. */
export interface GroupCommercialEvidenceRecord {
  organizationName: string;
  parentOrganization?: string | null;
  domain?: string | null;
  aliases?: string[];
  evidenceType: GroupCommercialEvidenceType;
  source: GroupCommercialEvidenceSource;
  confidence: GroupCommercialEvidenceConfidence;
  reason: string;
  /**
   * When true, high-confidence parentOrganization matches may attach to child orgs
   * only when the child name/alias also matches a brand token from this record.
   */
  allowParentBrandInheritance?: boolean;
}

export interface GroupCommercialEvidenceSeedRow {
  organizationName: string;
  parentOrganization?: string;
  domain?: string;
  aliases?: string[];
  evidenceType: GroupCommercialEvidenceType;
  source?: GroupCommercialEvidenceSource;
  confidence?: GroupCommercialEvidenceConfidence;
  reason: string;
  allowParentBrandInheritance?: boolean;
}

export interface ApplyGroupCommercialEvidenceResult {
  organizationsUpdated: number;
  evidenceAttached: number;
  commercialPromoted: number;
}
