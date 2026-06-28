import type { OrganizationRecord } from "@/lib/directories/types";
import type { Organization } from "@/lib/discovery/organization";

function tagSet(org: Organization): Set<string> {
  return new Set(org.tags ?? []);
}

/** Map a canonical Organization back to a directory record for legacy search paths. */
export function organizationToDirectoryRecord(org: Organization): OrganizationRecord {
  const tags = tagSet(org);
  return {
    id: org.id,
    name: org.canonicalName,
    aliases: org.aliases,
    organizationType: "health-plan",
    sectorId: org.sectorId ?? "healthcare",
    industryId: org.industries[0] ?? "payers",
    organizationTypeId: org.organizationType ?? "health-plan",
    industry: org.industries[0] ?? "health-plans",
    website: org.website ?? undefined,
    headquarters: org.headquarters ?? "Unknown",
    statesServed: org.states,
    regions: org.regions,
    memberEstimate: org.memberEstimate ?? undefined,
    employeeEstimate: org.employeeRange
      ? Number(org.employeeRange.replace(/[^\d]/g, "")) || undefined
      : undefined,
    commercial: tags.has("commercial"),
    medicare: tags.has("medicare"),
    medicaid: tags.has("medicaid"),
    exchange: tags.has("exchange"),
    aso: tags.has("aso"),
    tpa: tags.has("tpa"),
    publicCompany: org.ownership === "public",
    tags: org.tags,
    buyerPack: "health-plans",
  };
}
