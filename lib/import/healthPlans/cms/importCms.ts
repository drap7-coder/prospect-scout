import { getDb, isDatabaseConfigured } from "@/lib/db";
import { externalIds, organizationSources, organizations } from "@/lib/db/schema";
import type { Organization } from "@/lib/discovery/organization";
import {
  getHealthPlanOrganizations,
  getHealthPlanIndexSize,
  indexHealthPlanOrganizations,
} from "../memoryIndex";
import { markHealthPlanIndexLoaded } from "../hydrateIndex";
import {
  importHealthPlanSeed,
  importHealthPlanSeedRows,
} from "../import";
import { parseHealthPlanSeed } from "../parseSeed";
import {
  externalIdsForSeedRow,
  organizationFromSeedRow,
} from "../organizationFromRecord";
import type {
  CmsImportPaths,
  CmsImportStats,
  HealthPlanFullImportStats,
  HealthPlanImportCandidate,
  HealthPlanExternalId,
} from "./types";
import { defaultCmsImportPaths } from "./fixtures";
import { parseCmsCpscCsvFile } from "./parseCpsc";
import { parseCmsQhpCsvFile } from "./parseQhp";
import { parseCmsMedicaidMcoCsvFile } from "./parseMedicaidMco";
import {
  candidateFromCpscOrganization,
  candidateFromMedicaidMco,
  candidateFromQhpIssuer,
} from "./organizationFromCms";
import { mergeHealthPlanCatalog } from "./mergeCatalog";

async function upsertCmsCandidate(candidate: HealthPlanImportCandidate): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const org = candidate.organization;

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

  for (const ext of candidate.externalIds) {
    await db
      .insert(externalIds)
      .values({
        organizationId: org.id,
        idType: ext.idType,
        idValue: ext.idValue,
        sourceConnector: org.sources[0]?.connector ?? "cms-import",
      })
      .onConflictDoNothing();
  }
}

function seedCatalogEntries(): {
  organization: Organization;
  externalIds: HealthPlanExternalId[];
}[] {
  return parseHealthPlanSeed().map((row) => ({
    organization: organizationFromSeedRow(row),
    externalIds: externalIdsForSeedRow(row),
  }));
}

function buildCmsCandidates(paths: CmsImportPaths): {
  candidates: HealthPlanImportCandidate[];
  cpscRowsParsed: number;
  qhpRowsParsed: number;
  medicaidRowsParsed: number;
} {
  const cpscOrgs = parseCmsCpscCsvFile(paths.cpscCsv);
  const qhpIssuers = parseCmsQhpCsvFile(paths.qhpCsv);
  const mcoOrgs = parseCmsMedicaidMcoCsvFile(paths.medicaidMcoCsv);

  const candidates: HealthPlanImportCandidate[] = [
    ...cpscOrgs.map((org) => candidateFromCpscOrganization(org)),
    ...qhpIssuers.map((issuer) => candidateFromQhpIssuer(issuer)),
    ...mcoOrgs.map((mco) => candidateFromMedicaidMco(mco)),
  ];

  return {
    candidates,
    cpscRowsParsed: cpscOrgs.length,
    qhpRowsParsed: qhpIssuers.length,
    medicaidRowsParsed: mcoOrgs.length,
  };
}

/** Return merged seed + CMS catalog entries with external ids (tests/diagnostics). */
export function getMergedHealthPlanCatalogEntries(
  paths: CmsImportPaths = defaultCmsImportPaths(),
) {
  const existingEntries = seedCatalogEntries();
  const { candidates } = buildCmsCandidates(paths);
  return mergeHealthPlanCatalog(existingEntries, candidates).catalogEntries;
}

/** Import CMS public-source health plan fixtures into the memory index (and Neon when configured). */
export async function importCmsHealthPlanCatalog(
  paths: CmsImportPaths = defaultCmsImportPaths(),
): Promise<CmsImportStats> {
  const existingEntries = seedCatalogEntries();
  const { candidates, cpscRowsParsed, qhpRowsParsed, medicaidRowsParsed } =
    buildCmsCandidates(paths);

  const merged = mergeHealthPlanCatalog(existingEntries, candidates);
  indexHealthPlanOrganizations(merged.organizations);
  markHealthPlanIndexLoaded();

  let externalIdsAttached = 0;
  if (isDatabaseConfigured()) {
    for (const entry of merged.catalogEntries) {
      await upsertCmsCandidate({
        organization: entry.organization,
        externalIds: entry.externalIds,
      });
      externalIdsAttached += entry.externalIds.length;
    }
  } else {
    externalIdsAttached = merged.catalogEntries.reduce(
      (sum, entry) => sum + entry.externalIds.length,
      0,
    );
  }

  return {
    cpscRowsParsed,
    qhpRowsParsed,
    medicaidRowsParsed,
    candidatesBuilt: candidates.length,
    organizationsMerged: merged.mergedCount,
    organizationsAdded: merged.addedCount,
    externalIdsAttached,
    indexSizeAfterImport: getHealthPlanIndexSize(),
  };
}

/** Import bootstrap seed plus CMS public-source catalog expansion. */
export async function importHealthPlanFullCatalog(
  paths: CmsImportPaths = defaultCmsImportPaths(),
): Promise<HealthPlanFullImportStats> {
  const seed = await importHealthPlanSeed();
  const cms = await importCmsHealthPlanCatalog(paths);
  return {
    seed,
    cms,
    totalIndexSize: getHealthPlanIndexSize(),
  };
}

/** Rebuild memory index from seed rows only (legacy 24-plan import). */
export async function importHealthPlanSeedOnly(): Promise<HealthPlanFullImportStats["seed"]> {
  return importHealthPlanSeedRows(parseHealthPlanSeed());
}

export function getIndexedHealthPlanOrganizations(): Organization[] {
  return getHealthPlanOrganizations();
}
