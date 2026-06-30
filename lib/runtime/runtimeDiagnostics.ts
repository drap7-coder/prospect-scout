import { isDatabaseConfigured } from "@/lib/db";
import { getDeploymentMetadata, type DeploymentMetadata } from "./deploymentMetadata";
import {
  computeOrganizationWarehouseDiagnostics,
  ensureOrganizationWarehouseHydrated,
  getLastWarehouseHydrationResult,
  getOrganizationWarehouseManifest,
  isWarehouseStrictImport,
  PRODUCTION_WAREHOUSE_CONNECTOR_IDS,
  shouldUseOrganizationWarehouse,
  warehouseConnectorApi,
  WAREHOUSE_CONNECTORS,
} from "@/lib/import/warehouse";
import type { WarehouseHydrationResult } from "@/lib/import/warehouse/hydration";
import { isOrganizationWarehouseEnabled } from "@/lib/import/warehouse/featureFlag";
import {
  getHealthPlanHydrationState,
  getHealthPlanHydrationError,
} from "@/lib/import/healthPlans/hydrateIndex";
import {
  getManufacturerHydrationState,
  getManufacturerHydrationError,
} from "@/lib/import/manufacturers/hydrateIndex";
import { getHealthPlanCatalogImportManifest } from "@/lib/import/healthPlans/catalogManifest";
import { getManufacturerCatalogImportManifest } from "@/lib/import/manufacturers/catalogManifest";

export type RuntimeWarehouseConnectorStatus =
  | "loaded"
  | "empty"
  | "loading"
  | "failed"
  | "skipped";

export interface RuntimeWarehouseConnector {
  name: string;
  label: string;
  status: RuntimeWarehouseConnectorStatus;
  organizations: number;
  organizationsInDb: number;
  lastImport: string | null;
  importMode: string | null;
  hydrationError: string | null;
}

