import { getDeploymentMetadata, type DeploymentMetadata } from "./deploymentMetadata";
import {
  computeOrganizationWarehouseDiagnostics,
  getOrganizationWarehouseManifest,
  isWarehouseStrictImport,
  PRODUCTION_WAREHOUSE_CONNECTOR_IDS,
  shouldUseOrganizationWarehouse,
  warehouseConnectorApi,
  WAREHOUSE_CONNECTORS,
} from "@/lib/import/warehouse";
import { isOrganizationWarehouseEnabled } from "@/lib/import/warehouse/featureFlag";
import { getHealthPlanHydrationState } from "@/lib/import/healthPlans/hydrateIndex";
import { getHealthPlanCatalogImportManifest } from "@/lib/import/healthPlans/catalogManifest";
import { getManufacturerCatalogImportManifest } from "@/lib/import/manufacturers/catalogManifest";

export type RuntimeWarehouseConnectorStatus = "loaded" | "empty" | "loading" | "failed";

export interface RuntimeWarehouseConnector {
  /** Connector id, e.g. health-plans */
  name: string;
  label: string;
  status: RuntimeWarehouseConnectorStatus;
  organizations: number;
  lastImport: string | null;
  importMode: string | null;
}

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
    /** Latest warehouse import timestamp (ISO). */
    lastImport: string | null;
    catalogVersion: string | null;
    catalogMode: string | null;
    registeredConnectors: string[];
    connectors: RuntimeWarehouseConnector[];
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

function connectorStatus(
  organizations: number,
  hydrationState: "idle" | "loading" | "ready" | "failed",
): RuntimeWarehouseConnectorStatus {
  if (organizations > 0) return "loaded";
  if (hydrationState === "loading") return "loading";
  if (hydrationState === "failed") return "failed";
  return "empty";
}

function buildConnectorSnapshots(): RuntimeWarehouseConnector[] {
  return PRODUCTION_WAREHOUSE_CONNECTOR_IDS.map((id) => {
    const definition = WAREHOUSE_CONNECTORS[id];
    const summary = warehouseConnectorApi(id).summarize();
    const hydrationState =
      id === "health-plans" ? getHealthPlanHydrationState() : "idle";

    return {
      name: id,
      label: definition.label,
      status: connectorStatus(summary.organizationsIndexed, hydrationState),
      organizations: summary.organizationsIndexed,
      lastImport: summary.lastImportAt,
      importMode: summary.importMode,
    };
  });
}

function buildWarnings(input: {
  enabled: boolean;
  activeForSearch: boolean;
  connectors: RuntimeWarehouseConnector[];
  totalOrganizations: number;
  environment: DeploymentMetadata["environment"];
}): string[] {
  const warnings: string[] = [];
  const healthPlans = input.connectors.find((c) => c.name === "health-plans");
  const manufacturers = input.connectors.find((c) => c.name === "manufacturers");

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

  if (healthPlans?.status === "empty") {
    warnings.push(
      "Health-plans connector index is empty. Run warehouse import or verify Neon hydration.",
    );
  } else if (healthPlans?.status === "loading") {
    warnings.push("Health-plans connector is still hydrating from the database.");
  } else if (healthPlans?.status === "failed") {
    warnings.push("Health-plans connector hydration failed; index may be incomplete.");
  } else if (
    healthPlans?.status === "loaded" &&
    healthPlans.organizations > 0 &&
    healthPlans.organizations <= 30
  ) {
    warnings.push(
      `Health-plans connector has ${healthPlans.organizations} organizations (bootstrap seed scale). Full CMS import may not have run.`,
    );
  }

  if (manufacturers?.status === "empty") {
    warnings.push(
      "Manufacturers connector index is empty. Run warehouse import in this environment.",
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
  const connectors = buildConnectorSnapshots();
  const healthPlanOrganizations =
    connectors.find((c) => c.name === "health-plans")?.organizations ?? 0;
  const manufacturerOrganizations =
    connectors.find((c) => c.name === "manufacturers")?.organizations ?? 0;
  const { version, mode } = catalogVersionLabel();

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
      lastImport: warehouse.lastImportAt,
      catalogVersion: version,
      catalogMode: mode,
      registeredConnectors: PRODUCTION_WAREHOUSE_CONNECTOR_IDS.map(
        (id) => WAREHOUSE_CONNECTORS[id].label,
      ),
      connectors,
    },
    warnings: buildWarnings({
      enabled,
      activeForSearch,
      connectors,
      totalOrganizations: warehouse.totalOrganizations,
      environment: deployment.environment,
    }),
  };
}
