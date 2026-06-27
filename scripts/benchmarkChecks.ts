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

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Benchmark regression checks:\n");

initDiscoveryEngine();

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
    assert.ok(org.industries.includes("universities"));
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
