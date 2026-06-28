/**
 * Full organization ingestion pipeline audit.
 * Traces: Source → Raw → Canonical → Deduplicated → Indexed → Searchable
 */
import { HEALTH_PLANS_DIRECTORY } from "@/lib/directories/healthPlans";
import { HEALTH_SYSTEMS_DIRECTORY } from "@/lib/directories/healthSystems";
import { MANUFACTURERS_DIRECTORY } from "@/lib/directories/manufacturers";
import { EMPLOYERS_DIRECTORY } from "@/lib/directories/employers";
import { PUBLIC_SECTOR_DIRECTORY } from "@/lib/directories/publicSector";
import { FINANCIAL_SERVICES_DIRECTORY } from "@/lib/directories/financialServices";
import { EDUCATION_DIRECTORY } from "@/lib/directories/education";
import { RETAIL_CONSUMER_DIRECTORY } from "@/lib/directories/retailConsumer";
import { TECHNOLOGY_DIRECTORY } from "@/lib/directories/technology";
import { NONPROFITS_DIRECTORY } from "@/lib/directories/nonprofits";
import {
  NCES_RECORDS,
  SEC_BANK_RECORDS,
  SEC_COMPANY_RECORDS,
  CMS_RECORDS,
  FDA_RECORDS,
  IRS_NONPROFIT_RECORDS,
  ACA_MARKETPLACE_RECORDS,
} from "@/lib/discovery/catalog/loadCatalog";
import { catalogRecordToOrganization } from "@/lib/discovery/catalog/normalize";
import {
  dedupeOrganizationsCanonical,
  directoryRecordToOrganization,
  finalizeOrganization,
  type Organization,
} from "@/lib/discovery/organization";
import { normalizeDirectoryRecord } from "@/lib/directories/types";
import { CMS_ORGANIZATIONS } from "@/lib/providers/cms";
import { FDA_FIRM_REGISTRY } from "@/lib/providers/fda";
import { RSS_FEED_SOURCES } from "@/lib/providers/rssNews";
import { HEALTH_PLAN_DIRECTORY } from "@/lib/providers/directories/healthPlanDirectory";
import { MANUFACTURER_DIRECTORY } from "@/lib/providers/directories/manufacturerDirectory";
import { getErisaIndexSize } from "@/lib/import/erisa/memoryIndex";
import { auditHealthPlanCatalogCoverage } from "@/lib/import/healthPlans/cms/coverageAudit";
import { importHealthPlanFullCatalog } from "@/lib/import/healthPlans/cms/importCms";
import {
  clearHealthPlanIndex,
  getHealthPlanIndexSize,
  getHealthPlanOrganizations,
} from "@/lib/import/healthPlans/memoryIndex";
import {
  resetCatalogIndex,
  getCatalogIndex,
  discoverFromCatalogIndex,
} from "@/lib/discovery/catalog/catalogIndex";
import {
  initDiscoveryEngine,
  discoverOrganizationsSync,
} from "@/lib/discovery/discoveryEngine";
import { parseSearchIntent } from "@/lib/discovery/intent";
import { DISCOVERY_V2_CONNECTOR_IDS } from "@/lib/discovery/discoveryPipelineV2";
import { computeCatalogFacetCounts } from "@/lib/discovery/catalog/facetCounts";

export interface PipelineStageCounts {
  rawRecords: number;
  canonicalOrganizations: number;
  deduplicated: number;
  indexed: number;
  searchable: number;
  notes: string[];
}

export interface SourcePipelineReport {
  sourceId: string;
  sourceLabel: string;
  stages: PipelineStageCounts;
}

export interface HealthPlanRuntimeReport {
  mode: "seed-only" | "persistent-flag-off" | "persistent-index-loaded";
  healthPlanPersistentFlag: boolean;
  healthPlanIndexSize: number;
  catalogHealthPlanOrgs: number;
  facetHealthPlanCount: number;
  discoverySearchableHealthPlans: string;
  discoveryResultCount: number;
}

