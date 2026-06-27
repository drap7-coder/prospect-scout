import {
  deriveDomain,
  organizationDedupeKey,
  normalizeNameKey,
  type Organization,
} from "./organization";
import {
  getCatalogIndex,
  getCatalogOrganizations,
} from "./catalog/catalogIndex";
import { CANONICAL_ORG_TYPES } from "./canonicalOrgType";
import {
  CATALOG_MANIFEST,
  catalogRecordCountByConnector,
} from "./catalog/loadCatalog";
import { organizationsFromDirectory } from "./organization";
import { discoverOrganizationsSync } from "./discoveryEngine";
import { BENCHMARK_QUERIES, summarizeBenchmarkQueries } from "./benchmarkQueries";

export interface CoverageReport {
  total: number;
  sourceCoveragePercent: number;
  confidence: number;
  bySector: Record<string, number>;
  byOrganizationType: Record<string, number>;
  byBuyerPack: Record<string, number>;
  categories: {
    companies: number;
    nonprofits: number;
    government: number;
    education: number;
    healthcare: number;
    manufacturers: number;
    financialServices: number;
    technology: number;
    retail: number;
  };
}

export interface ConnectorHealthItem {
  connectorId: string;
  label: string;
  sourceName: string;
  sourceUrl: string;
  lastUpdated: string;
  recordsIngested: number;
  freshness: "static-snapshot" | "live";
  duplicates: number;
  failures: number;
  sourceCoveragePercent: number;
  confidence: number;
  industry: string;
}

export interface CompletenessReport {
  total: number;
  withWebsite: number;
  withDomain: number;
  withHeadquarters: number;
  withState: number;
  withIndustry: number;
  withOrganizationType: number;
  pctWebsite: number;
  pctDomain: number;
  pctHeadquarters: number;
  pctState: number;
  pctIndustry: number;
  pctOrganizationType: number;
}

export interface DuplicateGroup {
  kind: "domain" | "similar-name" | "probable-duplicate";
  key: string;
  organizations: { id: string; name: string; domain: string | null }[];
}

export interface DuplicateReport {
  duplicateDomains: DuplicateGroup[];
  similarNames: DuplicateGroup[];
  probableDuplicates: DuplicateGroup[];
  duplicateRate: number;
  domainDuplicateCount: number;
}

export interface LatencyReport {
  catalogLoadMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  sampleQueries: { query: string; latencyMs: number; resultCount: number }[];
}

export interface BenchmarkSummary {
  queryCount: number;
  avgResultCount: number;
  avgRelevance: number;
  avgConfidence: number;
  queriesWithGaps: number;
  queriesWithZeroResults: number;
}

export interface DiagnosticsReport {
  coverage: CoverageReport;
  completeness: CompletenessReport;
  duplicates: DuplicateReport;
  connectorHealth: ConnectorHealthItem[];
  latency: LatencyReport;
  benchmarkSummary: BenchmarkSummary;
  catalogFreshness: {
    lastIngest: string;
    generatedAt: string;
  };
  catalogIndex: {
    sourceRecordCount: number;
    rawIngested: number;
    normalizedCount: number;
    excludedCount: number;
    mergedCount: number;
    canonicalTotal: number;
    loadedAt: string;
    missingOrganizationType: number;
    missingCanonicalType: number;
    byCanonicalOrganizationType: Record<string, number>;
    byState: Record<string, number>;
  };
  generatedAt: string;
}

function pct(n: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((n / total) * 1000) / 10;
}

function categorizeOrg(org: Organization): keyof CoverageReport["categories"] | null {
  if (org.sectorId === "nonprofit" || org.ownership === "nonprofit") return "nonprofits";
  if (org.ownership === "government" || org.sectorId === "public-sector") return "government";
  if (org.sectorId === "education" || org.industries.includes("universities")) return "education";
  if (org.sectorId === "healthcare") return "healthcare";
  if (org.sectorId === "manufacturing") return "manufacturers";
  if (org.sectorId === "financial-services") return "financialServices";
  if (org.sectorId === "technology") return "technology";
  if (org.sectorId === "retail-consumer") return "retail";
  if (org.ownership === "public" || org.ownership === "private") return "companies";
  return "companies";
}

