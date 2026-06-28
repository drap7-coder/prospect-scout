import type { HealthPlanType } from "@/lib/discovery/healthPlanType";
import type { Organization } from "@/lib/discovery/organization";

export const CMS_CPSC_CONNECTOR_ID = "cms-cpsc";
export const CMS_CPSC_SOURCE_NAME = "cms-cpsc";
export const CMS_QHP_CONNECTOR_ID = "cms-qhp";
export const CMS_QHP_SOURCE_NAME = "cms-qhp";
export const CMS_MEDICAID_MCO_CONNECTOR_ID = "cms-medicaid-mco";
export const CMS_MEDICAID_MCO_SOURCE_NAME = "cms-medicaid-mco";

export type HealthPlanExternalIdType =
  | "cms_contract"
  | "hios"
  | "naic"
  | "npi"
  | "domain"
  | "other";

export interface HealthPlanExternalId {
  idType: HealthPlanExternalIdType;
  idValue: string;
}

/** Parsed CMS CPSC contract row (Medicare Advantage / Part D). */
export interface CmsCpscRow {
  contractId: string;
  legalEntityName: string;
  marketingName: string;
  parentOrganization: string;
  contractType: "MA" | "MA-PD" | "PDP" | "OTHER";
  state: string;
  starRating: number | null;
  naicId?: string;
  datasetRowId: string;
}

/** Aggregated CPSC organization after grouping contract rows. */
export interface CmsCpscOrganization {
  id: string;
  legalEntityName: string;
  marketingName: string;
  parentOrganization: string;
  contractIds: string[];
  contractTypes: Set<"MA" | "MA-PD" | "PDP" | "OTHER">;
  states: string[];
  starRating: number | null;
  naicId?: string;
  aliases: string[];
  tags: string[];
  datasetRowIds: string[];
}

/** Parsed ACA/QHP issuer row. */
export interface CmsQhpRow {
  hiosId: string;
  issuerLegalName: string;
  state: string;
  marketplace: "HealthCare.gov" | "State-Based";
  naicId?: string;
  website?: string;
  parentOrganization?: string;
  datasetRowId: string;
}

/** Parsed Medicaid MCO row. */
export interface CmsMedicaidMcoRow {
  mcoId: string;
  organizationName: string;
  parentOrganization: string;
  state: string;
  planType: string;
  naicId?: string;
  datasetRowId: string;
}

export interface HealthPlanImportCandidate {
  organization: Organization;
  externalIds: HealthPlanExternalId[];
  healthPlanType?: HealthPlanType;
}

export interface CmsImportPaths {
  cpscCsv: string;
  qhpCsv: string;
  medicaidMcoCsv: string;
}

export interface CmsImportStats {
  cpscRowsParsed: number;
  qhpRowsParsed: number;
  medicaidRowsParsed: number;
  candidatesBuilt: number;
  organizationsMerged: number;
  organizationsAdded: number;
  externalIdsAttached: number;
  indexSizeAfterImport: number;
}

export interface HealthPlanFullImportStats {
  seed: import("../types").HealthPlanImportStats;
  cms: CmsImportStats;
  totalIndexSize: number;
}
