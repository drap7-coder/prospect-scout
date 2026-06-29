import { getDb, isDatabaseConfigured } from "@/lib/db";
import { externalIds, organizationSources } from "@/lib/db/schema";
import type { Organization } from "@/lib/discovery/organization";
import { upsertWarehouseOrganization } from "@/lib/import/warehouse/dbPersistence";
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
import { resolveCmsImportPaths, cmsImportMode } from "./resolvePaths";
import { parseCmsCpscCsvFile } from "./parseCpsc";
import { parseCmsQhpCsvFile } from "./parseQhp";
import { parseCmsMedicaidMcoCsvFile } from "./parseMedicaidMco";
import {
  parseCmsMedicaidEnrollmentCsvFile,
  countNetNewMedicaidEnrollmentPlans,
} from "./parseMedicaidEnrollment";
import {
  candidateFromCpscOrganization,
  candidateFromMedicaidMco,
  candidateFromMedicaidEnrollmentPlan,
  candidateFromQhpIssuer,
} from "./organizationFromCms";
import { mergeHealthPlanCatalog, dedupeCatalogEntriesByOrganizationId } from "./mergeCatalog";
import { enrichCatalogIdentity, type PossibleDuplicateReview } from "./identityEnrichment";
import { enrichCatalogDomains } from "@/lib/domainIntelligence/pipeline";
import {
  setHealthPlanCatalogImportManifest,
  countDuplicateOrganizationIds,
  countOrganizationsByConnector,
  type HealthPlanCatalogImportManifest,
} from "../catalogManifest";
import {
  evaluateImportRegression,
  buildImportBaseline,
  loadImportBaseline,
  saveImportBaseline,
  formatRegressionFindings,
  hasRegressionErrors,
  type RegressionFinding,
} from "../importRegression";
import { readCsvFile } from "./parseCsv";
import { countNetNewServiceAreaIssuers } from "./sources/mergeQhpSources";
import { existsSync } from "node:fs";

async function upsertCmsCandidate(candidate: HealthPlanImportCandidate): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const org = candidate.organization;

  await upsertWarehouseOrganization(
    org,
    candidate.externalIds.map((ext) => ({
      idType: ext.idType,
      idValue: ext.idValue,
      sourceConnector: org.sources[0]?.connector,
    })),
  );

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

function computeQhpNetNewFromServiceArea(qhpRaw: Record<string, string>[]): number {
  const planAttributes = qhpRaw.filter((row) =>
    (row.source_puf ?? "").includes("plan_attributes"),
  );
  const serviceArea = qhpRaw.filter((row) =>
    (row.source_puf ?? "").includes("service_area"),
  );
  if (serviceArea.length === 0) return 0;
  return countNetNewServiceAreaIssuers(planAttributes, serviceArea);
}

function buildCmsCandidates(paths: CmsImportPaths): {
  candidates: HealthPlanImportCandidate[];
  cpscRowsParsed: number;
  qhpRowsParsed: number;
  qhpIssuersParsed: number;
  qhpNetNewFromServiceArea: number;
  medicaidRowsParsed: number;
  medicaidEnrollmentRowsParsed: number;
  medicaidEnrollmentOrganizations: number;
  medicaidNetNewFromEnrollment: number;
  rawRecords: { cpsc: number; qhp: number; medicaid: number; medicaidEnrollment: number };
} {
  const cpscRaw = readCsvFile(paths.cpscCsv);
  const qhpRaw = readCsvFile(paths.qhpCsv);
  const medicaidRaw = readCsvFile(paths.medicaidMcoCsv);
  const medicaidEnrollmentRaw = existsSync(paths.medicaidEnrollmentCsv)
    ? readCsvFile(paths.medicaidEnrollmentCsv)
    : [];

  const cpscOrgs = parseCmsCpscCsvFile(paths.cpscCsv);
  const qhpIssuers = parseCmsQhpCsvFile(paths.qhpCsv);
  const mcoOrgs = parseCmsMedicaidMcoCsvFile(paths.medicaidMcoCsv);
  const enrollmentPlans = medicaidEnrollmentRaw.length
    ? parseCmsMedicaidEnrollmentCsvFile(paths.medicaidEnrollmentCsv)
    : [];

  const programMcoIds = new Set(mcoOrgs.flatMap((mco) => mco.mcoIds));
  const medicaidNetNewFromEnrollment = countNetNewMedicaidEnrollmentPlans(
    programMcoIds,
    enrollmentPlans,
  );

  const candidates: HealthPlanImportCandidate[] = [
    ...cpscOrgs.map((org) => candidateFromCpscOrganization(org)),
    ...qhpIssuers.map((issuer) => candidateFromQhpIssuer(issuer)),
    ...mcoOrgs.map((mco) => candidateFromMedicaidMco(mco)),
    ...enrollmentPlans.map((plan) => candidateFromMedicaidEnrollmentPlan(plan)),
  ];

  return {
    candidates,
    cpscRowsParsed: cpscOrgs.length,
    qhpRowsParsed: qhpRaw.length,
    qhpIssuersParsed: qhpIssuers.length,
    qhpNetNewFromServiceArea: computeQhpNetNewFromServiceArea(qhpRaw),
    medicaidRowsParsed: mcoOrgs.length,
    medicaidEnrollmentRowsParsed: medicaidEnrollmentRaw.length,
    medicaidEnrollmentOrganizations: enrollmentPlans.length,
    medicaidNetNewFromEnrollment,
    rawRecords: {
      cpsc: cpscRaw.length,
      qhp: qhpRaw.length,
      medicaid: medicaidRaw.length,
      medicaidEnrollment: medicaidEnrollmentRaw.length,
    },
  };
}