/** Full deduplicated catalog (cached, loads once). */
export function catalogOrganizations(): Organization[] {
  return getCatalogOrganizations();
}

export function computeCoverage(orgs?: Organization[]): CoverageReport {
  const list = orgs ?? catalogOrganizations();
  const bySector: Record<string, number> = {};
  const byOrganizationType: Record<string, number> = {};
  const byBuyerPack: Record<string, number> = {};
  const categories: CoverageReport["categories"] = {
    companies: 0,
    nonprofits: 0,
    government: 0,
    education: 0,
    healthcare: 0,
    manufacturers: 0,
    financialServices: 0,
    technology: 0,
    retail: 0,
  };

  for (const org of list) {
    const sector = org.sectorId ?? "unknown";
    bySector[sector] = (bySector[sector] ?? 0) + 1;
    const orgType = org.organizationType ?? "unknown";
    byOrganizationType[orgType] = (byOrganizationType[orgType] ?? 0) + 1;
    const pack = org.buyerPack ?? "unknown";
    byBuyerPack[pack] = (byBuyerPack[pack] ?? 0) + 1;
    const cat = categorizeOrg(org);
    if (cat) categories[cat] += 1;
  }

  const avgConfidence =
    list.length > 0
      ? list.reduce(
          (sum, org) =>
            sum + (org.sources[0]?.confidence ?? org.confidence ?? 0.7),
          0,
        ) / list.length
      : 0;

  return {
    total: list.length,
    sourceCoveragePercent: 100,
    confidence: Math.round(avgConfidence * 1000) / 1000,
    bySector,
    byOrganizationType,
    byBuyerPack,
    categories,
  };
}

export function computeCompleteness(orgs?: Organization[]): CompletenessReport {
  const list = orgs ?? catalogOrganizations();
  const total = list.length;
  let withWebsite = 0;
  let withDomain = 0;
  let withHeadquarters = 0;
  let withState = 0;
  let withIndustry = 0;
  let withOrganizationType = 0;

  for (const org of list) {
    if (org.website) withWebsite += 1;
    if (org.domain || deriveDomain(org.website)) withDomain += 1;
    if (org.headquarters) withHeadquarters += 1;
    if (org.states.length > 0) withState += 1;
    if (org.industries.length > 0) withIndustry += 1;
    if (org.organizationType) withOrganizationType += 1;
  }

  return {
    total,
    withWebsite,
    withDomain,
    withHeadquarters,
    withState,
    withIndustry,
    withOrganizationType,
    pctWebsite: pct(withWebsite, total),
    pctDomain: pct(withDomain, total),
    pctHeadquarters: pct(withHeadquarters, total),
    pctState: pct(withState, total),
    pctIndustry: pct(withIndustry, total),
    pctOrganizationType: pct(withOrganizationType, total),
  };
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeNameKey(a);
  const nb = normalizeNameKey(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const tokensA = new Set(na.split(" "));
  const tokensB = new Set(nb.split(" "));
  const intersection = [...tokensA].filter((t) => tokensB.has(t) && t.length >= 3);
  const union = new Set([...tokensA, ...tokensB]);
  return intersection.length / union.size;
}

export function detectDuplicates(orgs?: Organization[]): DuplicateReport {
  const list = orgs ?? catalogOrganizations();

  const byDomain = new Map<string, Organization[]>();
  for (const org of list) {
    const domain = org.domain ?? deriveDomain(org.website);
    if (!domain) continue;
    const group = byDomain.get(domain) ?? [];
    group.push(org);
    byDomain.set(domain, group);
  }

  const duplicateDomains: DuplicateGroup[] = [];
  let domainDuplicateCount = 0;
  for (const [domain, group] of byDomain) {
    if (group.length < 2) continue;
    domainDuplicateCount += group.length - 1;
    duplicateDomains.push({
      kind: "domain",
      key: domain,
      organizations: group.map((o) => ({
        id: o.id,
        name: o.canonicalName,
        domain: o.domain ?? deriveDomain(o.website),
      })),
    });
  }

  const similarNames: DuplicateGroup[] = [];
  const probableDuplicates: DuplicateGroup[] = [];
  const byPrefix = new Map<string, Organization[]>();
  for (const org of list) {
    const key = normalizeNameKey(org.canonicalName).split(" ").slice(0, 3).join(" ");
    if (!key) continue;
    const group = byPrefix.get(key) ?? [];
    if (group.length < 40) group.push(org);
    byPrefix.set(key, group);
  }

  for (const group of byPrefix.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        if (organizationDedupeKey(a) === organizationDedupeKey(b)) continue;
        const sim = nameSimilarity(a.canonicalName, b.canonicalName);
        if (sim >= 0.85 && similarNames.length < 200) {
          similarNames.push({
            kind: "similar-name",
            key: `${a.canonicalName} ~ ${b.canonicalName}`,
            organizations: [
              { id: a.id, name: a.canonicalName, domain: a.domain },
              { id: b.id, name: b.canonicalName, domain: b.domain },
            ],
          });
        }
        const sharedDomain = a.domain && b.domain && a.domain === b.domain;
        const aliasOverlap = a.aliases.some(
          (alias) => normalizeNameKey(alias) === normalizeNameKey(b.canonicalName),
        );
        if ((sharedDomain || (sim >= 0.7 && aliasOverlap)) && probableDuplicates.length < 200) {
          probableDuplicates.push({
            kind: "probable-duplicate",
            key: `${a.id} / ${b.id}`,
            organizations: [
              { id: a.id, name: a.canonicalName, domain: a.domain },
              { id: b.id, name: b.canonicalName, domain: b.domain },
            ],
          });
        }
      }
    }
  }

  const duplicateRate =
    list.length > 0
      ? Math.round((domainDuplicateCount / list.length) * 10000) / 100
      : 0;

  return {
    duplicateDomains,
    similarNames,
    probableDuplicates,
    duplicateRate,
    domainDuplicateCount,
  };
}

