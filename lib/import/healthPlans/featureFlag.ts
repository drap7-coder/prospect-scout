import {
  isOrganizationWarehouseEnabled,
  shouldUseOrganizationWarehouse,
} from "@/lib/import/warehouse/featureFlag";
import { getHealthPlanIndexSize } from "./memoryIndex";

/**
 * @deprecated Use isOrganizationWarehouseEnabled from @/lib/import/warehouse
 */
export function isHealthPlanPersistentSourceEnabled(): boolean {
  return isOrganizationWarehouseEnabled();
}

/** True when the health-plans warehouse connector index is populated. */
export function shouldUsePersistentHealthPlanCatalog(): boolean {
  return isOrganizationWarehouseEnabled() && getHealthPlanIndexSize() > 0;
}

/** Bootstrap seed (healthPlans.ts) — dev fallback when warehouse catalog is unavailable. */
export function shouldUseBootstrapHealthPlanSeed(): boolean {
  return !shouldUsePersistentHealthPlanCatalog();
}

/** @deprecated Neon optional — warehouse index may be memory-only after import. */
export function healthPlanPersistentSourceUnavailable(): boolean {
  return isOrganizationWarehouseEnabled() && getHealthPlanIndexSize() === 0;
}

export { shouldUseOrganizationWarehouse };
