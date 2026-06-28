import { readFileSync } from "node:fs";
import type { Organization } from "@/lib/discovery/organization";
import { HEALTH_PLANS_DIRECTORY } from "@/lib/directories/healthPlans";
import { parseHealthPlanSeed } from "../parseSeed";
import {
  externalIdsForSeedRow,
  organizationFromSeedRow,
} from "../organizationFromRecord";
import type { HealthPlanExternalId, HealthPlanImportCandidate, CmsImportPaths } from "./types";
import { defaultCmsImportPaths } from "./fixtures";
import { readCsvFile } from "./parseCsv";
import { parseCmsCpscRows, aggregateCmsCpscOrganizations } from "./parseCpsc";
import { parseCmsQhpRows, aggregateCmsQhpIssuers } from "./parseQhp";
import {
  parseCmsMedicaidMcoRows,
  aggregateCmsMedicaidMcos,
} from "./parseMedicaidMco";
import {
  candidateFromCpscOrganization,
  candidateFromMedicaidMco,
  candidateFromQhpIssuer,
} from "./organizationFromCms";
import { mergeHealthPlanCatalog } from "./mergeCatalog";

/** How health plan source data is loaded today. */
export type HealthPlanIngestionMode = "fixture" | "live";

/** National-scale benchmarks for a future full CMS ingestion (not fixture targets). */
export const NATIONAL_COVERAGE_BENCHMARKS = {
  description:
    "Approximate national scale when ingesting full current CMS public datasets. Used for completeness % only — not pass/fail against fixtures.",
  medicareAdvantageOrganizations: { low: 400, high: 600, source: "CMS CPSC / MA landscape" },
  acaMarketplaceIssuers: { low: 200, high: 350, source: "CMS QHP / Marketplace PUF" },
  medicaidMcos: { low: 200, high: 400, source: "State Medicaid MCO registries" },
  usStatesAndDc: 51,
} as const;

export interface HealthPlanSourceCoverage {
  sourceId: string;
  sourceLabel: string;
  ingestionMode: HealthPlanIngestionMode;
  fixturePath?: string;
  /** Raw rows in the source file (CSV data lines). */
  rawRecordsInSource: number;
  /** Organizations parsed/aggregated from this source before merge. */
  organizationsParsed: number;
  /** Candidates submitted to the merge layer from this source. */
  candidatesSubmitted: number;
  /** Candidates merged into an existing org (seed or prior source). */
  mergedIntoCatalog: number;
  /** Net-new organizations added from this source. */
  addedToCatalog: number;
  /** Fixture import completeness — parsed orgs vs raw rows where 1:1 expected. */
  fixtureImportRate: number | null;
}

export interface HealthPlanStateCoverage {
  state: string;
  organizationsServing: number;
  /** True when count is below audit threshold for thin coverage. */
  thinCoverage: boolean;
}

export interface HealthPlanCoverageAudit {
  generatedAt: string;
  ingestionSummary: {
    mode: HealthPlanIngestionMode;
    note: string;
  };
  seed: {
    expected: number;
    imported: number;
    fixtureImportRate: number;
  };
  sources: HealthPlanSourceCoverage[];
  merge: {
    seedOrganizations: number;
    cmsCandidatesTotal: number;
    totalMerged: number;
    totalAdded: number;
    finalCatalogSize: number;
  };
  nationalCompleteness: {
    currentCatalogSize: number;
    benchmarkRange: { low: number; high: number };
    estimatedCompletenessPercent: { low: number; high: number };
    disclaimer: string;
  };
  states: {
    covered: number;
    missing: string[];
    thinCoverage: string[];
    byState: HealthPlanStateCoverage[];
  };
  organizationTypes: {
    medicareAdvantage: number;
    acaMarketplace: number;
    medicaidManagedCare: number;
    seedOnly: number;
    multiSource: number;
  };
  gaps: string[];
}

const US_STATES_AND_DC = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

const THIN_COVERAGE_THRESHOLD = 2;