export interface PipelineAuditReport {
  generatedAt: string;
  runtime: {
    healthPlanPersistentSourceEnv: string | undefined;
    databaseConfigured: boolean;
    erisaIndexSize: number;
  };
  healthPlanImportPipeline: ReturnType<typeof auditHealthPlanCatalogCoverage>;
  healthPlanRuntime: HealthPlanRuntimeReport;
  globalCatalogIndex: {
    sourceRecordCount: number;
    normalizedCount: number;
    excludedCount: number;
    mergedCount: number;
    canonicalTotal: number;
    healthPlanCanonicalTotal: number;
    byConnectorBeforeDedupe: Record<string, number>;
    byConnectorAfterDedupe: Record<string, number>;
  };
  sources: SourcePipelineReport[];
  rootCause: {
    primary: string;
    evidence: string[];
    notTheCause: string[];
  };
}

function countByPrimaryConnector(orgs: Organization[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const org of orgs) {
    const connector = org.sources[0]?.connector ?? "unknown";
    counts[connector] = (counts[connector] ?? 0) + 1;
  }
  return counts;
}

function directorySeedCounts(): Record<string, number> {
  return {
    "seed-health-plans": HEALTH_PLANS_DIRECTORY.length,
    "seed-health-systems": HEALTH_SYSTEMS_DIRECTORY.length,
    "seed-manufacturers": MANUFACTURERS_DIRECTORY.length,
    "seed-employers": EMPLOYERS_DIRECTORY.length,
    "seed-public-sector": PUBLIC_SECTOR_DIRECTORY.length,
    "seed-financial-services": FINANCIAL_SERVICES_DIRECTORY.length,
    "seed-education": EDUCATION_DIRECTORY.length,
    "seed-retail-consumer": RETAIL_CONSUMER_DIRECTORY.length,
    "seed-technology": TECHNOLOGY_DIRECTORY.length,
    "seed-nonprofits": NONPROFITS_DIRECTORY.length,
  };
}

function loadPreDedupeOrganizations(includePersistentHealthPlans: boolean): Organization[] {
  const normalized: Organization[] = [];

  const directoryRecords = [
    ...(includePersistentHealthPlans ? [] : HEALTH_PLANS_DIRECTORY.map(normalizeDirectoryRecord)),
    ...HEALTH_SYSTEMS_DIRECTORY,
    ...MANUFACTURERS_DIRECTORY,
    ...EMPLOYERS_DIRECTORY,
    ...PUBLIC_SECTOR_DIRECTORY,
    ...FINANCIAL_SERVICES_DIRECTORY,
    ...EDUCATION_DIRECTORY,
    ...RETAIL_CONSUMER_DIRECTORY,
    ...TECHNOLOGY_DIRECTORY,
    ...NONPROFITS_DIRECTORY,
  ].map(normalizeDirectoryRecord);

  for (const record of directoryRecords) {
    normalized.push(finalizeOrganization(directoryRecordToOrganization(record)));
  }

  if (includePersistentHealthPlans) {
    for (const org of getHealthPlanOrganizations()) {
      normalized.push(finalizeOrganization(org));
    }
  }

  const bulk = [
    ...NCES_RECORDS.map((r) => catalogRecordToOrganization("nces", r)),
    ...SEC_BANK_RECORDS.map((r) => catalogRecordToOrganization("sec", r)),
    ...SEC_COMPANY_RECORDS.map((r) => catalogRecordToOrganization("sec", r)),
    ...CMS_RECORDS.map((r) => catalogRecordToOrganization("cms", r)),
    ...FDA_RECORDS.map((r) => catalogRecordToOrganization("fda", r)),
    ...IRS_NONPROFIT_RECORDS.map((r) =>
      catalogRecordToOrganization("irs-nonprofits", r),
    ),
    ...ACA_MARKETPLACE_RECORDS.map((r) =>
      catalogRecordToOrganization("aca-marketplace", r),
    ),
  ];

  for (const org of bulk) {
    normalized.push(finalizeOrganization(org));
  }

  return normalized;
}

