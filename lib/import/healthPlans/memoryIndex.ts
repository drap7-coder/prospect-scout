import type { Organization } from "@/lib/discovery/organization";
import { resetHealthPlanHydrationCache } from "./hydrateIndex";

let orgById = new Map<string, Organization>();

/** Replace the in-memory health plan index. */
export function setHealthPlanIndex(organizations: Organization[]): void {
  orgById = new Map(organizations.map((org) => [org.id, org]));
}

export function clearHealthPlanIndex(): void {
  setHealthPlanIndex([]);
  resetHealthPlanHydrationCache();
}

export function getHealthPlanIndexSize(): number {
  return orgById.size;
}

/** Upsert organizations into the in-memory health plan index. */
export function indexHealthPlanOrganizations(
  organizations: Organization[],
): Organization[] {
  for (const org of organizations) {
    orgById.set(org.id, org);
  }
  return [...orgById.values()];
}

/** Read all indexed health plan organizations. */
export function getHealthPlanOrganizations(): Organization[] {
  return [...orgById.values()];
}

/** Lookup a single indexed health plan organization by id. */
export function getHealthPlanOrganizationById(
  id: string,
): Organization | undefined {
  return orgById.get(id);
}
