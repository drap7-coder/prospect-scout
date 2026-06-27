/**
 * Benchmark regression checks for search quality.
 * Run: npm run test:benchmark
 */
import assert from "node:assert/strict";
import {
  discoverOrganizationsSync,
  initDiscoveryEngine,
} from "../lib/discovery/discoveryEngine.ts";
import {
  BENCHMARK_QUERIES,
  assertBenchmarkQuality,
} from "../lib/discovery/benchmarkQueries.ts";
import { runBenchmark } from "../lib/discovery/benchmark.ts";
import { getCatalogOrganizations } from "../lib/discovery/catalog/catalogIndex.ts";
import { runSearch } from "../lib/search/runSearch.ts";
import { applyResultsFilters } from "../lib/search/resultsFilters.ts";
import { EMPTY_SEARCH_STATE } from "../lib/search/searchState.ts";

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Benchmark regression checks:\n");

initDiscoveryEngine();

const UNIVERSITY_EXCLUDED =
  /\b(beauty|cosmetology|barber|salon|massage|bodywork|esthetic|nail|makeup|truck|tractor|diving|career institute|career college)\b/i;
const PHILADELPHIA_METRO =
  /\b(philadelphia|abington|ardmore|bryn mawr|camden|chester county|delaware county|montgomery county|bucks county|main line|king of prussia|norristown|media|paoli|conshohocken|willow grove|glenside|wyncote|wynnewood|lower merion|lansdale|blue bell)\b/i;

await check("BENCHMARK_QUERIES has at least 100 entries", () => {
  assert.ok(BENCHMARK_QUERIES.length >= 100);
});

await check("catalog exceeds curated baseline", () => {
  assert.ok(getCatalogOrganizations().length >= 5_000);
});

await check("manufacturers in ohio returns Ohio manufacturers, not banks", () => {
  const { organizations, latencyMs } = discoverOrganizationsSync("manufacturers in ohio");
  assert.ok(latencyMs < 100, `latency ${latencyMs}ms`);
  assert.ok(organizations.length > 0);
  for (const org of organizations.slice(0, 10)) {
    assert.notEqual(org.sectorId, "financial-services");
    assert.ok(!org.industries.includes("banks"));
  }
  const top = organizations[0]!;
  assert.equal(top.sectorId, "manufacturing");
  assert.ok(top.states.includes("OH"));
});

await check("banks in texas returns FDIC/SEC bank records", () => {
  const { organizations, latencyMs } = discoverOrganizationsSync("banks in texas");
  assert.ok(latencyMs < 100);
  assert.ok(organizations.length > 0);
  for (const org of organizations.slice(0, 5)) {
    assert.ok(org.sectorId === "financial-services" && org.industries.includes("banks"));
    assert.ok(org.states.includes("TX"));
    assert.ok(org.sources.some((s) => s.connector === "sec"));
  }
});

await check("universities in california returns NCES education records", () => {
  const { organizations, latencyMs } = discoverOrganizationsSync("universities in california");
  assert.ok(latencyMs < 100);
  assert.ok(organizations.length > 0);
  for (const org of organizations.slice(0, 5)) {
    assert.equal(org.sectorId, "education");
    assert.equal(org.canonicalOrganizationType, "university");
    assert.ok(org.states.includes("CA"));
    assert.ok(org.sources.some((s) => s.connector === "nces"));
  }
});

await check("nonprofits in pennsylvania returns nonprofit sector", () => {
  const { organizations } = discoverOrganizationsSync("nonprofits in pennsylvania");
  assert.ok(organizations.length > 0);
  assert.ok(
    organizations.some(
      (o) => o.sectorId === "nonprofit" || o.ownership === "nonprofit",
    ),
  );
});

await check("PBMs query returns CMS PBM records", () => {
  const { organizations } = discoverOrganizationsSync("PBMs");
  assert.ok(organizations.some((o) => o.organizationType === "pbm"));
});

await check("health plans query returns CMS health plan records", () => {
  const { organizations } = discoverOrganizationsSync("health plans");
  assert.ok(organizations.some((o) => o.organizationType === "health-plan"));
});

await check("health plans top 20 are health plans, not PBMs or adjacent healthcare", () => {
  const { organizations } = discoverOrganizationsSync("health plans");
  assert.ok(organizations.length >= 20);
  for (const org of organizations.slice(0, 20)) {
    assert.equal(
      org.canonicalOrganizationType,
      "health-plan",
      `${org.canonicalName} should be a health plan`,
    );
  }
});

