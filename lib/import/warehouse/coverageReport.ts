import {
  computeOrganizationWarehouseDiagnostics,
  computeWarehouseConnectorCoverageDetails,
} from "./index";
import { computeHealthPlanCoverageReport } from "@/lib/import/healthPlans/coverageReport";
import type { HealthPlanCoverageReport } from "@/lib/import/healthPlans/coverageReport";
import { computeExtendedHealthPlanCoverage } from "./connectorDiagnostics";
import type { HealthPlanCatalogDiagnostics } from "@/lib/import/healthPlans/healthPlanDiagnostics";
import { computeManufacturerCoverageReport } from "@/lib/import/manufacturers/coverageReport";
import type { ManufacturerCoverageReport } from "@/lib/import/manufacturers/coverageReport";
import { summarizeWarehouseConnectors } from "./index";
import { getWarehouseOrganizations } from "./organizations";
import { computeDomainCoverageReport } from "@/lib/domainIntelligence/coverage";
import type { DomainCoverageReport } from "@/lib/domainIntelligence/types";
import type {
  OrganizationWarehouseDiagnostics,
  WarehouseConnectorSummary,
} from "./types";
import type { WarehouseConnectorCoverageDetail } from "./connectorDiagnostics";

export interface OrganizationWarehouseCoverageReport {
  generatedAt: string;
  warehouse: OrganizationWarehouseDiagnostics;
  connectors: WarehouseConnectorSummary[];
  connectorDetails: WarehouseConnectorCoverageDetail[];
  healthPlans: HealthPlanCoverageReport;
  healthPlanBreakdown: HealthPlanCatalogDiagnostics;
  manufacturers: ManufacturerCoverageReport;
  domainCoverage: DomainCoverageReport;
}

/** Warehouse-level coverage report with per-connector detail. */
export function computeOrganizationWarehouseCoverageReport(): OrganizationWarehouseCoverageReport {
  return {
    generatedAt: new Date().toISOString(),
    warehouse: computeOrganizationWarehouseDiagnostics(),
    connectors: summarizeWarehouseConnectors(),
    connectorDetails: computeWarehouseConnectorCoverageDetails(),
    healthPlans: computeHealthPlanCoverageReport(),
    healthPlanBreakdown: computeExtendedHealthPlanCoverage(),
    manufacturers: computeManufacturerCoverageReport(),
    domainCoverage: computeDomainCoverageReport(getWarehouseOrganizations()),
  };
}
