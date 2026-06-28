import { eq, and } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  organizations,
  externalIds,
  organizationSources,
} from "@/lib/db/schema";
import type { Organization } from "@/lib/discovery/organization";
import type { HealthPlanImportStats, HealthPlanSeedRow } from "./types";
import { parseHealthPlanSeed } from "./parseSeed";
import {
  externalIdsForSeedRow,
  organizationFromSeedRow,
} from "./organizationFromRecord";
import { indexHealthPlanOrganizations } from "./memoryIndex";
import { markHealthPlanIndexLoaded } from "./hydrateIndex";
import {
  HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID,
  HEALTH_PLAN_BOOTSTRAP_SOURCE_NAME,
} from "./types";

async function findOrganizationIdByExternalId(
  idType: "cms_contract" | "hios" | "naic" | "domain" | "npi",
  idValue: string,
): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const hit = await db
    .select({ organizationId: externalIds.organizationId })
    .from(externalIds)
    .where(and(eq(externalIds.idType, idType), eq(externalIds.idValue, idValue)))
    .limit(1);
  return hit[0]?.organizationId ?? null;
}

async function upsertOrganizationRow(
  row: HealthPlanSeedRow,
  existingId: string | null,
): Promise<string> {
  const db = getDb();
  const existingOrg = existingId
    ? (
        await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, existingId))
          .limit(1)
      )[0]
    : null;

  const base = existingOrg
    ? organizationFromSeedRow(row, {
        id: existingOrg.id,
        canonicalName: existingOrg.canonicalName,
        aliases: (existingOrg.aliases as string[]) ?? [],
        website: existingOrg.website,
        domain: existingOrg.domain,
        organizationType: existingOrg.organizationType,
        industries: (existingOrg.industries as string[]) ?? [],
        sectorId: existingOrg.sectorId,
        headquarters: existingOrg.headquarters,
        locations: (existingOrg.locations as string[]) ?? [],
        states: (existingOrg.states as string[]) ?? [],
        regions: (existingOrg.regions as string[]) ?? [],
        ownership: existingOrg.ownership,
        employeeRange: existingOrg.employeeRange,
        memberEstimate: existingOrg.memberEstimate,
        revenueRange: existingOrg.revenueRange,
        description: existingOrg.description,
        sources: [],
        buyerPack:
          (existingOrg.buyerPack as Organization["buyerPack"]) ?? "health-plans",
        canonicalOrganizationType: existingOrg.canonicalOrganizationType,
        tags: (existingOrg.tags as string[]) ?? [],
      })
    : organizationFromSeedRow(row);

  await db
    .insert(organizations)
    .values({
      id: base.id,
      canonicalName: base.canonicalName,
      aliases: base.aliases,
      website: base.website,
      domain: base.domain,
      organizationType: base.organizationType,
      canonicalOrganizationType: base.canonicalOrganizationType,
      industries: base.industries,
      sectorId: base.sectorId,
      headquarters: base.headquarters,
      locations: base.locations,
      states: base.states,
      regions: base.regions,
      ownership: base.ownership,
      employeeRange: base.employeeRange,
      memberEstimate: base.memberEstimate,
      revenueRange: base.revenueRange,
      description: base.description,
      buyerPack: base.buyerPack,
      healthPlanType: base.healthPlanType ?? null,
      tags: base.tags ?? [],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: organizations.id,
      set: {
        canonicalName: base.canonicalName,
        aliases: base.aliases,
        website: base.website,
        domain: base.domain,
        organizationType: base.organizationType,
        canonicalOrganizationType: base.canonicalOrganizationType,
        industries: base.industries,
        sectorId: base.sectorId,
        headquarters: base.headquarters,
        locations: base.locations,
        states: base.states,
        regions: base.regions,
        ownership: base.ownership,
        employeeRange: base.employeeRange,
        memberEstimate: base.memberEstimate,
        description: base.description,
        buyerPack: base.buyerPack,
        tags: base.tags ?? [],
        updatedAt: new Date(),
      },
    });

  await db
    .insert(organizationSources)
    .values({
      organizationId: base.id,
      connector: HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID,
      sourceId: row.id,
      sourceName: HEALTH_PLAN_BOOTSTRAP_SOURCE_NAME,
      sourceUrl: "lib/directories/healthPlans.ts",
      lastUpdated: new Date().toISOString().slice(0, 10),
      confidence: "0.95",
      retrievedAt: new Date(),
      evidence: [
        "Curated health plan bootstrap seed",
        row.parentOrganization ? `Parent: ${row.parentOrganization}` : "",
      ].filter(Boolean),
    })
    .onConflictDoNothing();

  for (const ext of externalIdsForSeedRow(row)) {
    await db
      .insert(externalIds)
      .values({
        organizationId: base.id,
        idType: ext.idType,
        idValue: ext.idValue,
        sourceConnector: HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID,
      })
      .onConflictDoNothing();
  }

  return base.id;
}

async function resolveOrganizationId(row: HealthPlanSeedRow): Promise<string | null> {
  const db = getDb();
  const byId = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, row.id))
    .limit(1);
  if (byId[0]?.id) return byId[0].id;

  for (const ext of externalIdsForSeedRow(row)) {
    const orgId = await findOrganizationIdByExternalId(ext.idType, ext.idValue);
    if (orgId) return orgId;
  }

  return null;
}

/** Import bootstrap seed rows into Neon (when configured) and refresh memory index. */
export async function importHealthPlanSeedRows(
  rows: HealthPlanSeedRow[],
): Promise<HealthPlanImportStats> {
  const stats: HealthPlanImportStats = {
    rowsParsed: rows.length,
    organizationsUpserted: 0,
    sourcesUpserted: 0,
    externalIdsUpserted: 0,
    skipped: 0,
  };

  const indexed: Organization[] = [];

  if (isDatabaseConfigured()) {
    for (const row of rows) {
      const existingId = await resolveOrganizationId(row);
      await upsertOrganizationRow(row, existingId);
      stats.organizationsUpserted += 1;
      stats.sourcesUpserted += 1;
      stats.externalIdsUpserted += externalIdsForSeedRow(row).length;
    }
  } else {
    stats.skipped = rows.length;
  }

  for (const row of rows) {
    indexed.push(organizationFromSeedRow(row));
  }
  indexHealthPlanOrganizations(indexed);
  markHealthPlanIndexLoaded();

  return stats;
}

/** Import curated healthPlans.ts bootstrap seed. */
export async function importHealthPlanSeed(): Promise<HealthPlanImportStats> {
  return importHealthPlanSeedRows(parseHealthPlanSeed());
}

/** Load health plan organizations from Neon into the in-memory index. */
export async function refreshHealthPlanIndexFromDb(): Promise<number> {
  const { loadWarehouseOrganizationsFromDb } = await import(
    "@/lib/import/warehouse/dbPersistence"
  );
  const loaded = await loadWarehouseOrganizationsFromDb("health-plans");
  if (loaded.length === 0) return 0;
  indexHealthPlanOrganizations(loaded);
  markHealthPlanIndexLoaded();
  return loaded.length;
}
