import type { Organization } from "@/lib/discovery/organization";

/** Stable connector id within the organization warehouse. */
export type WarehouseConnectorId = "health-plans" | "manufacturers";

export type WarehouseConnectorStatus = "production" | "planned" | "disabled";

export interface WarehouseConnectorDefinition {
  id: WarehouseConnectorId;
  label: string;
  description: string;
  status: WarehouseConnectorStatus;
  buyerPack: string;
}

export interface WarehouseConnectorSummary {
  id: WarehouseConnectorId;
  label: string;
  status: WarehouseConnectorStatus;
  organizationsIndexed: number;
  lastImportAt: string | null;
  importMode: string | null;
}

export interface OrganizationWarehouseManifest {
  importedAt: string;
  mode: "production" | "fixture" | "bootstrap-seed";
  totalOrganizations: number;
  connectors: WarehouseConnectorSummary[];
}

export type WarehouseRuntimeMode = "warehouse" | "bootstrap-seed";

export interface OrganizationWarehouseDiagnostics {
  runtimeMode: WarehouseRuntimeMode;
  totalOrganizations: number;
  duplicateOrganizationIds: number;
  lastImportAt: string | null;
  connectors: WarehouseConnectorSummary[];
}

export type WarehouseConnectorImportStatus = "success" | "warning" | "failed";

export interface WarehouseConnectorImportOutcome {
  id: WarehouseConnectorId;
  status: WarehouseConnectorImportStatus;
  error?: string;
  restoredPreviousIndex?: number;
}

export interface OrganizationWarehouseImportResult {
  healthPlans: import("@/lib/import/healthPlans/cms/types").CmsImportStats & {
    regressionFindings: import("@/lib/import/healthPlans/importRegression").RegressionFinding[];
  } | null;
  manufacturers: import("@/lib/import/manufacturers/types").ManufacturerImportStats | null;
  totalIndexSize: number;
  connectorOutcomes: WarehouseConnectorImportOutcome[];
  strictMode: boolean;
  hadFailures: boolean;
  emailPatternsProcessed?: number;
}

export type OrganizationWarehouseImportStats = OrganizationWarehouseImportResult;