export function computeConnectorHealth(orgs?: Organization[]): ConnectorHealthItem[] {
  const list = orgs ?? catalogOrganizations();
  const duplicateKeys = new Map<string, number>();
  for (const org of list) {
    const key = organizationDedupeKey(org);
    duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
  }

  const counts = catalogRecordCountByConnector();
  const directoryCount = organizationsFromDirectory().length;
  const totalRecords =
    directoryCount +
    counts.nces +
    counts.sec +
    counts.cms +
    counts.fda +
    counts["irs-nonprofits"];

  const manifestById = new Map(
    CATALOG_MANIFEST.datasets.map((d) => [d.connectorId, d]),
  );

  const stats = [
    {
      connectorId: "directory",
      label: "Master Directory",
      sourceName: "Master Directory",
      sourceUrl: "lib/directories/",
      lastUpdated: new Date().toISOString().slice(0, 10),
      recordsIngested: directoryCount,
      sourceCoveragePercent: pct(directoryCount, totalRecords),
      confidence: 0.92,
      industry: "cross-industry",
    },
    ...Object.entries(counts).map(([connectorId, recordsIngested]) => {
      const manifest = manifestById.get(connectorId);
      return {
        connectorId,
        label: manifest?.label ?? connectorId,
        sourceName: manifest?.sourceName ?? connectorId,
        sourceUrl: manifest?.sourceUrl ?? "",
        lastUpdated: manifest?.lastUpdated ?? CATALOG_MANIFEST.generatedAt.slice(0, 10),
        recordsIngested,
        sourceCoveragePercent: pct(recordsIngested, totalRecords),
        confidence: manifest?.confidence ?? 0.85,
        industry:
          connectorId === "nces"
            ? "education"
            : connectorId === "sec"
              ? "financial-services"
              : connectorId === "cms" || connectorId === "aca-marketplace"
                ? "healthcare"
                : connectorId === "fda"
                  ? "manufacturing"
                  : connectorId === "irs-nonprofits"
                    ? "nonprofit"
                    : "cross-industry",
      };
    }),
  ];

  return stats.map((item) => ({
    ...item,
    freshness: "static-snapshot" as const,
    duplicates: list.filter(
      (org) =>
        org.sources.some((src) => src.connector === item.connectorId) &&
        (duplicateKeys.get(organizationDedupeKey(org)) ?? 0) > 1,
    ).length,
    failures: 0,
  }));
}

