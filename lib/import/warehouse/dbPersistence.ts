import { eq, sql } from "drizzle-orm";
import type { Organization } from "@/lib/discovery/organization";
import { finalizeOrganization } from "@/lib/discovery/organization";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  organizations,
  externalIds,
  organizationSources,
} from "@/lib/db/schema";
import type { OrganizationRow } from "@/lib/db/schema/organizations";
import type { OrganizationSourceRow } from "@/lib/db/schema/organizationSources";
import { legacyHealthPlanClassifications } from "@/lib/import/healthPlans/cms/classificationsFromCms";
import type { SectorAttributes, OrganizationClassification } from "@/lib/organization/model";
import type {
  OrganizationMetric,
  OrganizationRelationship,
} from "@/lib/organization/intelligence";

export interface WarehouseExternalIdInput {
  idType: string;
  idValue: string;
  sourceConnector?: string;
}

type DbClassification = OrganizationClassification;
type DbMetric = OrganizationMetric;
type DbRelationship = OrganizationRelationship;

function classificationsFromRow(row: OrganizationRow): OrganizationClassification[] {
  const stored = (row.classifications as DbClassification[] | null) ?? [];
  if (stored.length > 0) return stored;
  return legacyHealthPlanClassifications(row.healthPlanType);
}

function geographyFromRow(row: OrganizationRow): Organization["geography"] {
  const stored = row.geography as Organization["geography"];
  if (stored?.states?.length || stored?.national) return stored;
  const states = (row.states as string[]) ?? [];
  const regions = (row.regions as string[]) ?? [];
  if (states.length === 0 && regions.length === 0 && !row.headquarters) {
    return stored ?? undefined;
  }
  return {
    states,
    regions,
    headquarters: row.headquarters ?? null,
    national: states.length === 0,
  };
}

function organizationFromDbRow(
  row: OrganizationRow,
  sources: OrganizationSourceRow[],
): Organization {
  const geography = geographyFromRow(row);
  const classifications = classificationsFromRow(row);
  const states = geography?.states?.length ? geography.states : ((row.states as string[]) ?? []);
  const regions = geography?.regions?.length ? geography.regions : ((row.regions as string[]) ?? []);

  return finalizeOrganization({
    id: row.id,
    canonicalName: row.canonicalName,
    aliases: (row.aliases as string[]) ?? [],
    website: row.website ?? null,
    domain: row.domain ?? null,
    organizationType: row.organizationType ?? null,
    industries: (row.industries as string[]) ?? [],
    sectorId: row.sectorId ?? null,
    headquarters: row.headquarters ?? null,
    locations: (row.locations as string[]) ?? [],
    states,
    regions,
    geography,
    classifications,
    sectorAttributes: ((row.sectorAttributes as SectorAttributes) ?? {}) as SectorAttributes,
    metrics: (row.metrics as DbMetric[]) ?? [],
    relationships: (row.relationships as DbRelationship[]) ?? [],
    ownership: row.ownership ?? null,
    employeeRange: row.employeeRange ?? null,
    memberEstimate: row.memberEstimate ?? null,
    revenueRange: row.revenueRange ?? null,
    description: row.description ?? null,
    sources: sources.map((src) => ({
      connector: src.connector,
      sourceId: src.sourceId,
      sourceName: src.sourceName ?? undefined,
      sourceUrl: src.sourceUrl ?? undefined,
      lastUpdated: src.lastUpdated ?? undefined,
      confidence: src.confidence != null ? Number(src.confidence) : undefined,
      retrievedAt: src.retrievedAt.toISOString(),
      evidence: (src.evidence as string[]) ?? [],
    })),
    buyerPack: (row.buyerPack as Organization["buyerPack"]) ?? null,
    canonicalOrganizationType: row.canonicalOrganizationType,
    healthPlanType:
      (row.healthPlanType as Organization["healthPlanType"]) ?? undefined,
    tags: (row.tags as string[]) ?? [],
  });
}

function intelligencePayload(org: Organization) {
  const normalized = finalizeOrganization(org);
  return {
    geography: normalized.geography ?? null,
    classifications: normalized.classifications ?? [],
    sectorAttributes: normalized.sectorAttributes ?? {},
    metrics: normalized.metrics ?? [],
    relationships: normalized.relationships ?? [],
  };
}

