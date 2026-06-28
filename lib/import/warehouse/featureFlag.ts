import { healthPlansConnectorApi } from "./connectors/healthPlans";
import { manufacturersConnectorApi } from "./connectors/manufacturers";

function warehouseIndexSize(): number {
  return healthPlansConnectorApi.getIndexSize() + manufacturersConnectorApi.getIndexSize();
}

/**
 * Organization Warehouse is the default runtime catalog in production.
 *
 * Set ORG_WAREHOUSE=0 to force bootstrap seed directories.
 * Set ORG_WAREHOUSE=1 to force warehouse mode in development.
 *
 * Legacy: HEALTH_PLAN_PERSISTENT_SOURCE is still honored for compatibility.
 */
export function isOrganizationWarehouseEnabled(): boolean {
  const explicit = process.env.ORG_WAREHOUSE ?? process.env.HEALTH_PLAN_PERSISTENT_SOURCE;
  if (explicit === "0") return false;
  if (explicit === "1") return true;
  return process.env.NODE_ENV === "production";
}

/** True when warehouse mode is active and at least one connector index is populated. */
export function shouldUseOrganizationWarehouse(): boolean {
  return isOrganizationWarehouseEnabled() && warehouseIndexSize() > 0;
}

/**
 * Sync check only — may be false on cold serverless instances before hydration.
 * Production search must call resolveOrganizationWarehouseReadiness() first.
 */

/** Bootstrap seed directories when warehouse catalog is unavailable. */
export function shouldUseBootstrapSeedCatalog(): boolean {
  return !shouldUseOrganizationWarehouse();
}
