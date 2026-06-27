/**
 * Graceful fallback discovery checks.
 * Run: npm run test:fallback
 */
import assert from "node:assert/strict";
import {
  DISCOVERY_THRESHOLD,
  computeCoverageStatus,
  coverageMessage,
  type DiscoveryMetadata,
} from "../lib/discovery/coverage.ts";
import { discoverOrganizationsStaged } from "../lib/discovery/discoveryEngine.ts";
import { parseSearchIntent } from "../lib/discovery/intent.ts";
import { runSearch } from "../lib/search/runSearch.ts";
import { parseIntent } from "../lib/search/intentParser.ts";
import { planSources } from "../lib/search/sourcePlanner.ts";
import { getMockProspects } from "../lib/providers/mockProspects.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function search(query: string) {
  return runSearch({ query, sells: "", targets: query });
}

function meta(query: string): DiscoveryMetadata {
  const r = search(query);
  assert.ok(r.discovery?.metadata, `expected discovery metadata for "${query}"`);
  return r.discovery!.metadata!;
}

function fakeMeta(over: Partial<DiscoveryMetadata>): DiscoveryMetadata {
  return {
    resultCount: 0,
    threshold: DISCOVERY_THRESHOLD,
    coverageStatus: "expanding",
    stagesRun: ["catalog"],
    expanded: false,
    fallbackReason: null,
    sourceSummary: {},
    marketBenchmarkAvailable: false,
    ...over,
  };
}

// --- Coverage status + messaging (pure) ----------------------------------

check("computeCoverageStatus maps counts to statuses", () => {
  assert.equal(computeCoverageStatus(0), "expanding");
  assert.equal(computeCoverageStatus(4), "partial");
  assert.equal(computeCoverageStatus(10), "good");
  assert.equal(computeCoverageStatus(25), "excellent");
});

check("coverageMessage renders graceful empty + low-coverage copy", () => {
  assert.equal(
    coverageMessage(fakeMeta({ resultCount: 0, marketBenchmarkAvailable: true })),
    "No verified organizations found yet. Market benchmark available from Census.",
  );
  assert.equal(
    coverageMessage(fakeMeta({ resultCount: 0, marketBenchmarkAvailable: false })),
    "No verified organizations found for this search.",
  );
  assert.equal(
    coverageMessage(
      fakeMeta({ resultCount: 6, coverageStatus: "partial", expanded: true }),
    ),
    "Found 6 known organizations. Expanding discovery…",
  );
  assert.equal(
    coverageMessage(fakeMeta({ resultCount: 30, coverageStatus: "excellent" })),
    null,
  );
});

// --- Health plans (the original Maine bug) --------------------------------

check('"health plans in Maine" is not empty and includes Community Health Options', () => {
  const r = search("health plans in Maine");
  assert.ok(r.prospects.length > 0, "Maine health plans should not be empty");
  assert.ok(
    r.prospects.some((p) => /community health options/i.test(p.name)),
    "expected Community Health Options in Maine",
  );
});

check('"ACA plans in Maine" includes Community Health Options', () => {
  const r = search("ACA plans in Maine");
  assert.ok(r.prospects.some((p) => /community health options/i.test(p.name)));
});

check("health plan results never include PBMs unless asked", () => {
  const r = search("health plans");
  assert.ok(
    r.prospects.every((p) => p.canonicalOrganizationTypeId !== "pbm"),
    "PBMs must not appear in a health-plan search",
  );
  // ...but an explicit PBM query is allowed to map to the pbm type.
  assert.equal(
    parseSearchIntent("pharmacy benefit managers").organizationTypeId,
    "pbm",
  );
});

check('"Medicare Advantage plans" excludes ACA marketplace issuers', () => {
  const r = search("Medicare Advantage plans");
  assert.ok(r.prospects.length > 0);
  assert.ok(
    r.prospects.every((p) => p.healthPlanType !== "aca_marketplace"),
    "Medicare Advantage search must not include ACA marketplace issuers",
  );
});

// --- Manufacturers --------------------------------------------------------

check('"manufacturers in Ohio" returns catalog orgs (or partial + benchmark)', () => {
  const m = meta("manufacturers in Ohio");
  assert.ok(m.marketBenchmarkAvailable, "manufacturing scope should have a benchmark");
  if (m.resultCount === 0) {
    assert.equal(m.coverageStatus, "expanding");
  } else {
    assert.ok(["partial", "good", "excellent"].includes(m.coverageStatus));
  }
});

// --- Hospitals ------------------------------------------------------------

check('"hospitals in Arizona" returns only hospital/health-system orgs', () => {
  const r = search("hospitals in Arizona");
  assert.ok(r.prospects.length > 0, "expected hospital records for Arizona");
  for (const p of r.prospects) {
    assert.notEqual(p.canonicalOrganizationTypeId, "health-plan");
    assert.notEqual(p.canonicalOrganizationTypeId, "manufacturer");
    assert.notEqual(p.canonicalOrganizationTypeId, "pbm");
  }
});

// --- No fabricated organizations -----------------------------------------

check("discovery results never include fabricated mock organizations", () => {
  const input = { query: "health plans", sells: "", targets: "health plans" };
  const plan = planSources(parseIntent(input));
  const mockIds = new Set(getMockProspects(plan).map((p) => p.id));
  assert.ok(mockIds.size > 0, "sanity: mock prospects exist for this plan");
  const r = runSearch(input);
  assert.ok(r.prospects.length > 0);
  assert.ok(
    r.prospects.every((p) => !mockIds.has(p.id)),
    "mock (fabricated) prospects must not surface for a discovery search",
  );
});

check("Census data never becomes a named organization", () => {
  const r = search("manufacturers in Ohio");
  assert.ok(
    r.prospects.every((p) =>
      (p.sourceRecords ?? []).every((rec) => rec.connector !== "census"),
    ),
    "Census is market-sizing only and must never appear as a named org source",
  );
  assert.ok(!("census" in (r.discovery?.metadata?.sourceSummary ?? {})));
});

// --- Empty page renders graceful fallback ---------------------------------

check("a domain query with no catalog coverage stays graceful (no fake orgs)", () => {
  const m = meta("health plans in Wyoming");
  assert.ok(m.marketBenchmarkAvailable);
  if (m.resultCount === 0) {
    assert.equal(m.coverageStatus, "expanding");
    assert.equal(
      coverageMessage(m),
      "No verified organizations found yet. Market benchmark available from Census.",
    );
  }
});

check("staged metadata is well-formed", () => {
  const staged = discoverOrganizationsStaged("health plans in Maine", {});
  const m = staged.metadata;
  assert.equal(m.threshold, DISCOVERY_THRESHOLD);
  assert.ok(Array.isArray(m.stagesRun) && m.stagesRun.includes("catalog"));
  assert.equal(typeof m.expanded, "boolean");
  assert.equal(typeof m.marketBenchmarkAvailable, "boolean");
  assert.equal(m.resultCount, staged.totalAfterRank);
});

console.log(`\n${passed} fallback discovery checks passed.`);
