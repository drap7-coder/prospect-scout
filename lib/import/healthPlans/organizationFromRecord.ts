import { sourceStamp } from "@/lib/discovery/connector";
import {
  deriveDomain,
  finalizeOrganization,
  type Organization,
} from "@/lib/discovery/organization";
import type { HealthPlanSeedRow } from "./types";
import {
  HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID,
  HEALTH_PLAN_BOOTSTRAP_SOURCE_NAME,
} from "./types";
import {
  applyHealthPlanWarehouseFields,
  buildHealthPlanOrganizationFields,
  type HealthPlanMarketSegmentId,
} from "./warehouseMapping";

function normalizeCmsContract(contractId: string): string {
  return contractId.trim().toUpperCase();
}

/** Build organization tags from seed row metadata. */
export function buildHealthPlanTags(row: HealthPlanSeedRow): string[] {
  return [...new Set(row.tags)];
}

/** External registry ids to persist for a bootstrap health plan row. */
export function externalIdsForSeedRow(row: HealthPlanSeedRow): {
  idType: "cms_contract" | "hios" | "naic" | "npi" | "domain";
  idValue: string;
}[] {
  const ids: {
    idType: "cms_contract" | "hios" | "naic" | "npi" | "domain";
    idValue: string;
  }[] = [];

  for (const contract of row.cmsContracts) {
    const value = normalizeCmsContract(contract);
    if (value) ids.push({ idType: "cms_contract", idValue: value });
  }
  if (row.naicId?.trim()) {
    ids.push({ idType: "naic", idValue: row.naicId.trim() });
  }
  for (const npi of row.npiIds) {
    const value = npi.replace(/\D/g, "");
    if (value.length === 10) ids.push({ idType: "npi", idValue: value });
  }
  const domain = row.website ? deriveDomain(row.website) : null;
  if (domain) ids.push({ idType: "domain", idValue: domain });

  return ids;
}

function marketSegmentFromTags(tags: string[]): HealthPlanMarketSegmentId {
  const hay = tags.join(" ").toLowerCase();
  if (/\baca\b|\bmarketplace\b|\bqhp\b/.test(hay)) return "aca_marketplace";
  if (/\bmedicaid\b|\bmanaged-medicaid\b/.test(hay)) return "medicaid_managed_care";
  if (/\bpart d\b|\bpart-d\b/.test(hay)) return "part_d";
  if (/\bmedicare-advantage\b|\bma\b/.test(hay)) return "medicare_advantage";
  return "commercial";
}

/** Normalize a bootstrap seed row into a canonical Organization. */
export function organizationFromSeedRow(
  row: HealthPlanSeedRow,
  existing?: Organization,
): Organization {
  const tags = buildHealthPlanTags(row);
  const mergedTags = existing?.tags
    ? [...new Set([...existing.tags, ...tags])]
    : tags;
  const domain = row.website ? deriveDomain(row.website) : null;
  const aliases = new Set([...row.aliases, ...(existing?.aliases ?? [])]);
  if (row.ticker) aliases.add(row.ticker);
  const states = [...new Set([...row.statesServed, ...(existing?.states ?? [])])];
  const regions = [...new Set([...row.regions, ...(existing?.regions ?? [])])];
  const externalIds = externalIdsForSeedRow(row);

  const evidence = [
    "Curated health plan bootstrap seed",
    row.parentOrganization ? `Parent: ${row.parentOrganization}` : null,
    row.cmsContracts.length > 0
      ? `CMS contracts: ${row.cmsContracts.join(", ")}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const base = finalizeOrganization({
    id: existing?.id ?? row.id,
    canonicalName: existing?.canonicalName ?? row.name,
    aliases: [...aliases],
    website: row.website ?? existing?.website ?? null,
    domain: domain ?? existing?.domain ?? null,
    organizationType: "health-plan",
    industries: row.industryId ? [row.industryId] : ["payers"],
    sectorId: row.sectorId ?? "healthcare",
    headquarters: row.headquarters,
    locations: row.headquarters ? [row.headquarters] : [],
    states,
    regions,
    ownership: row.ownership,
    employeeRange: row.employeeEstimate
      ? String(row.employeeEstimate)
      : existing?.employeeRange ?? null,
    memberEstimate: row.memberEstimate ?? existing?.memberEstimate ?? null,
    revenueRange: existing?.revenueRange ?? null,
    description:
      existing?.description ??
      (row.parentOrganization ? `Part of ${row.parentOrganization}` : null),
    sources: [
      sourceStamp(HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID, row.id, evidence, {
        sourceName: HEALTH_PLAN_BOOTSTRAP_SOURCE_NAME,
        sourceUrl: "lib/directories/healthPlans.ts",
        lastUpdated: new Date().toISOString().slice(0, 10),
        confidence: 0.95,
      }),
      ...(existing?.sources.filter(
        (s) => s.connector !== HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID,
      ) ?? []),
    ],
    buyerPack: "health-plans",
    canonicalOrganizationType: "health-plan",
    tags: mergedTags,
  });

  const warehouseFields = buildHealthPlanOrganizationFields({
    parentOrganization: row.parentOrganization,
    states,
    regions,
    headquarters: row.headquarters,
    marketSegment: marketSegmentFromTags(mergedTags),
    externalIds,
    national: states.length === 0,
    tags: mergedTags,
  });

  return finalizeOrganization(applyHealthPlanWarehouseFields(base, warehouseFields));
}
