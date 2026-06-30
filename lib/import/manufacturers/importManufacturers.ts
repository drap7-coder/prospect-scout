import {
  mergeManufacturerCatalog,
  dedupeCatalogEntriesByOrganizationId,
  countDuplicateOrganizationIds,
} from "./mergeCatalog";
import {
  indexManufacturerOrganizations,
  getManufacturerIndexSize,
  getManufacturerOrganizations,
} from "./memoryIndex";
import { markManufacturerIndexLoaded } from "./hydrateIndex";
import { parseManufacturerSeed } from "./parseSeed";
import {
  candidateFromManufacturerSeed,
  candidateFromSecManufacturerRecord,
  candidateFromFdaManufacturerRecord,
} from "./organizationFromRecord";
import {
  loadManufacturerSourceRecords,
  manufacturerImportMode,
  resolveManufacturerImportPaths,
} from "./sources/loadSources";
import {
  setManufacturerCatalogImportManifest,
  buildManufacturerManifestFields,
  type ManufacturerCatalogImportManifest,
} from "./catalogManifest";
import type { ManufacturerImportPaths, ManufacturerImportStats } from "./types";
import { defaultManufacturerImportPaths } from "./fixtures";
import { isDatabaseConfigured } from "@/lib/db";
import { enrichCatalogDomains } from "@/lib/domainIntelligence/pipeline";

function seedCatalogEntries() {
  return parseManufacturerSeed().map((row) => {
    const candidate = candidateFromManufacturerSeed(row);
    return {
      organization: candidate.organization,
      externalIds: candidate.externalIds,
    };
  });
}

function buildManufacturerCandidates(paths: ManufacturerImportPaths): {
  candidates: ReturnType<typeof candidateFromSecManufacturerRecord>[];
  secRecordsParsed: number;
  fdaRecordsParsed: number;
  seedRecordsParsed: number;
} {
  const { sec, fda } = loadManufacturerSourceRecords(paths);
  const candidates = [
    ...sec.map((record) => candidateFromSecManufacturerRecord(record)),
    ...fda.map((record) => candidateFromFdaManufacturerRecord(record)),
  ];
  return {
    candidates,
    secRecordsParsed: sec.length,
    fdaRecordsParsed: fda.length,
    seedRecordsParsed: 0,
  };
}

export interface ImportManufacturerOptions {
  includeBootstrapSeed?: boolean;
}

/** Import manufacturer sources into the warehouse memory index. */
export function importManufacturerCatalog(
  paths: ManufacturerImportPaths = resolveManufacturerImportPaths(),
  options: ImportManufacturerOptions = {},
): ManufacturerImportStats {
  const includeBootstrapSeed = options.includeBootstrapSeed ?? false;
  const existingEntries = includeBootstrapSeed ? seedCatalogEntries() : [];
  const { candidates, secRecordsParsed, fdaRecordsParsed, seedRecordsParsed } =
    buildManufacturerCandidates(paths);

  const merged = mergeManufacturerCatalog(existingEntries, candidates);
  const deduped = dedupeCatalogEntriesByOrganizationId(merged.catalogEntries);
  const domainEnriched = enrichCatalogDomains(deduped.entries);
  const organizations = domainEnriched.entries.map((entry) => entry.organization);

  indexManufacturerOrganizations(organizations);
  markManufacturerIndexLoaded();

  const duplicateOrganizationIds = countDuplicateOrganizationIds(organizations);
  const stats: ManufacturerImportStats = {
    secRecordsParsed,
    fdaRecordsParsed,
    seedRecordsParsed: includeBootstrapSeed ? parseManufacturerSeed().length : seedRecordsParsed,
    candidatesBuilt: candidates.length + existingEntries.length,
    organizationsMerged: merged.mergedCount + deduped.collapsed,
    organizationsAdded: merged.addedCount,
    indexSizeAfterImport: getManufacturerIndexSize(),
    duplicateOrganizationIds,
  };

  const manifest: ManufacturerCatalogImportManifest = {
    importedAt: new Date().toISOString(),
    mode: includeBootstrapSeed ? "bootstrap-seed" : "production",
    includeBootstrapSeed,
    importMode: manufacturerImportMode(),
    rawRecords: {
      sec: secRecordsParsed,
      fda: fdaRecordsParsed,
      seed: stats.seedRecordsParsed,
    },
    pipeline: {
      candidatesBuilt: stats.candidatesBuilt,
      merged: stats.organizationsMerged,
      added: stats.organizationsAdded,
      collapsed: deduped.collapsed,
      canonicalTotal: organizations.length,
      duplicateIds: duplicateOrganizationIds,
    },
    ...buildManufacturerManifestFields(organizations),
    stats,
  };
  setManufacturerCatalogImportManifest(manifest);
  if (isDatabaseConfigured()) {
    void import("@/lib/import/warehouse/manifestPersistence").then(({ persistManufacturerImportManifest }) =>
      persistManufacturerImportManifest(manifest),
    );
  }

  return stats;
}

/** Production manufacturer import — source datasets only (no bootstrap seed). */
export function importNationalManufacturerCatalog(
  paths: ManufacturerImportPaths = resolveManufacturerImportPaths(),
): ManufacturerImportStats {
  return importManufacturerCatalog(paths, { includeBootstrapSeed: false });
}

/** Import and persist manufacturers to Neon when DATABASE_URL is configured. */
export async function importNationalManufacturerCatalogToDb(
  paths: ManufacturerImportPaths = resolveManufacturerImportPaths(),
): Promise<ManufacturerImportStats> {
  const stats = importNationalManufacturerCatalog(paths);
  const { persistManufacturerIndexToDb } = await import("./persistToDb");
  const persisted = await persistManufacturerIndexToDb();
  if (isDatabaseConfigured() && persisted === 0 && stats.indexSizeAfterImport > 0) {
    console.warn("[manufacturers] Import succeeded but Neon persistence returned 0 rows");
  }
  return stats;
}

/** Import bootstrap seed plus source datasets (dev/test path). */
export function importManufacturerFullCatalog(
  paths: ManufacturerImportPaths = defaultManufacturerImportPaths(),
): ManufacturerImportStats {
  return importManufacturerCatalog(paths, { includeBootstrapSeed: true });
}

export function getIndexedManufacturerOrganizations() {
  return getManufacturerOrganizations();
}