const LATENCY_SAMPLE_QUERIES = [
  "manufacturers in ohio",
  "banks in texas",
  "universities in california",
  "nonprofits in pennsylvania",
  "health plans",
  "PBMs",
  "pharmaceutical manufacturers",
  "medical device companies",
  "hospitals near Philadelphia",
];

export function measureDiscoveryLatency(): LatencyReport {
  const loadStart = performance.now();
  getCatalogIndex();
  const catalogLoadMs = Math.round((performance.now() - loadStart) * 100) / 100;

  const samples: { query: string; latencyMs: number; resultCount: number }[] = [];
  for (const query of LATENCY_SAMPLE_QUERIES) {
    const { latencyMs, organizations } = discoverOrganizationsSync(query);
    samples.push({ query, latencyMs, resultCount: organizations.length });
  }

  const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const max = latencies[latencies.length - 1] ?? 0;

  return {
    catalogLoadMs,
    p50Ms: p50,
    p95Ms: p95,
    maxMs: max,
    sampleQueries: samples,
  };
}

export function runDiagnostics(orgs?: Organization[]): DiagnosticsReport {
  const list = orgs ?? catalogOrganizations();
  const index = getCatalogIndex();
  const benchmarkItems = summarizeBenchmarkQueries(BENCHMARK_QUERIES.slice(0, 20));

  const byCanonicalOrganizationType: Record<string, number> = {};
  for (const t of CANONICAL_ORG_TYPES) byCanonicalOrganizationType[t.id] = 0;
  const byState: Record<string, number> = {};
  let missingOrganizationType = 0;
  let missingCanonicalType = 0;

  for (const org of list) {
    const canonical = org.canonicalOrganizationType ?? "other";
    byCanonicalOrganizationType[canonical] =
      (byCanonicalOrganizationType[canonical] ?? 0) + 1;
    if (!org.organizationType) missingOrganizationType += 1;
    if (!org.canonicalOrganizationType || canonical === "other") {
      if (!org.organizationType && org.industries.length === 0 && !org.sectorId) {
        missingCanonicalType += 1;
      }
    }
    for (const st of org.states) {
      byState[st] = (byState[st] ?? 0) + 1;
    }
  }

  return {
    coverage: computeCoverage(list),
    completeness: computeCompleteness(list),
    duplicates: detectDuplicates(list),
    connectorHealth: computeConnectorHealth(list),
    latency: measureDiscoveryLatency(),
    benchmarkSummary: {
      queryCount: benchmarkItems.length,
      avgResultCount:
        Math.round(
          (benchmarkItems.reduce((s, q) => s + q.resultCount, 0) /
            Math.max(benchmarkItems.length, 1)) *
            10,
        ) / 10,
      avgRelevance:
        Math.round(
          (benchmarkItems.reduce((s, q) => s + q.avgRelevance, 0) /
            Math.max(benchmarkItems.length, 1)) *
            10,
        ) / 10,
      avgConfidence:
        Math.round(
          (benchmarkItems.reduce((s, q) => s + q.avgConfidence, 0) /
            Math.max(benchmarkItems.length, 1)) *
            1000,
        ) / 1000,
      queriesWithGaps: benchmarkItems.filter((q) => q.coverageGaps.length > 0).length,
      queriesWithZeroResults: benchmarkItems.filter((q) => q.resultCount === 0).length,
    },
    catalogFreshness: {
      lastIngest: CATALOG_MANIFEST.generatedAt,
      generatedAt: CATALOG_MANIFEST.generatedAt,
    },
    catalogIndex: {
      sourceRecordCount: index.sourceRecordCount,
      rawIngested: index.rawIngested,
      normalizedCount: index.normalizedCount,
      excludedCount: index.excludedCount,
      mergedCount: index.mergedCount,
      canonicalTotal: index.orgs.length,
      loadedAt: new Date(index.loadedAt).toISOString(),
      missingOrganizationType,
      missingCanonicalType,
      byCanonicalOrganizationType,
      byState,
    },
    generatedAt: new Date().toISOString(),
  };
}
