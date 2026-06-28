import { HEALTH_PLANS_DIRECTORY } from "@/lib/directories/healthPlans";
import { normalizeDirectoryRecord } from "@/lib/directories/types";
import type { OrganizationRecord } from "@/lib/directories/types";
import type { Organization } from "@/lib/discovery/organization";
import { getHealthPlanOrganizations } from "./memoryIndex";
import { shouldUseBootstrapHealthPlanSeed } from "./featureFlag";
import { organizationToDirectoryRecord } from "./organizationToDirectoryRecord";

/** Health plan directory records for legacy directory search paths. */
export function getHealthPlanDirectoryRecords(): OrganizationRecord[] {
  if (!shouldUseBootstrapHealthPlanSeed()) {
    return getHealthPlanOrganizations().map(organizationToDirectoryRecord);
  }
  return HEALTH_PLANS_DIRECTORY.map(normalizeDirectoryRecord);
}

/** Health plan organizations from the persistent in-memory index. */
export function getHealthPlanOrganizationsForDiscovery(): Organization[] {
  return getHealthPlanOrganizations();
}
