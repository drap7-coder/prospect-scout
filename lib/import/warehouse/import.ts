import { healthPlansConnectorApi } from "./connectors/healthPlans";
import { manufacturersConnectorApi } from "./connectors/manufacturers";
import type { RegressionFinding } from "@/lib/import/healthPlans/importRegression";
import type { CmsImportStats } from "@/lib/import/healthPlans/cms/types";
import type { ManufacturerImportStats } from "@/lib/import/manufacturers/types";
import type {
  OrganizationWarehouseImportResult,
  WarehouseConnectorImportOutcome,
  WarehouseConnectorImportStatus,
} from "./types";

/**
 * Production: fail import when a required connector fails (WAREHOUSE_STRICT_IMPORT=1).
 * Development: continue with successful connectors (WAREHOUSE_STRICT_IMPORT=0).
 */
export function isWarehouseStrictImport(): boolean {
  const explicit = process.env.WAREHOUSE_STRICT_IMPORT;
  if (explicit === "1") return true;
  if (explicit === "0") return false;
  return process.env.NODE_ENV === "production";
}

async function importHealthPlansConnector(): Promise<{
  outcome: WarehouseConnectorImportOutcome;
  stats: (CmsImportStats & { regressionFindings: RegressionFinding[] }) | null;
}> {
  const backup = healthPlansConnectorApi.getOrganizations();
  try {
    const stats = await healthPlansConnectorApi.importNational();
    return { outcome: { id: "health-plans", status: "success" }, stats };
  } catch (error) {
    healthPlansConnectorApi.restoreIndex?.(backup);
    const message = error instanceof Error ? error.message : String(error);
    const status: WarehouseConnectorImportStatus =
      backup.length > 0 ? "warning" : "failed";
    return {
      outcome: {
        id: "health-plans",
        status,
        error: message,
        restoredPreviousIndex: backup.length,
      },
      stats: null,
    };
  }
}

function importManufacturersConnector(): Promise<{
  outcome: WarehouseConnectorImportOutcome;
  stats: ManufacturerImportStats | null;
}> {
  const backup = manufacturersConnectorApi.getOrganizations();
  return (async () => {
    try {
      const stats = await manufacturersConnectorApi.importNationalToDb();
      return { outcome: { id: "manufacturers", status: "success" as const }, stats };
    } catch (error) {
      manufacturersConnectorApi.restoreIndex?.(backup);
      const message = error instanceof Error ? error.message : String(error);
      const status: WarehouseConnectorImportStatus =
        backup.length > 0 ? "warning" : "failed";
      return {
        outcome: {
          id: "manufacturers",
          status,
          error: message,
          restoredPreviousIndex: backup.length,
        },
        stats: null,
      };
    }
  })();
}

/** Import all production connectors independently; failed connectors never corrupt others. */
export async function importOrganizationWarehouse(): Promise<OrganizationWarehouseImportResult> {
  const strictMode = isWarehouseStrictImport();
  const hp = await importHealthPlansConnector();
  const mfg = await importManufacturersConnector();
  const connectorOutcomes = [hp.outcome, mfg.outcome];
  const failures = connectorOutcomes.filter((o) => o.status === "failed");
  const hadFailures = failures.length > 0;

  if (strictMode && hadFailures) {
    const summary = failures.map((f) => `${f.id}: ${f.error}`).join("\n");
    throw new Error(
      `Organization warehouse import failed (${failures.length} connector(s)):\n${summary}`,
    );
  }

  return {
    healthPlans: hp.stats,
    manufacturers: mfg.stats,
    totalIndexSize:
      healthPlansConnectorApi.getIndexSize() + manufacturersConnectorApi.getIndexSize(),
    connectorOutcomes,
    strictMode,
    hadFailures,
  };
}

/** Fetch remote source data for all production warehouse connectors. */
export async function fetchOrganizationWarehouseSources() {
  const outcomes = await Promise.allSettled([
    healthPlansConnectorApi.fetch(),
    manufacturersConnectorApi.fetch(),
  ]);
  return {
    healthPlans:
      outcomes[0].status === "fulfilled"
        ? outcomes[0].value
        : { error: String((outcomes[0] as PromiseRejectedResult).reason) },
    manufacturers:
      outcomes[1].status === "fulfilled"
        ? outcomes[1].value
        : { error: String((outcomes[1] as PromiseRejectedResult).reason) },
  };
}

export type OrganizationWarehouseImportStats = OrganizationWarehouseImportResult;
