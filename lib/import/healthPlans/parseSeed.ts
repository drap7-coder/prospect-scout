import { HEALTH_PLANS_DIRECTORY } from "@/lib/directories/healthPlans";
import type { OrganizationRecord } from "@/lib/directories/types";
import type { HealthPlanSeedRow } from "./types";

function inferOwnership(
  record: OrganizationRecord,
): HealthPlanSeedRow["ownership"] {
  if (record.publicCompany) return "public";
  if (record.organizationType === "municipality") return "government";
  return "nonprofit";
}

function buildSeedTags(record: OrganizationRecord): string[] {
  const tags = new Set(record.tags ?? []);
  if (record.commercial) tags.add("commercial");
  if (record.medicare) tags.add("medicare");
  if (record.medicaid) tags.add("medicaid");
  if (record.exchange) tags.add("exchange");
  if (record.aso) tags.add("aso");
  if (record.tpa) tags.add("tpa");
  if (record.ticker) tags.add(`ticker:${record.ticker}`);
  return [...tags];
}

function recordToSeedRow(record: OrganizationRecord): HealthPlanSeedRow {
  return {
    id: record.id,
    name: record.name,
    aliases: record.aliases,
    parentOrganization: record.parentOrganization,
    website: record.website,
    headquarters: record.headquarters,
    statesServed: record.statesServed,
    regions: record.regions,
    memberEstimate: record.memberEstimate,
    employeeEstimate: record.employeeEstimate,
    sectorId: record.sectorId ?? "healthcare",
    industryId: record.industryId ?? "payers",
    organizationType: record.organizationTypeId ?? record.organizationType,
    ownership: inferOwnership(record),
    cmsContracts: record.cmsContracts ?? [],
    naicId: record.naicId,
    npiIds: record.npiIds ?? [],
    tags: buildSeedTags(record),
    ticker: record.ticker,
  };
}

/** Parse curated healthPlans.ts directory records for bootstrap import. */
export function parseHealthPlanSeed(): HealthPlanSeedRow[] {
  return HEALTH_PLANS_DIRECTORY.map(recordToSeedRow);
}
