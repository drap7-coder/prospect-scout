import type {
  OrganizationWarehouseDiagnostics,
  OrganizationWarehouseManifest,
  WarehouseConnectorSummary,
  WarehouseRuntimeMode,
} from "./types";
import { shouldUseOrganizationWarehouse } from "./featureFlag";
import { countDuplicateOrganizationIds } from "./mergeByVerifiedIds";
import {
  getWarehouseOrganizations,
  getWarehouseIndexSize,
  warehouseConnectorApi,
  PRODUCTION_WAREHOUSE_CONNECTOR_IDS,
} from "./organizations";

export * from "./types";
export * from "./featureFlag";
export * from "./organizations";
export {
  WAREHOUSE_CONNECTORS,
  getWarehouseConnector,
  healthPlansConnectorApi,
  manufacturersConnectorApi,
} from "./connectors/registry";
export { countDuplicateOrganizationIds } from "./mergeByVerifiedIds";

export function summarizeWarehouseConnectors(): WarehouseConnectorSummary[] {
  return PRODUCTION_WAREHOUSE_CONNECTOR_IDS.map((connectorId) =>
    warehouseConnectorApi(connectorId).summarize(),
  );
}

export function getOrganizationWarehouseManifest(): OrganizationWarehouseManifest | null {
  const connectors = summarizeWarehouseConnectors();
  const importedAt = connectors
    .map((connector) => connector.lastImportAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  if (!importedAt && getWarehouseIndexSize() === 0) {
    return null;
  }

  const modes = connectors.map((connector) => connector.importMode).filter(Boolean);
  const mode = modes.includes("production") ? "production" : "fixture";

  return {
    importedAt: importedAt ?? new Date().toISOString(),
    mode,
    totalOrganizations: getWarehouseIndexSize(),
    connectors,
  };
}

export function computeOrganizationWarehouseDiagnostics(): OrganizationWarehouseDiagnostics {
  const organizations = getWarehouseOrganizations();
  const connectors = summarizeWarehouseConnectors();
  const lastImportAt =
    connectors
      .map((connector) => connector.lastImportAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  const runtimeMode: WarehouseRuntimeMode = shouldUseOrganizationWarehouse()
    ? "warehouse"
    : "bootstrap-seed";

  return {
    runtimeMode,
    totalOrganizations: organizations.length,
    duplicateOrganizationIds: countDuplicateOrganizationIds(organizations),
    lastImportAt,
    connectors,
  };
}

/** Non-blocking hydration for all production warehouse connectors. */
export {
  kickoffOrganizationWarehouseHydration,
  ensureOrganizationWarehouseHydrated,
  getLastWarehouseHydrationResult,
  getWarehouseHydrationSnapshot,
} from "./hydration";
export type {
  WarehouseHydrationResult,
  ConnectorHydrationResult,
} from "./hydration";

export {
  discoverFromOrganizationWarehouse,
  traceWarehouseSearchPipeline,
} from "./discover";
export type {
  WarehouseSearchPipelineTrace,
  WarehousePipelineStage,
  WarehouseDiscoverResult,
} from "./discover";
export {
  isWarehouseStrictImport,
  importOrganizationWarehouse,
  fetchOrganizationWarehouseSources,
} from "./import";
export type {
  OrganizationWarehouseImportResult,
  OrganizationWarehouseImportStats,
} from "./types";
export { computeWarehouseConnectorCoverageDetails } from "./connectorDiagnostics";
export type { WarehouseConnectorCoverageDetail } from "./connectorDiagnostics";
