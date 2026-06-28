import { isDatabaseConfigured } from "@/lib/db";
import { getHealthPlanIndexSize } from "./memoryIndex";

/** True when HEALTH_PLAN_PERSISTENT_SOURCE=1. */
export function isHealthPlanPersistentSourceEnabled(): boolean {
  return process.env.HEALTH_PLAN_PERSISTENT_SOURCE === "1";
}

/**
 * Use Neon-backed / imported health plan catalog instead of healthPlans.ts.
 * Requires the feature flag and a populated in-memory index (import or hydration).
 */
export function shouldUsePersistentHealthPlanCatalog(): boolean {
  return isHealthPlanPersistentSourceEnabled() && getHealthPlanIndexSize() > 0;
}

/** True when persistent mode is requested but Neon is not configured. */
export function healthPlanPersistentSourceUnavailable(): boolean {
  return isHealthPlanPersistentSourceEnabled() && !isDatabaseConfigured();
}
