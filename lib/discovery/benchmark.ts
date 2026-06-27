import { discoverOrganizationsSync } from "./discoveryEngine";
import { getCatalogOrganizations } from "./catalog/catalogIndex";
import { BENCHMARK_QUERIES } from "./benchmarkQueries";
import type { RankedOrganization } from "./rank";

export { BENCHMARK_QUERIES };
export type { BenchmarkQuery, BenchmarkQuerySummary } from "./benchmarkQueries";

export interface BenchmarkQueryResult {
  query: string;
  resultCount: number;
  coveragePercent: number;
  confidence: number;
  topIndustries: { industry: string; count: number }[];
  topOrganizationTypes: { organizationType: string; count: number }[];
  connectorBreakdown: { connectorId: string; count: number }[];
  coverageGaps: string[];
  avgConfidence: number;
  avgRelevance: number;
  latencyMs: number;
  topResults: { name: string; relevance: number; confidence: number }[];
}

export interface BenchmarkReport {
  queries: BenchmarkQueryResult[];
  catalogTotal: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  generatedAt: string;
}

const EXPECTED_CONNECTORS: Record<string, string[]> = {
  "manufacturers in ohio": ["directory", "fda"],
  "banks in texas": ["sec"],
  "universities in california": ["nces"],
  "nonprofits in pennsylvania": ["irs-nonprofits"],
  "health plans": ["cms"],
  pbms: ["cms"],
  "pharmaceutical manufacturers": ["fda", "directory"],
  "medical device companies": ["fda", "directory"],
  "hospitals near philadelphia": ["irs-nonprofits", "directory"],
};

function topCounts(
  values: (string | null)[],
  limit = 5,
): { industry: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([industry, count]) => ({ industry, count }));
}

function connectorBreakdown(
  orgs: RankedOrganization[],
): { connectorId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const org of orgs) {
    for (const src of org.sources) {
      counts.set(src.connector, (counts.get(src.connector) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([connectorId, count]) => ({ connectorId, count }));
}

function coverageGapsForQuery(
  query: string,
  orgs: RankedOrganization[],
): string[] {
  const expected = EXPECTED_CONNECTORS[query.toLowerCase()] ?? [];
  const present = new Set(
    orgs.flatMap((org) => org.sources.map((src) => src.connector)),
  );
  const gaps: string[] = [];
  for (const connectorId of expected) {
    if (!present.has(connectorId)) {
      gaps.push(`Missing results from ${connectorId} connector`);
    }
  }
  if (orgs.length === 0) {
    gaps.push("No matching organizations returned");
  }
  return gaps;
}

function summarizeQuery(
  query: string,
  orgs: RankedOrganization[],
  totalBeforeDedupe: number,
  catalogTotal: number,
  latencyMs: number,
): BenchmarkQueryResult {
  const industries = orgs.flatMap((o) => o.industries);
  const orgTypes = orgs.map((o) => o.organizationType);

  const avgConfidence =
    orgs.length > 0
      ? orgs.reduce((s, o) => s + o.confidence, 0) / orgs.length
      : 0;
  const avgRelevance =
    orgs.length > 0
      ? orgs.reduce((s, o) => s + o.relevance, 0) / orgs.length
      : 0;

  return {
    query,
    resultCount: orgs.length,
    coveragePercent:
      catalogTotal > 0
        ? Math.round((totalBeforeDedupe / catalogTotal) * 1000) / 10
        : 0,
    confidence:
      Math.round(
        (orgs.length ? Math.min(0.95, avgConfidence + 0.08) : 0.25) * 1000,
      ) / 1000,
    topIndustries: topCounts(industries),
    topOrganizationTypes: topCounts(orgTypes).map(({ industry, count }) => ({
      organizationType: industry,
      count,
    })),
    connectorBreakdown: connectorBreakdown(orgs),
    coverageGaps: coverageGapsForQuery(query, orgs),
    avgConfidence: Math.round(avgConfidence * 1000) / 1000,
    avgRelevance: Math.round(avgRelevance * 10) / 10,
    latencyMs,
    topResults: orgs.slice(0, 5).map((o) => ({
      name: o.canonicalName,
      relevance: o.relevance,
      confidence: o.confidence,
    })),
  };
}

/** Run all benchmark queries and collect quality metrics. */
export async function runBenchmark(): Promise<BenchmarkReport> {
  const catalogTotal = getCatalogOrganizations().length;
  const queries: BenchmarkQueryResult[] = [];
  const latencies: number[] = [];

  for (const query of BENCHMARK_QUERIES) {
    const { organizations, totalBeforeDedupe, latencyMs } =
      discoverOrganizationsSync(query);
    latencies.push(latencyMs);
    queries.push(
      summarizeQuery(
        query,
        organizations,
        totalBeforeDedupe,
        catalogTotal,
        latencyMs,
      ),
    );
  }

  latencies.sort((a, b) => a - b);
  const avgLatencyMs =
    Math.round(
      (latencies.reduce((s, v) => s + v, 0) / Math.max(latencies.length, 1)) *
        100,
    ) / 100;
  const p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

  return {
    queries,
    catalogTotal,
    avgLatencyMs,
    p95LatencyMs,
    generatedAt: new Date().toISOString(),
  };
}
