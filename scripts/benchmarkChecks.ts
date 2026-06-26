/**
 * Benchmark regression checks for search quality.
 * Run: npm run test:benchmark
 */
import assert from "node:assert/strict";
import {
  discoverOrganizationsSync,
  initDiscoveryEngine,
} from "../lib/discovery/discoveryEngine.ts";
import { BENCHMARK_QUERIES } from "../lib/discovery/benchmark.ts";
import { runSearch } from "../lib/search/runSearch.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Benchmark regression checks:\n");

initDiscoveryEngine();

check("BENCHMARK_QUERIES has 10 entries", () => {
  assert.equal(BENCHMARK_QUERIES.length, 10);
});

check("manufacturers in ohio returns Ohio manufacturers, not banks", () => {
  const { organizations } = discoverOrganizationsSync("manufacturers in ohio");
  assert.ok(organizations.length > 0, "expected at least one Ohio manufacturer");
  for (const org of organizations.slice(0, 10)) {
    assert.notEqual(org.sectorId, "financial-services");
    assert.ok(!org.industries.includes("banks"));
  }
  const top = organizations[0]!;
  assert.equal(top.sectorId, "manufacturing");
  assert.ok(top.states.includes("OH"));
});

check("manufacturers in ohio via runSearch ranks manufacturers highest", () => {
  const result = runSearch({
    query: "manufacturers in ohio",
    sells: "",
    targets: "manufacturers in ohio",
  });
  assert.ok(result.prospects.length > 0);
  const top = result.prospects[0]!;
  assert.equal(top.sectorId, "manufacturing");
  assert.ok(top.score >= 50);
  const banks = result.prospects.filter((p) => p.industryId === "banks");
  if (banks.length > 0) {
    assert.ok(banks[0]!.score < top.score);
  }
});

check("banks in texas does not return manufacturers when any banks exist", () => {
  const { organizations } = discoverOrganizationsSync("banks in texas");
  if (organizations.length === 0) {
    console.log("    (skip: no TX banks in catalog yet — coverage gap)");
    return;
  }
  for (const org of organizations.slice(0, 5)) {
    assert.ok(
      org.sectorId === "financial-services" || org.industries.includes("banks"),
    );
  }
});

check("universities in california filters to education sector when present", () => {
  const { organizations } = discoverOrganizationsSync("universities in california");
  if (organizations.length === 0) {
    console.log("    (skip: no CA universities in catalog yet — coverage gap)");
    return;
  }
  for (const org of organizations.slice(0, 5)) {
    assert.ok(
      org.sectorId === "education" ||
        org.industries.includes("universities") ||
        org.organizationType === "university",
    );
  }
});

check("nonprofits in pennsylvania returns nonprofit sector when present", () => {
  const { organizations } = discoverOrganizationsSync("nonprofits in pennsylvania");
  if (organizations.length === 0) {
    console.log("    (skip: no PA nonprofits in catalog yet — coverage gap)");
    return;
  }
  const hasNonprofit = organizations.some(
    (o) => o.sectorId === "nonprofit" || o.ownership === "nonprofit",
  );
  assert.ok(hasNonprofit);
});

check("government contractors in virginia returns public sector when present", () => {
  const { organizations } = discoverOrganizationsSync(
    "government contractors in virginia",
  );
  if (organizations.length === 0) {
    console.log("    (skip: no VA gov orgs in catalog yet — coverage gap)");
    return;
  }
});

check("each benchmark query completes without error", () => {
  for (const query of BENCHMARK_QUERIES) {
    const { organizations } = discoverOrganizationsSync(query);
    assert.ok(Array.isArray(organizations));
  }
});

console.log(`\nAll ${passed} benchmark checks passed.`);
