import { getDeploymentMetadata, type DeploymentMetadata } from "./deploymentMetadata";
import {
  computeOrganizationWarehouseDiagnostics,
  getOrganizationWarehouseManifest,
  isWarehouseStrictImport,
  PRODUCTION_WAREHOUSE_CONNECTOR_IDS,
  shouldUseOrganizationWarehouse,
  WAREHOUSE_CONNECTORS,
} from "@/lib/import/warehouse";
import {
  isOrganizationWarehouseEnabled,
} from "@/lib/import/warehouse/featureFlag";
import { healthPlansConnectorApi } from "@/lib/import/warehouse/connectors/healthPlans";
import { manufacturersConnectorApi } from "@/lib/import/warehouse/connectors/manufacturers";
import { getHealthPlanCatalogImportManifest } from "@/lib/import/healthPlans/catalogManifest";
import { getManufacturerCatalogImportManifest } from "@/lib/import/manufacturers/catalogManifest";

export interface RuntimeDiagnostics {
  generatedAt: string;
  deployment: DeploymentMetadata;
  warehouse: {
    orgWarehouseEnv: string | null;
    healthPlanPersistentSourceEnv: string | null;
    enabled: boolean;
    activeForSearch: boolean;
    strictImport: boolean;
    runtimeMode: "warehouse" | "bootstrap-seed";
    totalOrganizations: number;
    healthPlanOrganizations: number;
    manufacturerOrganizations: number;
    duplicateOrganizationIds: number;
    lastImportAt: string | null;
    catalogVersion: string | null;
    catalogMode: string | null;
    registeredConnectors: string[];
    connectorCounts: Record<string, number>;
  };
  warnings: string[];
}

function catalogVersionLabel(): { version: string | null; mode: string | null } {
  const manifest = getOrganizationWarehouseManifest();
  if (manifest) {
    return {
      version: manifest.importedAt,
      mode: manifest.mode,
    };
  }

  const healthManifest = getHealthPlanCatalogImportManifest();
  const manufacturerManifest = getManufacturerCatalogImportManifest();
  const importedAt =
    [healthManifest?.importedAt, manufacturerManifest?.importedAt]
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  const mode =
    healthManifest?.mode ??
    manufacturerManifest?.mode ??
    null;

  return { version: importedAt, mode };
}

function buildWarnings(input: {
  enabled: boolean;
  activeForSearch: boolean;
  healthPlanCount: number;
  totalOrganizations: number;
  environment: DeploymentMetadata["environment"];
}): string[] {
  const warnings: string[] = [];

  if (!input.enabled && input.environment === "production") {
    warnings.push(
      "ORG_WAREHOUSE is disabled in production; search may use bootstrap seed directories.",
    );
  }

  if (input.enabled && !input.activeForSearch) {
    warnings.push(
      "Warehouse mode is enabled but the index is empty; search will fall back to bootstrap seed catalogs.",
    );
  }

  if (input.activeForSearch && input.healthPlanCount > 0 && input.healthPlanCount <= 30) {
    warnings.push(
      `Health plan count is ${input.healthPlanCount} (bootstrap seed scale). Full CMS warehouse import may not have run in this environment.`,
    );
  }

  if (input.activeForSearch && input.totalOrganizations === 0) {
    warnings.push("Warehouse index has zero organizations.");
  }

  if (!getDeploymentMetadata().gitCommitSha) {
    warnings.push(
      "Git commit SHA is unavailable. Set VERCEL_GIT_COMMIT_SHA (automatic on Vercel) or GIT_COMMIT_SHA at build time to compare deployments.",
    );
  }

  return warnings;
}

/** Snapshot for /diagnostics and /api/diagnostics/runtime — compare local vs production. */
export function computeRuntimeDiagnostics(): RuntimeDiagnostics {
  const deployment = getDeploymentMetadata();
  const warehouse = computeOrganizationWarehouseDiagnostics();
  const healthPlanOrganizations = healthPlansConnectorApi.getIndexSize();
  const manufacturerOrganizations = manufacturersConnectorApi.getIndexSize();
  const { version, mode } = catalogVersionLabel();

  const connectorCounts = Object.fromEntries(
    warehouse.connectors.map((connector) => [
      connector.id,
      connector.organizationsIndexed,
    ]),
  );

  const enabled = isOrganizationWarehouseEnabled();
  const activeForSearch = shouldUseOrganizationWarehouse();

  return {
    generatedAt: new Date().toISOString(),
    deployment,
    warehouse: {
      orgWarehouseEnv: process.env.ORG_WAREHOUSE ?? null,
      healthPlanPersistentSourceEnv: process.env.HEALTH_PLAN_PERSISTENT_SOURCE ?? null,
      enabled,
      activeForSearch,
      strictImport: isWarehouseStrictImport(),
      runtimeMode: warehouse.runtimeMode,
      totalOrganizations: warehouse.totalOrganizations,
      healthPlanOrganizations,
      manufacturerOrganizations,
      duplicateOrganizationIds: warehouse.duplicateOrganizationIds,
      lastImportAt: warehouse.lastImportAt,
      catalogVersion: version,
      catalogMode: mode,
      registeredConnectors: PRODUCTION_WAREHOUSE_CONNECTOR_IDS.map(
        (id) => WAREHOUSE_CONNECTORS[id].label,
      ),
      connectorCounts,
    },
    warnings: buildWarnings({
      enabled,
      activeForSearch,
      healthPlanCount: healthPlanOrganizations,
      totalOrganizations: warehouse.totalOrganizations,
      environment: deployment.environment,
    }),
  };
}
