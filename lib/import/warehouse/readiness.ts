import { healthPlansConnectorApi } from "./connectors/healthPlans";
import { manufacturersConnectorApi } from "./connectors/manufacturers";
import { isOrganizationWarehouseEnabled } from "./featureFlag";
import {
  ensureOrganizationWarehouseHydrated,
  type WarehouseHydrationResult,
} from "./hydration";

/** How the search pipeline resolved warehouse availability for this request. */
export type WarehouseDiscoveryStatus =
  | "warehouse-hydrated"
  | "hydration-failed"
  | "warehouse-empty"
  | "bootstrap-intentional"
  | "bootstrap-fallback"
  | "disabled";

export interface WarehouseReadiness {
  /** When true, search must use organization-warehouse discovery. */
  useWarehouse: boolean;
  status: WarehouseDiscoveryStatus;
  indexSize: number;
  hydrationAttemptedAt: string | null;
  reason: string | null;
  hydration: WarehouseHydrationResult | null;
}

function warehouseIndexSize(): number {
  return (
    healthPlansConnectorApi.getIndexSize() +
    manufacturersConnectorApi.getIndexSize()
  );
}

/**
 * Await Neon hydration, then decide whether this request should use the warehouse.
 * Never returns useWarehouse=true before hydration has been attempted.
 */
export async function resolveOrganizationWarehouseReadiness(): Promise<WarehouseReadiness> {
  if (!isOrganizationWarehouseEnabled()) {
    return {
      useWarehouse: false,
      status: "disabled",
      indexSize: warehouseIndexSize(),
      hydrationAttemptedAt: null,
      reason:
        "Organization warehouse disabled (ORG_WAREHOUSE=0 or non-production)",
      hydration: null,
    };
  }

  const hydration = await ensureOrganizationWarehouseHydrated();
  const indexSize = warehouseIndexSize();

  if (indexSize > 0) {
    return {
      useWarehouse: true,
      status: "warehouse-hydrated",
      indexSize,
      hydrationAttemptedAt: hydration.attemptedAt,
      reason: null,
      hydration,
    };
  }

  if (!hydration.databaseConfigured) {
    return {
      useWarehouse: false,
      status: "bootstrap-intentional",
      indexSize: 0,
      hydrationAttemptedAt: hydration.attemptedAt,
      reason: "DATABASE_URL is not configured; using bootstrap catalogs",
      hydration,
    };
  }

  const hydrationFailed = hydration.connectors.some((c) => c.status === "failed");
  if (hydrationFailed) {
    return {
      useWarehouse: false,
      status: "hydration-failed",
      indexSize: 0,
      hydrationAttemptedAt: hydration.attemptedAt,
      reason: hydration.error ?? "Warehouse hydration failed",
      hydration,
    };
  }

  const warehouseEmpty =
    hydration.totalLoaded === 0 ||
    hydration.connectors.every(
      (c) =>
        c.status === "empty" ||
        c.status === "skipped" ||
        c.organizationsInDb === 0,
    );

  if (warehouseEmpty) {
    return {
      useWarehouse: false,
      status: "warehouse-empty",
      indexSize: 0,
      hydrationAttemptedAt: hydration.attemptedAt,
      reason:
        hydration.error ??
        "Neon warehouse is empty; run warehouse import before search",
      hydration,
    };
  }

  return {
    useWarehouse: false,
    status: "bootstrap-fallback",
    indexSize: 0,
    hydrationAttemptedAt: hydration.attemptedAt,
    reason:
      hydration.error ??
      "Warehouse hydration completed but the in-memory index is empty",
    hydration,
  };
}