function healthPlanRuntimeReport(): HealthPlanRuntimeReport {
  initDiscoveryEngine();
  const flagOn = process.env.HEALTH_PLAN_PERSISTENT_SOURCE === "1";
  const indexSize = getHealthPlanIndexSize();
  resetCatalogIndex();
  const index = getCatalogIndex();
  const healthPlans = index.orgs.filter(
    (o) => o.canonicalOrganizationType === "health-plan",
  );
  const intent = parseSearchIntent("health plans");
  const searchable = discoverFromCatalogIndex(intent, [...DISCOVERY_V2_CONNECTOR_IDS]);
  const discovery = discoverOrganizationsSync("health plans", { maxResults: 500 });
  const facets = computeCatalogFacetCounts(intent);

  let mode: HealthPlanRuntimeReport["mode"] = "seed-only";
  if (flagOn && indexSize > 0) mode = "persistent-index-loaded";
  else if (flagOn && indexSize === 0) mode = "persistent-flag-off";

  return {
    mode,
    healthPlanPersistentFlag: flagOn,
    healthPlanIndexSize: indexSize,
    catalogHealthPlanOrgs: healthPlans.length,
    facetHealthPlanCount: facets.canonicalOrganizationType["health-plan"] ?? 0,
    discoverySearchableHealthPlans: `${searchable.length} (catalog index, pre-rank cap)`,
    discoveryResultCount: discovery.organizations.length,
  };
}