function seedEntries(): {
  organization: Organization;
  externalIds: HealthPlanExternalId[];
}[] {
  return parseHealthPlanSeed().map((row) => ({
    organization: organizationFromSeedRow(row),
    externalIds: externalIdsForSeedRow(row),
  }));
}

function sourceCandidates(
  paths: CmsImportPaths,
): {
  cpsc: HealthPlanImportCandidate[];
  qhp: HealthPlanImportCandidate[];
  medicaid: HealthPlanImportCandidate[];
  raw: { cpsc: number; qhp: number; medicaid: number };
} {
  const cpscRaw = readCsvFile(paths.cpscCsv);
  const qhpRaw = readCsvFile(paths.qhpCsv);
  const medicaidRaw = readCsvFile(paths.medicaidMcoCsv);

  const cpscOrgs = aggregateCmsCpscOrganizations(parseCmsCpscRows(cpscRaw));
  const qhpIssuers = aggregateCmsQhpIssuers(parseCmsQhpRows(qhpRaw));
  const mcoOrgs = aggregateCmsMedicaidMcos(parseCmsMedicaidMcoRows(medicaidRaw));

  return {
    cpsc: cpscOrgs.map((org) => candidateFromCpscOrganization(org)),
    qhp: qhpIssuers.map((issuer) => candidateFromQhpIssuer(issuer)),
    medicaid: mcoOrgs.map((mco) => candidateFromMedicaidMco(mco)),
    raw: { cpsc: cpscRaw.length, qhp: qhpRaw.length, medicaid: medicaidRaw.length },
  };
}

function connectorSet(org: Organization): Set<string> {
  return new Set(org.sources.map((source) => source.connector));
}