await check("pharmaceutical manufacturers includes FDA and directory results", () => {
  const { organizations } = discoverOrganizationsSync("pharmaceutical manufacturers");
  assert.ok(organizations.length > 6, "expected FDA bulk + directory pharma");
  const connectors = new Set(organizations.flatMap((o) => o.sources.map((s) => s.connector)));
  assert.ok(connectors.has("fda") || connectors.has("directory"));
});

await check("medical device companies includes FDA establishments", () => {
  const { organizations } = discoverOrganizationsSync("medical device companies");
  assert.ok(organizations.length > 4);
  assert.ok(
    organizations.some((o) => o.sources.some((s) => s.connector === "fda")),
  );
});

await check("hospitals near philadelphia excludes health plans", () => {
  const { organizations } = discoverOrganizationsSync("hospitals near Philadelphia");
  assert.ok(organizations.length > 0);
  for (const org of organizations.slice(0, 5)) {
    assert.notEqual(org.organizationType, "health-plan");
    assert.notEqual(org.organizationType, "pbm");
  }
});

await check("hospitals near philadelphia top 10 are Philadelphia-metro relevant", () => {
  const { organizations } = discoverOrganizationsSync("hospitals near Philadelphia");
  assert.ok(organizations.length >= 10);
  for (const org of organizations.slice(0, 10)) {
    const hay = `${org.canonicalName} ${org.headquarters ?? ""} ${org.locations.join(" ")}`;
    assert.ok(
      PHILADELPHIA_METRO.test(hay),
      `${org.canonicalName} should be Philadelphia-metro relevant`,
    );
    assert.equal(org.canonicalOrganizationType, "hospital-health-system");
  }
});

await check("universities in california top 20 exclude vocational false positives", () => {
  const { organizations } = discoverOrganizationsSync("universities in california");
  assert.ok(organizations.length >= 20);
  for (const org of organizations.slice(0, 20)) {
    assert.equal(org.sectorId, "education");
    assert.ok(org.states.includes("CA"));
    assert.equal(org.canonicalOrganizationType, "university");
    assert.ok(!UNIVERSITY_EXCLUDED.test(org.canonicalName), org.canonicalName);
  }
});

await check("manufacturers in ohio top 20 are Ohio manufacturers", () => {
  const { organizations } = discoverOrganizationsSync("manufacturers in ohio");
  assert.ok(organizations.length >= 20);
  for (const org of organizations.slice(0, 20)) {
    assert.equal(org.sectorId, "manufacturing");
    assert.ok(org.states.includes("OH"), `${org.canonicalName} should include OH`);
    assert.notEqual(org.sectorId, "financial-services");
    assert.notEqual(org.sectorId, "nonprofit");
    assert.notEqual(org.sectorId, "retail-consumer");
  }
});

await check("SEC source filter preserves catalog-only SEC bank results", () => {
  const response = runSearch({
    query: "banks in texas",
    sells: "",
    targets: "banks in texas",
  });
  const filtered = applyResultsFilters(response.prospects, {
    ...EMPTY_SEARCH_STATE,
    query: "banks in texas",
    sources: ["SEC"],
  });
  assert.ok(filtered.length > 0);
  assert.ok(
    filtered.every((p) => p.sourceRecords.some((rec) => rec.connector === "sec")),
  );
});

await check("100-query benchmark quality gate", () => {
  const { passed: ok, failed } = assertBenchmarkQuality(BENCHMARK_QUERIES);
  if (failed.length > 0) {
    console.log(`    failures (${failed.length}):`);
    for (const f of failed.slice(0, 10)) {
      console.log(`      - ${f.query}: ${f.reason}`);
    }
  }
  assert.ok(
    ok >= BENCHMARK_QUERIES.length * 0.92,
    `expected >=92% pass rate, got ${ok}/${BENCHMARK_QUERIES.length}`,
  );
});

await check("runSearch exposes coverage metadata", () => {
  const result = runSearch({
    query: "universities in california",
    sells: "",
    targets: "universities in california",
  });
  assert.ok(result.coverage.totalCatalogRecords >= 5_000);
  assert.ok(result.coverage.searchedRecords > 0);
});

await check("benchmark report includes latency metrics", async () => {
  const report = await runBenchmark();
  assert.ok(report.catalogTotal >= 5_000);
  assert.equal(typeof report.avgLatencyMs, "number");
  assert.ok(report.p95LatencyMs < 120, `p95 latency ${report.p95LatencyMs}ms`);
});

console.log(`\nAll ${passed} benchmark checks passed.`);
