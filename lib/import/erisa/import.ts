import { eq, and } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  organizations,
  externalIds,
  organizationSources,
  erisaFilings,
} from "@/lib/db/schema";
import type { Organization } from "@/lib/discovery/organization";
import type { ErisaCsvRow, ErisaImportStats } from "./types";
import { parseErisaCsv } from "./parseCsv";
import {
  filingKeyForRow,
  normalizeSponsorNameKey,
  organizationFromErisaRow,
} from "./organizationFromFiling";
import { mergeErisaTags, buildErisaTags } from "./tags";
import { indexErisaRows } from "./memoryIndex";
import { markErisaIndexLoaded } from "./hydrateIndex";
import { ERISA_CONNECTOR_ID, ERISA_SOURCE_NAME } from "./types";

async function findOrganizationIdByEin(ein: string): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const hit = await db
    .select({ organizationId: externalIds.organizationId })
    .from(externalIds)
    .where(and(eq(externalIds.idType, "ein"), eq(externalIds.idValue, ein)))
    .limit(1);
  return hit[0]?.organizationId ?? null;
}

async function findOrganizationIdByNameState(
  name: string,
  state: string | null,
): Promise<string | null> {
  if (!isDatabaseConfigured() || !state) return null;
  const db = getDb();
  const key = normalizeSponsorNameKey(name, state);
  const rows = await db
    .select({
      id: organizations.id,
      canonicalName: organizations.canonicalName,
      states: organizations.states,
    })
    .from(organizations)
    .where(eq(organizations.organizationType, "employer"));
  for (const row of rows) {
    const stateList = (row.states as string[]) ?? [];
    if (!stateList.includes(state)) continue;
    if (normalizeSponsorNameKey(row.canonicalName, state) === key) {
      return row.id;
    }
  }
  return null;
}

async function upsertOrganizationRow(
  row: ErisaCsvRow,
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
    ? organizationFromErisaRow(row, {
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
          (existingOrg.buyerPack as Organization["buyerPack"]) ?? "employers",
        canonicalOrganizationType: existingOrg.canonicalOrganizationType,
        tags: (existingOrg.tags as string[]) ?? [],
      })
    : organizationFromErisaRow(row);

  const tags = existingOrg
    ? mergeErisaTags((existingOrg.tags as string[]) ?? [], buildErisaTags(row))
    : buildErisaTags(row);

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
      tags,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: organizations.id,
      set: {
        canonicalName: base.canonicalName,
        aliases: base.aliases,
        headquarters: base.headquarters,
        locations: base.locations,
        states: base.states,
        regions: base.regions,
        memberEstimate: base.memberEstimate,
        description: base.description,
        tags,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(externalIds)
    .values({
      organizationId: base.id,
      idType: "ein",
      idValue: row.sponsorEin,
      sourceConnector: ERISA_CONNECTOR_ID,
    })
    .onConflictDoNothing();

  const sourceId = filingKeyForRow(row);
  await db
    .insert(organizationSources)
    .values({
      organizationId: base.id,
      connector: ERISA_CONNECTOR_ID,
      sourceId,
      sourceName: ERISA_SOURCE_NAME,
      sourceUrl:
        "https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/public-disclosure/foia/form-5500-datasets",
      lastUpdated: String(row.filingYear),
      confidence: "0.88",
      retrievedAt: new Date(),
      evidence: [
        "ERISA Form 5500 filing",
        row.selfFunded ? "Self-funded plan" : "Insured plan",
      ],
    })
    .onConflictDoNothing();

  await db
    .insert(erisaFilings)
    .values({
      organizationId: base.id,
      filingKey: filingKeyForRow(row),
      sponsorEin: row.sponsorEin,
      sponsorName: row.sponsorName,
      sponsorState: row.sponsorState,
      sponsorCity: row.sponsorCity,
      planName: row.planName,
      planNumber: row.planNumber,
      filingYear: row.filingYear,
      participantCount: row.participantCount,
      healthWelfarePlan: row.healthWelfarePlan,
      selfFunded: row.selfFunded,
      fundingArrangement: row.fundingArrangement,
      welfareBenefitTypes: row.welfareBenefitTypes,
      ackId: row.ackId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: erisaFilings.filingKey,
      set: {
        participantCount: row.participantCount,
        healthWelfarePlan: row.healthWelfarePlan,
        selfFunded: row.selfFunded,
        fundingArrangement: row.fundingArrangement,
        welfareBenefitTypes: row.welfareBenefitTypes,
        updatedAt: new Date(),
      },
    });

  return base.id;
}

/** Import Form 5500 CSV rows into Neon (when configured) and refresh memory index. */
export async function importErisaRows(
  rows: ErisaCsvRow[],
): Promise<ErisaImportStats> {
  const stats: ErisaImportStats = {
    rowsParsed: rows.length,
    organizationsUpserted: 0,
    filingsUpserted: 0,
    serviceProvidersUpserted: 0,
    skipped: 0,
  };

  if (isDatabaseConfigured()) {
    for (const row of rows) {
      let orgId = await findOrganizationIdByEin(row.sponsorEin);
      if (!orgId) {
        orgId = await findOrganizationIdByNameState(
          row.sponsorName,
          row.sponsorState,
        );
      }
      await upsertOrganizationRow(row, orgId);
      stats.organizationsUpserted += 1;
      stats.filingsUpserted += 1;
    }
  }

  indexErisaRows(rows);
  markErisaIndexLoaded();
  return stats;
}

/** Import Form 5500 CSV file contents. */
export async function importErisaCsv(
  csvText: string,
): Promise<ErisaImportStats> {
  const rows = parseErisaCsv(csvText);
  return importErisaRows(rows);
}

/** Load all ERISA orgs from Neon into the in-memory search index. */
export async function refreshErisaIndexFromDb(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();
  const filingRows = await db.select().from(erisaFilings);
  if (filingRows.length === 0) return 0;

  const parsed: ErisaCsvRow[] = filingRows.map((f) => ({
    sponsorEin: f.sponsorEin,
    sponsorName: f.sponsorName,
    sponsorState: f.sponsorState,
    sponsorCity: f.sponsorCity,
    planName: f.planName,
    planNumber: f.planNumber,
    filingYear: f.filingYear,
    participantCount: f.participantCount,
    healthWelfarePlan: f.healthWelfarePlan,
    selfFunded: f.selfFunded,
    fundingArrangement: f.fundingArrangement,
    welfareBenefitTypes: (f.welfareBenefitTypes as string[]) ?? [],
    ackId: f.ackId,
  }));

  indexErisaRows(parsed);
  markErisaIndexLoaded();
  return parsed.length;
}
