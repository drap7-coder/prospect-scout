import type { Organization } from "@/lib/discovery/organization";
import { resetManufacturerHydrationCache } from "./hydrateIndex";

let orgById = new Map<string, Organization>();

export function setManufacturerIndex(organizations: Organization[]): void {
  orgById = new Map(organizations.map((org) => [org.id, org]));
}

export function clearManufacturerIndex(): void {
  setManufacturerIndex([]);
  resetManufacturerHydrationCache();
}

export function getManufacturerIndexSize(): number {
  return orgById.size;
}

export function indexManufacturerOrganizations(
  organizations: Organization[],
): Organization[] {
  for (const org of organizations) {
    orgById.set(org.id, org);
  }
  return [...orgById.values()];
}

export function getManufacturerOrganizations(): Organization[] {
  return [...orgById.values()];
}

export function getManufacturerOrganizationById(id: string): Organization | undefined {
  return orgById.get(id);
}