/** Count persisted warehouse organizations for a buyer pack. */
export async function countWarehouseOrganizationsInDb(
  buyerPack: string,
): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizations)
    .where(eq(organizations.buyerPack, buyerPack));
  return result[0]?.count ?? 0;
}

/** Load organizations for a buyer pack from Neon into memory-ready records. */
export async function loadWarehouseOrganizationsFromDb(
  buyerPack: string,
): Promise<Organization[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const orgRows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.buyerPack, buyerPack));

  if (orgRows.length === 0) return [];

  const loaded: Organization[] = [];
  for (const orgRow of orgRows) {
    const sources = await db
      .select()
      .from(organizationSources)
      .where(eq(organizationSources.organizationId, orgRow.id));
    loaded.push(organizationFromDbRow(orgRow, sources));
  }
  return loaded;
}

/** Upsert one warehouse organization and optional external ids. */
export async function upsertWarehouseOrganization(
  org: Organization,
  extIds: WarehouseExternalIdInput[] = [],
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const intel = intelligencePayload(org);

  await db
    .insert(organizations)
    .values({
      id: org.id,
      canonicalName: org.canonicalName,
      aliases: org.aliases,
      website: org.website,
      domain: org.domain,
      organizationType: org.organizationType,
      canonicalOrganizationType: org.canonicalOrganizationType,
      industries: org.industries,
      sectorId: org.sectorId,
      headquarters: org.headquarters,
      locations: org.locations,
      states: org.states,
      regions: org.regions,
      geography: intel.geography,
      classifications: intel.classifications,
      sectorAttributes: intel.sectorAttributes,
      metrics: intel.metrics,
      relationships: intel.relationships,
      ownership: org.ownership,
      employeeRange: org.employeeRange,
      memberEstimate: org.memberEstimate,
      revenueRange: org.revenueRange,
      description: org.description,
      buyerPack: org.buyerPack,
      healthPlanType: org.healthPlanType ?? null,
      tags: org.tags ?? [],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: organizations.id,
      set: {
        canonicalName: org.canonicalName,
        aliases: org.aliases,
        website: org.website,
        domain: org.domain,
        organizationType: org.organizationType,
        canonicalOrganizationType: org.canonicalOrganizationType,
        industries: org.industries,
        sectorId: org.sectorId,
        headquarters: org.headquarters,
        locations: org.locations,
        states: org.states,
        regions: org.regions,
        geography: intel.geography,
        classifications: intel.classifications,
        sectorAttributes: intel.sectorAttributes,
        metrics: intel.metrics,
        relationships: intel.relationships,
        ownership: org.ownership,
        employeeRange: org.employeeRange,
        memberEstimate: org.memberEstimate,
        description: org.description,
        buyerPack: org.buyerPack,
        healthPlanType: org.healthPlanType ?? null,
        tags: org.tags ?? [],
        updatedAt: new Date(),
      },
    });

  for (const source of org.sources) {
    await db
      .insert(organizationSources)
      .values({
        organizationId: org.id,
        connector: source.connector,
        sourceId: source.sourceId,
        sourceName: source.sourceName ?? null,
        sourceUrl: source.sourceUrl ?? null,
        lastUpdated: source.lastUpdated ?? null,
        confidence: source.confidence != null ? String(source.confidence) : null,
        retrievedAt: new Date(source.retrievedAt),
        evidence: source.evidence,
      })
      .onConflictDoNothing();
  }

  for (const ext of extIds) {
    await db
      .insert(externalIds)
      .values({
        organizationId: org.id,
        idType: ext.idType as typeof externalIds.$inferInsert.idType,
        idValue: ext.idValue,
        sourceConnector:
          ext.sourceConnector ?? org.sources[0]?.connector ?? "warehouse",
      })
      .onConflictDoNothing();
  }
}

/** Persist a batch of warehouse organizations to Neon. */
export async function persistWarehouseOrganizations(
  orgs: Organization[],
  externalIdsByOrgId: Map<string, WarehouseExternalIdInput[]> = new Map(),
): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  let count = 0;
  for (const org of orgs) {
    await upsertWarehouseOrganization(org, externalIdsByOrgId.get(org.id) ?? []);
    count += 1;
  }
  return count;
}