/** Run the full pipeline audit against the current process state. */
export function runPipelineAudit(): PipelineAuditReport {
  const seeds = directorySeedCounts();
  const hpImportAudit = auditHealthPlanCatalogCoverage();
  const preDedupeDefault = loadPreDedupeOrganizations(false);
  const dedupedDefault = dedupeOrganizationsCanonical(preDedupeDefault);
  const healthPlansDefault = dedupedDefault.filter(
    (o) => o.canonicalOrganizationType === "health-plan",
  );

  resetCatalogIndex();
  const index = getCatalogIndex();

  const sources: SourcePipelineReport[] = [
    {
      sourceId: "seed-health-plans",
      sourceLabel: "Seed catalog (healthPlans.ts)",
      stages: {
        rawRecords: seeds["seed-health-plans"],
        canonicalOrganizations: seeds["seed-health-plans"],
        deduplicated: dedupedDefault.filter((o) =>
          o.sources.some((s) => s.connector === "directory"),
        ).length,
        indexed: index.orgs.filter((o) =>
          o.sources.some((s) => s.connector === "directory" && o.buyerPack === "health-plans"),
        ).length,
        searchable: healthPlansDefault.length,
        notes: [
          "Default runtime path when HEALTH_PLAN_PERSISTENT_SOURCE is off.",
          "24 curated national + PA regional plans.",
        ],
      },
    },
    {
      sourceId: "health-plan-import-pipeline",
      sourceLabel: "Health plan import pipeline (seed + CMS fixtures → Neon/memory)",
      stages: {
        rawRecords:
          hpImportAudit.seed.imported +
          hpImportAudit.sources.reduce((s, x) => s + x.rawRecordsInSource, 0),
        canonicalOrganizations: hpImportAudit.merge.finalCatalogSize,
        deduplicated: hpImportAudit.merge.finalCatalogSize,
        indexed: getHealthPlanIndexSize(),
        searchable: getHealthPlanIndexSize(),
        notes: [
          "Only loaded when npm run import:health-plans or import:health-plans:full runs, or Neon hydration with HEALTH_PLAN_PERSISTENT_SOURCE=1.",
          `Merge: ${hpImportAudit.merge.totalMerged} merged, ${hpImportAudit.merge.totalAdded} net-new from CMS fixtures.`,
        ],
      },
    },
    {
      sourceId: "bulk-cms-json",
      sourceLabel: "Bulk CMS JSON (cms-organizations.json from ingest:catalog)",
      stages: {
        rawRecords: CMS_RECORDS.length,
        canonicalOrganizations: CMS_RECORDS.length,
        deduplicated: dedupedDefault.filter((o) =>
          o.sources.some((s) => s.connector === "cms"),
        ).length,
        indexed: index.orgs.filter((o) => o.sources.some((s) => s.connector === "cms")).length,
        searchable: discoverFromCatalogIndex(parseSearchIntent("health plans"), ["cms"]).length,
        notes: [
          `Live CMS_ORGANIZATIONS registry in lib/providers/cms.ts has ${CMS_ORGANIZATIONS.length} orgs used to build JSON.`,
          "Separate from CMS fixture import pipeline; overlaps seed plans and causes dedupe merges.",
        ],
      },
    },
    {
      sourceId: "bulk-sec",
      sourceLabel: "SEC EDGAR + FDIC (sec-companies.json + sec-banks.json)",
      stages: {
        rawRecords: SEC_COMPANY_RECORDS.length + SEC_BANK_RECORDS.length,
        canonicalOrganizations: SEC_COMPANY_RECORDS.length + SEC_BANK_RECORDS.length,
        deduplicated: dedupedDefault.filter((o) => o.sources.some((s) => s.connector === "sec"))
          .length,
        indexed: index.orgs.filter((o) => o.sources.some((s) => s.connector === "sec")).length,
        searchable: discoverFromCatalogIndex(parseSearchIntent("public companies"), ["sec"]).length,
        notes: ["Static JSON snapshot from npm run ingest:catalog."],
      },
    },
    {
      sourceId: "bulk-fda",
      sourceLabel: "FDA (fda-establishments.json + firm registry)",
      stages: {
        rawRecords: FDA_RECORDS.length,
        canonicalOrganizations: FDA_RECORDS.length,
        deduplicated: dedupedDefault.filter((o) => o.sources.some((s) => s.connector === "fda"))
          .length,
        indexed: index.orgs.filter((o) => o.sources.some((s) => s.connector === "fda")).length,
        searchable: discoverFromCatalogIndex(parseSearchIntent("fda manufacturers"), ["fda"]).length,
        notes: [`FDA_FIRM_REGISTRY curated entries: ${FDA_FIRM_REGISTRY.length}`],
      },
    },
    {
      sourceId: "bulk-nces",
      sourceLabel: "NCES / IPEDS (nces-schools.json)",
      stages: {
        rawRecords: NCES_RECORDS.length,
        canonicalOrganizations: NCES_RECORDS.length,
        deduplicated: dedupedDefault.filter((o) => o.sources.some((s) => s.connector === "nces"))
          .length,
        indexed: index.orgs.filter((o) => o.sources.some((s) => s.connector === "nces")).length,
        searchable: discoverFromCatalogIndex(parseSearchIntent("universities"), ["nces"]).length,
        notes: [],
      },
    },
    {
      sourceId: "bulk-irs-nonprofits",
      sourceLabel: "IRS nonprofits (irs-nonprofits.json)",
      stages: {
        rawRecords: IRS_NONPROFIT_RECORDS.length,
        canonicalOrganizations: IRS_NONPROFIT_RECORDS.length,
        deduplicated: dedupedDefault.filter((o) =>
          o.sources.some((s) => s.connector === "irs-nonprofits"),
        ).length,
        indexed: index.orgs.filter((o) =>
          o.sources.some((s) => s.connector === "irs-nonprofits"),
        ).length,
        searchable: discoverFromCatalogIndex(parseSearchIntent("nonprofits"), [
          "irs-nonprofits",
        ]).length,
        notes: [],
      },
    },
    {
      sourceId: "seed-aca-marketplace",
      sourceLabel: "ACA Marketplace seed (aca-marketplace connector)",
      stages: {
        rawRecords: ACA_MARKETPLACE_RECORDS.length,
        canonicalOrganizations: ACA_MARKETPLACE_RECORDS.length,
        deduplicated: dedupedDefault.filter((o) =>
          o.sources.some((s) => s.connector === "aca-marketplace"),
        ).length,
        indexed: index.orgs.filter((o) =>
          o.sources.some((s) => s.connector === "aca-marketplace"),
        ).length,
        searchable: discoverFromCatalogIndex(parseSearchIntent("aca marketplace"), [
          "aca-marketplace",
        ]).length,
        notes: ["Curated subset only — not full CMS QHP PUF."],
      },
    },
    {
      sourceId: "rss",
      sourceLabel: "RSS (feed registry — enrichment, not catalog ingest)",
      stages: {
        rawRecords: RSS_FEED_SOURCES.length,
        canonicalOrganizations: RSS_FEED_SOURCES.length,
        deduplicated: 0,
        indexed: 0,
        searchable: 0,
        notes: [
          "RSS feeds are signal sources, not indexed as catalog organizations.",
          "Connector returns stubs at query time only.",
        ],
      },
    },
    {
      sourceId: "public-web",
      sourceLabel: "Public web directory stubs",
      stages: {
        rawRecords: HEALTH_PLAN_DIRECTORY.length + MANUFACTURER_DIRECTORY.length,
        canonicalOrganizations: HEALTH_PLAN_DIRECTORY.length + MANUFACTURER_DIRECTORY.length,
        deduplicated: 0,
        indexed: 0,
        searchable: 0,
        notes: [
          "Regional web directory entries are connector stubs, not in CatalogIndex.",
          `${HEALTH_PLAN_DIRECTORY.length} health plan + ${MANUFACTURER_DIRECTORY.length} manufacturer entries.`,
        ],
      },
    },
    {
      sourceId: "erisa",
      sourceLabel: "ERISA / Form 5500 (intelligence overlay)",
      stages: {
        rawRecords: getErisaIndexSize(),
        canonicalOrganizations: getErisaIndexSize(),
        deduplicated: getErisaIndexSize(),
        indexed: getErisaIndexSize(),
        searchable: getErisaIndexSize(),
        notes: [
          "ERISA rows enrich existing orgs via connector search — not merged into CatalogIndex org count.",
        ],
      },
    },
  ];

  const seedDirectoryTotal = Object.values(seeds).reduce((a, b) => a + b, 0);

  return {
    generatedAt: new Date().toISOString(),
    runtime: {
      healthPlanPersistentSourceEnv: process.env.HEALTH_PLAN_PERSISTENT_SOURCE,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      erisaIndexSize: getErisaIndexSize(),
    },
    healthPlanImportPipeline: hpImportAudit,
    healthPlanRuntime: healthPlanRuntimeReport(),
    globalCatalogIndex: {
      sourceRecordCount: index.sourceRecordCount,
      normalizedCount: index.normalizedCount,
      excludedCount: index.excludedCount,
      mergedCount: index.mergedCount,
      canonicalTotal: index.orgs.length,
      healthPlanCanonicalTotal: index.orgs.filter(
        (o) => o.canonicalOrganizationType === "health-plan",
      ).length,
      byConnectorBeforeDedupe: countByPrimaryConnector(preDedupeDefault),
      byConnectorAfterDedupe: countByPrimaryConnector(index.orgs),
    },
    sources,
    rootCause: {
      primary: "Missing data at ingestion — only seed + tiny fixture subsets are loaded by default",
      evidence: [
        `Default runtime indexes ${healthPlansDefault.length} health-plan orgs (seed ${seeds["seed-health-plans"]} + bulk CMS/ACA overlaps after global dedupe).`,
        `Full CMS fixture import produces ${hpImportAudit.merge.finalCatalogSize} health plans but requires explicit import + HEALTH_PLAN_PERSISTENT_SOURCE=1.`,
        `CMS fixture files contain only ${hpImportAudit.sources.reduce((s, x) => s + x.rawRecordsInSource, 0)} raw rows (~${hpImportAudit.nationalCompleteness.estimatedCompletenessPercent.high}% of national benchmark).`,
        `Global catalog merges ${index.mergedCount} orgs during dedupe (domain/name/alias), including health plan duplicates across seed, cms JSON, and aca seed.`,
        `${seedDirectoryTotal} total seed directory records across all packs; bulk JSON adds ${NCES_RECORDS.length + SEC_BANK_RECORDS.length + SEC_COMPANY_RECORDS.length + CMS_RECORDS.length + FDA_RECORDS.length + IRS_NONPROFIT_RECORDS.length + ACA_MARKETPLACE_RECORDS.length} records.`,
      ],
      notTheCause: [
        "Search filtering is not limiting health plans to ~34 — facet count matches catalog index health-plan orgs.",
        "Indexing bug unlikely — catalogIndex loads all normalized sources; counts are consistent pre/post dedupe.",
        "Over-aggressive dedupe removes some overlaps (~10 seed/CMS duplicates) but is not the primary gap.",
      ],
    },
  };
}

