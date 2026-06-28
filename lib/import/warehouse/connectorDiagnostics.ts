import type { Organization } from "@/lib/discovery/organization";
import { parseSearchIntent } from "@/lib/discovery/intent";
import { orgMatchesIntent } from "@/lib/discovery/catalog/catalogIndex";
import { organizationMatchesQueryText } from "@/lib/discovery/queryDiscovery";
import { countDuplicateOrganizationIds } from "./mergeByVerifiedIds";
import { warehouseConnectorApi } from "./organizations";
import { PRODUCTION_WAREHOUSE_CONNECTOR_IDS } from "./organizations";
import type { WarehouseConnectorId, WarehouseConnectorImportStatus } from "./types";
import { getHealthPlanCatalogImportManifest } from "@/lib/import/healthPlans/catalogManifest";
import { getManufacturerCatalogImportManifest } from "@/lib/import/manufacturers/catalogManifest";
import { computeHealthPlanCatalogDiagnostics } from "@/lib/import/healthPlans/healthPlanDiagnostics";
import { computeManufacturerConnectorDiagnostics } from "@/lib/import/manufacturers/diagnostics";

export interface WarehouseConnectorCoverageDetail {
  id: WarehouseConnectorId;
  label: string;
  importStatus: WarehouseConnectorImportStatus;
  rawRecords: number;
  canonicalOrganizations: number;
  indexedOrganizations: number;
  searchableOrganizations: number;
  duplicateCount: number;
  mergeCount: number | null;
  lastImportAt: string | null;
  importMode: string | null;
  error: string | null;
}

function rawRecordsForConnector(id: WarehouseConnectorId): number {
  if (id === "health-plans") {
    const manifest = getHealthPlanCatalogImportManifest();
    if (!manifest?.rawRecords) return 0;
    return (
      manifest.rawRecords.cpsc +
      manifest.rawRecords.qhp +
      manifest.rawRecords.medicaid +
      manifest.rawRecords.medicaidEnrollment
    );
  }
  if (id === "manufacturers") {
    const manifest = getManufacturerCatalogImportManifest();
    if (!manifest?.rawRecords) return 0;
    return manifest.rawRecords.sec + manifest.rawRecords.fda + manifest.rawRecords.seed;
  }
  return 0;
}

function mergeCountForConnector(id: WarehouseConnectorId): number | null {
  if (id === "health-plans") {
    return getHealthPlanCatalogImportManifest()?.organizations.merged ?? null;
  }
  if (id === "manufacturers") {
    return getManufacturerCatalogImportManifest()?.pipeline.merged ?? null;
  }
  return null;
}

function searchableCountForConnector(id: WarehouseConnectorId, orgs: Organization[]): number {
  const buyerPack = id === "health-plans" ? "health-plans" : "manufacturers";
  const connectorOrgs = orgs.filter((org) => org.buyerPack === buyerPack);
  const intent =
    id === "health-plans"
      ? parseSearchIntent("health plans")
      : parseSearchIntent("manufacturers");
  return connectorOrgs.filter(
    (org) => orgMatchesIntent(org, intent) || organizationMatchesQueryText(org, intent),
  ).length;
}

/** Per-connector coverage metrics for /warehouse/coverage. */
export function computeWarehouseConnectorCoverageDetails(
  importStatuses: Partial<Record<WarehouseConnectorId, WarehouseConnectorImportStatus>> = {},
  importErrors: Partial<Record<WarehouseConnectorId, string>> = {},
): WarehouseConnectorCoverageDetail[] {
  return PRODUCTION_WAREHOUSE_CONNECTOR_IDS.map((id) => {
    const api = warehouseConnectorApi(id);
    const orgs = api.getOrganizations();
    const summary = api.summarize();
    const importStatus = importStatuses[id] ?? (orgs.length > 0 ? "success" : "warning");

    return {
      id,
      label: summary.label,
      importStatus,
      rawRecords: rawRecordsForConnector(id),
      canonicalOrganizations: orgs.length,
      indexedOrganizations: api.getIndexSize(),
      searchableOrganizations: searchableCountForConnector(id, orgs),
      duplicateCount: countDuplicateOrganizationIds(orgs),
      mergeCount: mergeCountForConnector(id),
      lastImportAt: summary.lastImportAt,
      importMode: summary.importMode,
      error: importErrors[id] ?? null,
    };
  });
}

export function computeExtendedHealthPlanCoverage() {
  return computeHealthPlanCatalogDiagnostics();
}

export function computeExtendedManufacturerCoverage() {
  return computeManufacturerConnectorDiagnostics();
}