function recordImportManifest(
  merged: ReturnType<typeof mergeHealthPlanCatalog>,
  cmsStats: Omit<CmsImportStats, "indexSizeAfterImport">,
  options: {
    includeBootstrapSeed: boolean;
    rawRecords: {
      cpsc: number;
      qhp: number;
      medicaid: number;
      medicaidEnrollment: number;
    };
    possibleDuplicatesNeedsReview: number;
    identityEnrichmentApplied: number;
    regressionFindings: RegressionFinding[];
    possibleDuplicates: PossibleDuplicateReview[];
  },
): void {
  const organizations = merged.organizations;
  const byHealthPlanType = {
    medicareAdvantage: organizations.filter((o) => o.healthPlanType === "medicare_advantage")
      .length,
    acaMarketplace: organizations.filter((o) => o.healthPlanType === "aca_marketplace").length,
    medicaidManagedCare: organizations.filter(
      (o) => o.healthPlanType === "medicaid_managed_care",
    ).length,
  };

  const manifest: HealthPlanCatalogImportManifest = {
    importedAt: new Date().toISOString(),
    mode: options.includeBootstrapSeed ? "bootstrap-seed" : "production",
    includeBootstrapSeed: options.includeBootstrapSeed,
    cmsImportMode: cmsImportMode(),
    rawRecords: options.rawRecords,
    organizations: {
      total: organizations.length,
      merged: merged.mergedCount,
      added: merged.addedCount,
      duplicateIds: countDuplicateOrganizationIds(organizations),
    },
    byHealthPlanType,
    bySourceConnector: countOrganizationsByConnector(organizations),
    cmsStats: {
      ...cmsStats,
      indexSizeAfterImport: organizations.length,
    },
    identityEnrichmentApplied: options.identityEnrichmentApplied,
    possibleDuplicatesNeedsReview: options.possibleDuplicatesNeedsReview,
    regressionFindings: options.regressionFindings,
    possibleDuplicates: options.possibleDuplicates.slice(0, 100),
  };
  setHealthPlanCatalogImportManifest(manifest);
}

export interface ImportCmsOptions {
  includeBootstrapSeed?: boolean;
  /** When true, throw on regression errors (default for national import). */
  failOnRegression?: boolean;
}

/** Return merged seed + CMS catalog entries with external ids (tests/diagnostics). */
export function getMergedHealthPlanCatalogEntries(
  paths: CmsImportPaths = defaultCmsImportPaths(),
) {
  const existingEntries = seedCatalogEntries();
  const { candidates } = buildCmsCandidates(paths);
  const merged = mergeHealthPlanCatalog(existingEntries, candidates);
  const enriched = enrichCatalogIdentity(merged.catalogEntries);
  return enriched.entries;
}

