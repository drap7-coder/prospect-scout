export const MANUFACTURERS_BOOTSTRAP_CONNECTOR_ID = "warehouse-manufacturers-bootstrap";
export const MANUFACTURERS_BOOTSTRAP_SOURCE_NAME = "manufacturers-bootstrap-seed";
export const MANUFACTURERS_SEC_CONNECTOR_ID = "warehouse-manufacturers-sec";
export const MANUFACTURERS_FDA_CONNECTOR_ID = "warehouse-manufacturers-fda";

export type ManufacturerExternalIdType =
  | "cik"
  | "ticker"
  | "fda_establishment"
  | "epa_facility"
  | "domain"
  | "ein"
  | "other";

export interface ManufacturerExternalId {
  idType: ManufacturerExternalIdType;
  idValue: string;
}

export interface ManufacturerImportCandidate {
  organization: import("@/lib/discovery/organization").Organization;
  externalIds: ManufacturerExternalId[];
}

export interface ManufacturerImportPaths {
  secJson: string;
  fdaJson: string;
}

export interface ManufacturerImportStats {
  secRecordsParsed: number;
  fdaRecordsParsed: number;
  seedRecordsParsed: number;
  candidatesBuilt: number;
  organizationsMerged: number;
  organizationsAdded: number;
  indexSizeAfterImport: number;
  duplicateOrganizationIds: number;
}

export interface ManufacturerSourceFetchStats {
  fetchedAt: string;
  secManufacturerRecords: number;
  fdaRecords: number;
}