export interface RuntimeDiagnostics {
  generatedAt: string;
  deployment: DeploymentMetadata;
  warehouse: {
    databaseConfigured: boolean;
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
    lastImport: string | null;
    catalogVersion: string | null;
    catalogMode: string | null;
    registeredConnectors: string[];
    connectors: RuntimeWarehouseConnector[];
    hydration: WarehouseHydrationResult | null;
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
    (process.env.NODE_ENV === "production" ? "production" : null);

  return { version: importedAt, mode };
}

function connectorHydrationState(id: string): "idle" | "loading" | "ready" | "failed" {
  if (id === "health-plans") return getHealthPlanHydrationState();
  if (id === "manufacturers") return getManufacturerHydrationState();
  return "idle";
}

function connectorHydrationError(id: string): string | null {
  if (id === "health-plans") return getHealthPlanHydrationError();
  if (id === "manufacturers") return getManufacturerHydrationError();
  return null;
}

function buildConnectorSnapshots(
  hydration: WarehouseHydrationResult | null,
): RuntimeWarehouseConnector[] {
  return PRODUCTION_WAREHOUSE_CONNECTOR_IDS.map((id) => {
    const definition = WAREHOUSE_CONNECTORS[id];
    const summary = warehouseConnectorApi(id).summarize();
    const hydrated = hydration?.connectors.find((connector) => connector.id === id);
    const organizations = summary.organizationsIndexed;
    const organizationsInDb = hydrated?.organizationsInDb ?? 0;
    let status: RuntimeWarehouseConnectorStatus = "empty";
    if (hydrated?.status) {
      status = hydrated.status;
    } else if (organizations > 0) {
      status = "loaded";
    } else if (connectorHydrationState(id) === "loading") {
      status = "loading";
    } else if (connectorHydrationState(id) === "failed") {
      status = "failed";
    }

    return {
      name: id,
      label: definition.label,
      status,
      organizations,
      organizationsInDb,
      lastImport: summary.lastImportAt,
      importMode:
        summary.importMode ??
        (organizations > 0 ? "production" : null),
      hydrationError: hydrated?.error ?? connectorHydrationError(id),
    };
  });
}

function buildWarnings(input: {
  enabled: boolean;
  activeForSearch: boolean;
  databaseConfigured: boolean;
  connectors: RuntimeWarehouseConnector[];
  totalOrganizations: number;
  hydration: WarehouseHydrationResult | null;
  environment: DeploymentMetadata["environment"];
}): string[] {
  const warnings: string[] = [];
  const healthPlans = input.connectors.find((c) => c.name === "health-plans");
  const manufacturers = input.connectors.find((c) => c.name === "manufacturers");

  if (!input.databaseConfigured && input.enabled) {
    warnings.push(
      "DATABASE_URL is not configured. Production warehouse hydration requires Neon; search will fall back to bootstrap catalogs.",
    );
  }

  if (input.hydration?.error) {
    warnings.push(`Warehouse hydration: ${input.hydration.error}`);
  }

  if (!input.enabled && input.environment === "production") {
    warnings.push(
      "ORG_WAREHOUSE is disabled in production; search may use bootstrap seed directories.",
    );
  }

  if (input.enabled && !input.activeForSearch) {
    warnings.push(
      "Warehouse mode is enabled but the index is empty after hydration. Import CMS/manufacturer catalogs to production Neon from your machine (see lib/import/warehouse/README.md — do not use POST /api/warehouse/import on Vercel).",
    );
  }

  if (healthPlans?.organizationsInDb === 0 && input.databaseConfigured) {
    warnings.push(
      "Neon has zero health-plans rows. Import CMS catalog to production DATABASE_URL.",
    );
  }

  if (manufacturers?.organizationsInDb === 0 && input.databaseConfigured) {
    warnings.push(
      "Neon has zero manufacturers rows. Import manufacturer catalog to production DATABASE_URL.",
    );
  }

  if (healthPlans?.status === "failed" && healthPlans.hydrationError) {
    warnings.push(`Health-plans hydration failed: ${healthPlans.hydrationError}`);
  }

  if (manufacturers?.status === "failed" && manufacturers.hydrationError) {
    warnings.push(`Manufacturers hydration failed: ${manufacturers.hydrationError}`);
  }

  if (
    healthPlans?.status === "loaded" &&
    healthPlans.organizations > 0 &&
    healthPlans.organizations <= 30
  ) {
    warnings.push(
      `Health-plans connector has ${healthPlans.organizations} organizations (bootstrap seed scale).`,
    );
  }

  if (!getDeploymentMetadata().gitCommitSha) {
    warnings.push(
      "Git commit SHA is unavailable. Set VERCEL_GIT_COMMIT_SHA (automatic on Vercel) or GIT_COMMIT_SHA at build time.",
    );
  }

  return warnings;
}

export interface ComputeRuntimeDiagnosticsOptions {
  skipHydration?: boolean;
}

/** Snapshot for /diagnostics and /api/diagnostics/runtime — compare local vs production. */
export async function computeRuntimeDiagnostics(
  options: ComputeRuntimeDiagnosticsOptions = {},
): Promise<RuntimeDiagnostics> {
  const deployment = getDeploymentMetadata();
  const databaseConfigured = isDatabaseConfigured();

  let hydration = getLastWarehouseHydrationResult();
  if (
    !options.skipHydration &&
    isOrganizationWarehouseEnabled() &&
    !shouldUseOrganizationWarehouse()
  ) {
    hydration = await ensureOrganizationWarehouseHydrated();
  }

  const warehouse = computeOrganizationWarehouseDiagnostics();
  const connectors = buildConnectorSnapshots(hydration);
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
      databaseConfigured,
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
      hydration,
    },
    warnings: buildWarnings({
      enabled,
      activeForSearch,
      databaseConfigured,
      connectors,
      totalOrganizations: warehouse.totalOrganizations,
      hydration,
      environment: deployment.environment,
    }),
  };
}