/** Import CMS datasets into the memory index (and Neon when configured). */
export async function importCmsHealthPlanCatalog(
  paths: CmsImportPaths = resolveCmsImportPaths(),
  options: ImportCmsOptions = {},
): Promise<CmsImportStats & { regressionFindings: RegressionFinding[] }> {
  const includeBootstrapSeed = options.includeBootstrapSeed ?? false;
  const failOnRegression = options.failOnRegression ?? false;
  const priorBaseline = loadImportBaseline();

  const existingEntries = includeBootstrapSeed ? seedCatalogEntries() : [];
  const {
    candidates,
    cpscRowsParsed,
    qhpRowsParsed,
    qhpIssuersParsed,
    qhpNetNewFromServiceArea,
    medicaidRowsParsed,
    medicaidEnrollmentRowsParsed,
    medicaidEnrollmentOrganizations,
    medicaidNetNewFromEnrollment,
    rawRecords,
  } = buildCmsCandidates(paths);

  const merged = mergeHealthPlanCatalog(existingEntries, candidates);
  const deduped = dedupeCatalogEntriesByOrganizationId(merged.catalogEntries);
  const identityEnriched = enrichCatalogIdentity(deduped.entries);
  const domainEnriched = enrichCatalogDomains(identityEnriched.entries);
  const enriched = {
    entries: domainEnriched.entries,
    enrichmentsApplied: identityEnriched.enrichmentsApplied + domainEnriched.enrichmentsApplied,
    possibleDuplicates: identityEnriched.possibleDuplicates,
  };
  const organizations = enriched.entries.map((entry) => entry.organization);

  indexHealthPlanOrganizations(organizations);
  markHealthPlanIndexLoaded();

  let externalIdsAttached = 0;
  if (isDatabaseConfigured()) {
    for (const entry of enriched.entries) {
      await upsertCmsCandidate({
        organization: entry.organization,
        externalIds: entry.externalIds,
      });
      externalIdsAttached += entry.externalIds.length;
    }
  } else {
    externalIdsAttached = enriched.entries.reduce(
      (sum, entry) => sum + entry.externalIds.length,
      0,
    );
  }

  const stats: CmsImportStats = {
    cpscRowsParsed,
    qhpRowsParsed,
    qhpIssuersParsed,
    qhpNetNewFromServiceArea,
    medicaidRowsParsed,
    medicaidEnrollmentRowsParsed,
    medicaidEnrollmentOrganizations,
    medicaidNetNewFromEnrollment,
    candidatesBuilt: candidates.length,
    organizationsMerged: merged.mergedCount + deduped.collapsed,
    organizationsAdded: merged.addedCount,
    externalIdsAttached,
    indexSizeAfterImport: getHealthPlanIndexSize(),
    identityEnrichmentApplied: enriched.enrichmentsApplied,
    possibleDuplicatesNeedsReview: enriched.possibleDuplicates.length,
  };

  const provisionalManifest = {
    importedAt: new Date().toISOString(),
    mode: includeBootstrapSeed ? ("bootstrap-seed" as const) : ("production" as const),
    includeBootstrapSeed,
    cmsImportMode: cmsImportMode(),
    rawRecords,
    organizations: {
      total: organizations.length,
      merged: stats.organizationsMerged,
      added: stats.organizationsAdded,
      duplicateIds: countDuplicateOrganizationIds(organizations),
    },
    byHealthPlanType: {
      medicareAdvantage: organizations.filter((o) => o.healthPlanType === "medicare_advantage")
        .length,
      acaMarketplace: organizations.filter((o) => o.healthPlanType === "aca_marketplace").length,
      medicaidManagedCare: organizations.filter(
        (o) => o.healthPlanType === "medicaid_managed_care",
      ).length,
    },
    bySourceConnector: countOrganizationsByConnector(organizations),
    cmsStats: stats,
    identityEnrichmentApplied: stats.identityEnrichmentApplied,
    possibleDuplicatesNeedsReview: stats.possibleDuplicatesNeedsReview,
    regressionFindings: [] as RegressionFinding[],
    possibleDuplicates: enriched.possibleDuplicates,
  };

  const regressionFindings = evaluateImportRegression(
    organizations,
    stats,
    provisionalManifest,
    priorBaseline,
  );

  recordImportManifest(
    {
      ...merged,
      organizations,
      catalogEntries: enriched.entries,
      mergedCount: stats.organizationsMerged,
    },
    stats,
    {
      includeBootstrapSeed,
      rawRecords,
      possibleDuplicatesNeedsReview: stats.possibleDuplicatesNeedsReview,
      identityEnrichmentApplied: stats.identityEnrichmentApplied,
      regressionFindings,
      possibleDuplicates: enriched.possibleDuplicates,
    },
  );

  saveImportBaseline(buildImportBaseline(organizations, provisionalManifest));

  const regressionMessage = formatRegressionFindings(regressionFindings);
  if (regressionFindings.length > 0) {
    console.warn(regressionMessage);
  }
  if (failOnRegression && hasRegressionErrors(regressionFindings)) {
    throw new Error(`Health plan import failed regression checks:\n${regressionMessage}`);
  }

  return { ...stats, regressionFindings };
}

/** Production national catalog import — CMS datasets only (no bootstrap seed). */
export async function importNationalHealthPlanCatalog(
  paths: CmsImportPaths = resolveCmsImportPaths(),
): Promise<CmsImportStats & { regressionFindings: RegressionFinding[] }> {
  return importCmsHealthPlanCatalog(paths, {
    includeBootstrapSeed: false,
    failOnRegression: process.env.HEALTH_PLAN_IMPORT_STRICT !== "0",
  });
}

/** Import bootstrap seed plus CMS datasets (legacy dev/test path). */
export async function importHealthPlanFullCatalog(
  paths: CmsImportPaths = defaultCmsImportPaths(),
): Promise<HealthPlanFullImportStats> {
  const seed = await importHealthPlanSeed();
  const cms = await importCmsHealthPlanCatalog(paths, { includeBootstrapSeed: true });
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
