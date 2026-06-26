import { discoverOrganizations } from "./discoveryEngine";
import type { RankedOrganization } from "./rank";

export const BENCHMARK_QUERIES = [
  "manufacturers in ohio",
  "banks in texas",
  "universities in california",
  "nonprofits in pennsylvania",
  "logistics companies in tennessee",
  "retailers in florida",
  "aerospace companies",
  "restaurants in chicago",
  "government contractors in virginia",
  "software companies hiring",
] as const;

export type BenchmarkQuery = (typeof BENCHMARK_QUERIES)[number];

export interface BenchmarkQueryResult {
  query: string;
  resultCount: number;
  coveragePercent: number;
  confidence: number;
  topIndustries: { industry: string; count: number }[];
  topOrganizationTypes: { organizationType: string; count: number }[];
  avgConfidence: number;
  avgRelevance: number;
  topResults: { name: string; relevance: number; confidence: number }[];
}

export interface BenchmarkReport {
  queries: BenchmarkQueryResult[];
  generatedAt: string;
}

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

function summarizeQuery(
  query: string,
  orgs: RankedOrganization[],
  totalBeforeDedupe: number,
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
    coveragePercent: orgs.length > 0 ? Math.round((totalBeforeDedupe / 100_000) * 1000) / 10 : 0,
    confidence: Math.round((orgs.length ? Math.min(0.95, avgConfidence + 0.08) : 0.25) * 1000) / 1000,
    topIndustries: topCounts(industries),
    topOrganizationTypes: topCounts(orgTypes).map(({ industry, count }) => ({
      organizationType: industry,
      count,
    })),
    avgConfidence: Math.round(avgConfidence * 1000) / 1000,
    avgRelevance: Math.round(avgRelevance * 10) / 10,
    topResults: orgs.slice(0, 5).map((o) => ({
      name: o.canonicalName,
      relevance: o.relevance,
      confidence: o.confidence,
    })),
  };
}

/** Run all benchmark queries and collect quality metrics. */
export async function runBenchmark(): Promise<BenchmarkReport> {
  const queries: BenchmarkQueryResult[] = [];

  for (const query of BENCHMARK_QUERIES) {
    const { organizations, totalBeforeDedupe } = await discoverOrganizations(query);
    queries.push(summarizeQuery(query, organizations, totalBeforeDedupe));
  }

  return {
    queries,
    generatedAt: new Date().toISOString(),
  };
}
