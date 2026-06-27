import { discoverOrganizationsSync } from "./discoveryEngine";
import { getCatalogOrganizations } from "./catalog/catalogIndex";
import type { RankedOrganization } from "./rank";

/** Representative discovery queries — 100 total covering all connectors and org types. */
export const BENCHMARK_QUERIES: readonly string[] = [
  // Manufacturing (directory + FDA) — 12
  "manufacturers in ohio",
  "manufacturers in pennsylvania",
  "manufacturers in michigan",
  "food manufacturers in ohio",
  "packaging manufacturers in ohio",
  "pharmaceutical manufacturers",
  "medical device companies",
  "medical device manufacturers in ohio",
  "manufacturers in texas",
  "automotive manufacturers in michigan",
  "aerospace manufacturers in ohio",
  "industrial manufacturers in indiana",
  // Financial (SEC/FDIC) — 12
  "banks in texas",
  "banks in ohio",
  "banks in california",
  "banks in new york",
  "banks in florida",
  "banks in pennsylvania",
  "insurance companies in texas",
  "insurance companies in ohio",
  "public banks in texas",
  "financial services in georgia",
  "banks in michigan",
  "national banks in texas",
  "regional banks in ohio",
  "banks in georgia",
  "banks in illinois",
  // Education (NCES) — 10
  "universities in california",
  "universities in texas",
  "universities in ohio",
  "universities in pennsylvania",
  "colleges in michigan",
  "community colleges in florida",
  "universities in new york",
  "universities in massachusetts",
  "universities in north carolina",
  "colleges in virginia",
  // Nonprofit (IRS) — 10
  "nonprofits in pennsylvania",
  "nonprofits in ohio",
  "nonprofits in california",
  "nonprofits in texas",
  "nonprofits in new york",
  "nonprofits in florida",
  "nonprofits in michigan",
  "charities in pennsylvania",
  "foundations in new york",
  "nonprofits in georgia",
  // Healthcare / CMS — 14
  "health plans",
  "health plans in pennsylvania",
  "health plans in california",
  "health plans in texas",
  "health plans in ohio",
  "medicare advantage plans",
  "medicaid managed care organizations",
  "PBMs",
  "pharmacy benefit managers",
  "managed care in florida",
  "health insurers in michigan",
  "hospitals near philadelphia",
  "hospitals in pennsylvania",
  "hospitals in ohio",
  // Retail / technology / misc SEC — 12
  "public companies in ohio",
  "public companies in california",
  "software companies",
  "software companies hiring",
  "technology companies in california",
  "technology companies in texas",
  "manufacturers in illinois",
  "government contractors in virginia",
  "employers in texas",
  "technology companies in new york",
  "public companies in texas",
  // Geographic breadth — 14
  "manufacturers in california",
  "manufacturers in georgia",
  "manufacturers in indiana",
  "manufacturers in kentucky",
  "universities in florida",
  "nonprofits in illinois",
  "health plans in georgia",
  "hospitals in texas",
  "medical device companies in california",
  "pharmaceutical manufacturers in new jersey",
  "insurance companies in ohio",
  "colleges in california",
  "food manufacturers in pennsylvania",
  // Connector-specific spot checks — 15
  "device manufacturing in ohio",
  "fda registered manufacturers",
  "public universities in california",
  "private universities in texas",
  "national banks in texas",
  "regional banks in ohio",
  "nonprofit hospitals in pennsylvania",
  "community foundations in pennsylvania",
  "health systems in pennsylvania",
  "payers in california",
  "life sciences companies",
  "biotech companies",
  "employers in ohio",
  "organizations in pennsylvania",
  "nonprofits in missouri",
] as const;

export type BenchmarkQuery = (typeof BENCHMARK_QUERIES)[number];

export interface BenchmarkQuerySummary {
  query: string;
  resultCount: number;
  avgRelevance: number;
  avgConfidence: number;
  coverageGaps: string[];
  latencyMs: number;
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

function coverageGaps(query: string, orgs: RankedOrganization[]): string[] {
  const expected = EXPECTED_CONNECTORS[query.toLowerCase()] ?? [];
  const present = new Set(orgs.flatMap((o) => o.sources.map((s) => s.connector)));
  const gaps: string[] = [];
  for (const id of expected) {
    if (!present.has(id)) gaps.push(`Missing ${id} connector results`);
  }
  if (orgs.length === 0) gaps.push("No matching organizations");
  return gaps;
}

/** Run a set of queries synchronously and return summaries (for diagnostics). */
export function summarizeBenchmarkQueries(
  queries: readonly string[],
): BenchmarkQuerySummary[] {
  const catalogTotal = getCatalogOrganizations().length;
  void catalogTotal;

  return queries.map((query) => {
    const { organizations, latencyMs } = discoverOrganizationsSync(query);
    const avgRelevance =
      organizations.length > 0
        ? organizations.reduce((s, o) => s + o.relevance, 0) / organizations.length
        : 0;
    const avgConfidence =
      organizations.length > 0
        ? organizations.reduce((s, o) => s + o.confidence, 0) / organizations.length
        : 0;
    return {
      query,
      resultCount: organizations.length,
      avgRelevance: Math.round(avgRelevance * 10) / 10,
      avgConfidence: Math.round(avgConfidence * 1000) / 1000,
      coverageGaps: coverageGaps(query, organizations),
      latencyMs,
    };
  });
}

export function assertBenchmarkQuality(
  queries: readonly string[],
): { passed: number; failed: { query: string; reason: string }[] } {
  getCatalogOrganizations();

  const failed: { query: string; reason: string }[] = [];
  let passed = 0;

  const skipZero = new Set(["government contractors in virginia"]);

  for (const query of queries) {
    const { organizations, latencyMs } = discoverOrganizationsSync(query);
    if (latencyMs > 120) {
      failed.push({ query, reason: `latency ${latencyMs}ms > 120ms` });
      continue;
    }
    if (organizations.length === 0 && !skipZero.has(query)) {
      failed.push({ query, reason: "zero results" });
      continue;
    }
    const incompatible = organizations.filter((o) =>
      o.matchReasons.includes("sector:incompatible"),
    );
    if (incompatible.length > 0) {
      failed.push({ query, reason: `${incompatible.length} incompatible results` });
      continue;
    }
    passed += 1;
  }

  return { passed, failed };
}