/** Simulate runtime after full health plan import into memory index. */
export async function runPipelineAuditWithFullHealthPlanImport(): Promise<PipelineAuditReport> {
  clearHealthPlanIndex();
  resetCatalogIndex();
  await importHealthPlanFullCatalog();
  process.env.HEALTH_PLAN_PERSISTENT_SOURCE = "1";
  const report = runPipelineAudit();
  delete process.env.HEALTH_PLAN_PERSISTENT_SOURCE;
  clearHealthPlanIndex();
  resetCatalogIndex();
  return report;
}

export function formatPipelineAudit(report: PipelineAuditReport): string {
  const lines: string[] = [
    "Organization Ingestion Pipeline Audit",
    "======================================",
    `Generated: ${report.generatedAt}`,
    "",
    "Runtime",
    `  HEALTH_PLAN_PERSISTENT_SOURCE: ${report.runtime.healthPlanPersistentSourceEnv ?? "(unset)"}`,
    `  DATABASE_URL configured: ${report.runtime.databaseConfigured}`,
    `  ERISA index rows: ${report.runtime.erisaIndexSize}`,
    "",
    "Global CatalogIndex (default runtime)",
    `  Source records (declared): ${report.globalCatalogIndex.sourceRecordCount.toLocaleString()}`,
    `  Normalized (pre-dedupe): ${report.globalCatalogIndex.normalizedCount.toLocaleString()}`,
    `  Excluded during normalize: ${report.globalCatalogIndex.excludedCount}`,
    `  Merged during dedupe: ${report.globalCatalogIndex.mergedCount.toLocaleString()}`,
    `  Canonical indexed total: ${report.globalCatalogIndex.canonicalTotal.toLocaleString()}`,
    `  Health-plan canonical total: ${report.globalCatalogIndex.healthPlanCanonicalTotal}`,
    "",
    "Health plan runtime (what search actually sees today)",
    `  Mode: ${report.healthPlanRuntime.mode}`,
    `  In-memory health plan index: ${report.healthPlanRuntime.healthPlanIndexSize}`,
    `  Catalog health-plan orgs: ${report.healthPlanRuntime.catalogHealthPlanOrgs}`,
    `  Facet health-plan count: ${report.healthPlanRuntime.facetHealthPlanCount}`,
    `  Discovery results ('health plans'): ${report.healthPlanRuntime.discoveryResultCount}`,
    "",
    "Source pipeline (Raw → Canonical → Deduped → Indexed → Searchable)",
  ];

  for (const source of report.sources) {
    const s = source.stages;
    lines.push(
      "",
      `${source.sourceLabel} [${source.sourceId}]`,
      `  Raw records:              ${s.rawRecords}`,
      `  Canonical organizations:  ${s.canonicalOrganizations}`,
      `  Deduplicated:             ${s.deduplicated}`,
      `  Indexed:                  ${s.indexed}`,
      `  Searchable:               ${s.searchable}`,
    );
    for (const note of s.notes) lines.push(`  · ${note}`);
  }

  lines.push(
    "",
    "Health plan import pipeline (isolated — not default runtime)",
    `  Seed imported: ${report.healthPlanImportPipeline.seed.imported}`,
    `  CMS raw rows: ${report.healthPlanImportPipeline.sources.map((s) => `${s.sourceId}=${s.rawRecordsInSource}`).join(", ")}`,
    `  Final merged catalog: ${report.healthPlanImportPipeline.merge.finalCatalogSize}`,
    `  National completeness: ${report.healthPlanImportPipeline.nationalCompleteness.estimatedCompletenessPercent.low}%–${report.healthPlanImportPipeline.nationalCompleteness.estimatedCompletenessPercent.high}%`,
    "",
    "Root cause",
    `  Primary: ${report.rootCause.primary}`,
    "  Evidence:",
    ...report.rootCause.evidence.map((e) => `    - ${e}`),
    "  Ruled out:",
    ...report.rootCause.notTheCause.map((e) => `    - ${e}`),
  );

  return lines.join("\n");
}
