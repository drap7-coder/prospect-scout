import { MANUFACTURERS_DIRECTORY } from "@/lib/directories/manufacturers";
import { normalizeDirectoryRecord } from "@/lib/directories/types";
import type { OrganizationRecord } from "@/lib/directories/types";
import type { Organization } from "@/lib/discovery/organization";
import { getManufacturerOrganizations } from "./memoryIndex";
import { shouldUseBootstrapManufacturerSeed } from "./featureFlag";

/** Manufacturer directory records for legacy directory search paths. */
export function getManufacturerDirectoryRecords(): OrganizationRecord[] {
  if (!shouldUseBootstrapManufacturerSeed()) {
    return getManufacturerOrganizations().map(manufacturerToDirectoryRecord);
  }
  return MANUFACTURERS_DIRECTORY.map(normalizeDirectoryRecord);
}

/** Manufacturer organizations from the warehouse in-memory index. */
export function getManufacturerOrganizationsForDiscovery(): Organization[] {
  return getManufacturerOrganizations();
}

function manufacturerToDirectoryRecord(org: Organization): OrganizationRecord {
  return {
    id: org.id,
    name: org.canonicalName,
    aliases: org.aliases,
    organizationType: "manufacturer",
    sectorId: org.sectorId ?? "manufacturing",
    industryId: org.industries[0],
    organizationTypeId: org.organizationType ?? undefined,
    industry: org.industries[0] ?? "manufacturing",
    website: org.website ?? undefined,
    headquarters: org.headquarters ?? "",
    statesServed: org.states,
    regions: org.regions,
    buyerPack: "manufacturers",
    tags: org.tags,
  };
}