function countByState(organizations: Organization[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const org of organizations) {
    for (const state of org.states) {
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
  }
  return counts;
}

function classifyOrganizationTypes(organizations: Organization[]) {
  let medicareAdvantage = 0;
  let acaMarketplace = 0;
  let medicaidManagedCare = 0;
  let seedOnly = 0;
  let multiSource = 0;

  for (const org of organizations) {
    const connectors = connectorSet(org);
    const cmsSources = [...connectors].filter((id) => id.startsWith("cms-")).length;
    if (connectors.has("bootstrap-seed") && cmsSources === 0) seedOnly += 1;
    if (cmsSources > 1 || (connectors.has("bootstrap-seed") && cmsSources > 0)) {
      multiSource += 1;
    }
    if (org.healthPlanType === "medicare_advantage") medicareAdvantage += 1;
    if (org.healthPlanType === "aca_marketplace") acaMarketplace += 1;
    if (org.healthPlanType === "medicaid_managed_care") medicaidManagedCare += 1;
  }

  return {
    medicareAdvantage,
    acaMarketplace,
    medicaidManagedCare,
    seedOnly,
    multiSource,
  };
}

/** Audit health plan catalog coverage by source, merge, state, and national benchmarks. */
export function auditHealthPlanCatalogCoverage(
  paths: CmsImportPaths = defaultCmsImportPaths(),
): HealthPlanCoverageAudit {
  const seedExpected = HEALTH_PLANS_DIRECTORY.length;
  const seed = seedEntries();
  const parsed = sourceCandidates(paths);

  const sourceLayers: {
    sourceId: string;
    sourceLabel: string;
    fixturePath: string;
    rawRecords: number;
    organizationsParsed: number;
    candidates: HealthPlanImportCandidate[];
  }[] = [
    {
      sourceId: "cms-cpsc",
      sourceLabel: "CMS CPSC (Medicare Advantage / Part D)",
      fixturePath: paths.cpscCsv,
      rawRecords: parsed.raw.cpsc,
      organizationsParsed: parsed.cpsc.length,
      candidates: parsed.cpsc,
    },
    {
      sourceId: "cms-qhp",
      sourceLabel: "CMS QHP (ACA Marketplace issuers)",
      fixturePath: paths.qhpCsv,
      rawRecords: parsed.raw.qhp,
      organizationsParsed: parsed.qhp.length,
      candidates: parsed.qhp,
    },
    {
      sourceId: "cms-medicaid-mco",
      sourceLabel: "CMS Medicaid MCO",
      fixturePath: paths.medicaidMcoCsv,
      rawRecords: parsed.raw.medicaid,
      organizationsParsed: parsed.medicaid.length,
      candidates: parsed.medicaid,
    },
  ];

  let catalog = seed;
  const sourceReports: HealthPlanSourceCoverage[] = [];
  let totalMerged = 0;
  let totalAdded = 0;

  for (const layer of sourceLayers) {
    const result = mergeHealthPlanCatalog(catalog, layer.candidates);
    totalMerged += result.mergedCount;
    totalAdded += result.addedCount;
    catalog = result.catalogEntries;
    sourceReports.push({
      sourceId: layer.sourceId,
      sourceLabel: layer.sourceLabel,
      ingestionMode: "fixture",
      fixturePath: layer.fixturePath,
      rawRecordsInSource: layer.rawRecords,
      organizationsParsed: layer.organizationsParsed,
      candidatesSubmitted: layer.candidates.length,
      mergedIntoCatalog: result.mergedCount,
      addedToCatalog: result.addedCount,
      fixtureImportRate:
        layer.rawRecords > 0
          ? Math.round((layer.organizationsParsed / layer.rawRecords) * 1000) / 10
          : null,
    });
  }

  const organizations = catalog.map((entry) => entry.organization);
  const stateCounts = countByState(organizations);
  const byState: HealthPlanStateCoverage[] = [...stateCounts.entries()]
    .map(([state, organizationsServing]) => ({
      state,
      organizationsServing,
      thinCoverage: organizationsServing <= THIN_COVERAGE_THRESHOLD,
    }))
    .sort((a, b) => b.organizationsServing - a.organizationsServing || a.state.localeCompare(b.state));

  const missing = US_STATES_AND_DC.filter((state) => !stateCounts.has(state));
  const thinCoverage = byState
    .filter((entry) => entry.thinCoverage)
    .map((entry) => entry.state);

  const benchmarkLow =
    NATIONAL_COVERAGE_BENCHMARKS.medicareAdvantageOrganizations.low +
    NATIONAL_COVERAGE_BENCHMARKS.acaMarketplaceIssuers.low +
    NATIONAL_COVERAGE_BENCHMARKS.medicaidMcos.low;
  const benchmarkHigh =
    NATIONAL_COVERAGE_BENCHMARKS.medicareAdvantageOrganizations.high +
    NATIONAL_COVERAGE_BENCHMARKS.acaMarketplaceIssuers.high +
    NATIONAL_COVERAGE_BENCHMARKS.medicaidMcos.high;
  const catalogSize = organizations.length;

  const gaps: string[] = [
    "Ingestion uses bundled CMS-style CSV fixtures — not live CMS dataset pulls.",
    "No ongoing synchronization when CMS publishes updates.",
    `${missing.length} US states/DC have zero health plan organizations in the catalog.`,
  ];
  if (catalogSize < benchmarkLow) {
    gaps.push(
      `Catalog size (${catalogSize}) is below national benchmark low (~${benchmarkLow} orgs) — fixture subset only.`,
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    ingestionSummary: {
      mode: "fixture",
      note:
        "All CMS sources are fixture files under fixtures/import/cms/. Fixture import rates reflect file parsing only; national completeness uses external benchmarks.",
    },
    seed: {
      expected: seedExpected,
      imported: seed.length,
      fixtureImportRate:
        seedExpected > 0 ? Math.round((seed.length / seedExpected) * 1000) / 10 : 100,
    },
    sources: sourceReports,
    merge: {
      seedOrganizations: seed.length,
      cmsCandidatesTotal: sourceLayers.reduce(
        (sum, layer) => sum + layer.candidates.length,
        0,
      ),
      totalMerged,
      totalAdded,
      finalCatalogSize: catalogSize,
    },
    nationalCompleteness: {
      currentCatalogSize: catalogSize,
      benchmarkRange: { low: benchmarkLow, high: benchmarkHigh },
      estimatedCompletenessPercent: {
        low: Math.round((catalogSize / benchmarkHigh) * 1000) / 10,
        high: Math.round((catalogSize / benchmarkLow) * 1000) / 10,
      },
      disclaimer:
        "Percentages compare the current catalog to approximate national CMS-scale benchmarks. They do not measure fixture file completeness (which is audited separately per source).",
    },
    states: {
      covered: stateCounts.size,
      missing: [...missing],
      thinCoverage,
      byState,
    },
    organizationTypes: classifyOrganizationTypes(organizations),
    gaps,
  };
}

/** Human-readable summary for CLI / logs. */
export function formatHealthPlanCoverageAudit(audit: HealthPlanCoverageAudit): string {
  const lines: string[] = [
    "Health Plan Catalog Coverage Audit",
    "==================================",
    `Ingestion mode: ${audit.ingestionSummary.mode}`,
    audit.ingestionSummary.note,
    "",
    "Seed (bootstrap)",
    `  Expected: ${audit.seed.expected}`,
    `  Imported: ${audit.seed.imported}`,
    `  Fixture import rate: ${audit.seed.fixtureImportRate}%`,
    "",
    "CMS sources (fixture files)",
  ];

  for (const source of audit.sources) {
    lines.push(
      `  ${source.sourceLabel}`,
      `    Raw CSV rows: ${source.rawRecordsInSource}`,
      `    Organizations parsed: ${source.organizationsParsed}`,
      `    Merged into catalog: ${source.mergedIntoCatalog}`,
      `    Net-new added: ${source.addedToCatalog}`,
    );
  }

  lines.push(
    "",
    "Merge totals",
    `  Seed orgs: ${audit.merge.seedOrganizations}`,
    `  CMS candidates: ${audit.merge.cmsCandidatesTotal}`,
    `  Total merged: ${audit.merge.totalMerged}`,
    `  Total added: ${audit.merge.totalAdded}`,
    `  Final catalog: ${audit.merge.finalCatalogSize}`,
    "",
    "National completeness (vs CMS-scale benchmarks)",
    `  Current catalog: ${audit.nationalCompleteness.currentCatalogSize}`,
    `  Benchmark range: ${audit.nationalCompleteness.benchmarkRange.low}–${audit.nationalCompleteness.benchmarkRange.high} orgs`,
    `  Estimated completeness: ${audit.nationalCompleteness.estimatedCompletenessPercent.low}%–${audit.nationalCompleteness.estimatedCompletenessPercent.high}%`,
    `  ${audit.nationalCompleteness.disclaimer}`,
    "",
    "State coverage",
    `  States/DC with ≥1 plan: ${audit.states.covered} / ${NATIONAL_COVERAGE_BENCHMARKS.usStatesAndDc}`,
    `  Missing: ${audit.states.missing.length ? audit.states.missing.join(", ") : "(none)"}`,
    `  Thin coverage (≤${THIN_COVERAGE_THRESHOLD} plans): ${audit.states.thinCoverage.length ? audit.states.thinCoverage.join(", ") : "(none)"}`,
    "",
    "Organization types in final catalog",
    `  Medicare Advantage: ${audit.organizationTypes.medicareAdvantage}`,
    `  ACA Marketplace: ${audit.organizationTypes.acaMarketplace}`,
    `  Medicaid MCO: ${audit.organizationTypes.medicaidManagedCare}`,
    `  Seed-only: ${audit.organizationTypes.seedOnly}`,
    `  Multi-source merges: ${audit.organizationTypes.multiSource}`,
    "",
    "Known gaps",
    ...audit.gaps.map((gap) => `  - ${gap}`),
  );

  return lines.join("\n");
}

/** Verify bundled fixture files exist (for CI / import scripts). */
export function assertHealthPlanFixtureFiles(paths: CmsImportPaths = defaultCmsImportPaths()): void {
  for (const file of [paths.cpscCsv, paths.qhpCsv, paths.medicaidMcoCsv]) {
    readFileSync(file, "utf8");
  }
}
