/**
 * Discovery Engine checks — intent, ranking, dedupe, diagnostics.
 * Run: npm run test:discovery
 */
import assert from "node:assert/strict";
import {
  deriveDomain,
  mergeOrganizations,
  dedupeOrganizations,
  organizationsFromDirectory,
  directoryRecordToOrganization,
} from "../lib/discovery/organization.ts";
import { parseSearchIntent } from "../lib/discovery/intent.ts";
import {
  rankOrganizations,
  filterIncompatibleOrganizations,
  scoreOrganizationRelevance,
} from "../lib/discovery/rank.ts";
import { getCatalogOrganizations } from "../lib/discovery/catalog/catalogIndex.ts";
import { computeCatalogFacetCounts } from "../lib/discovery/catalog/facetCounts.ts";
import {
  discoverOrganizationsSync,
  discoverOrganizationsStaged,
  initDiscoveryEngine,
} from "../lib/discovery/discoveryEngine.ts";
import { runDiscoveryPipelineV2 } from "../lib/discovery/discoveryPipelineV2.ts";
import { parseSearchIntent } from "../lib/discovery/intent.ts";
import { dedupeOrganizationsByMergeKeys } from "../lib/discovery/mergeKeys.ts";
import { finalizeOrganization } from "../lib/discovery/organization.ts";
import {
  computeCoverage,
  computeConnectorHealth,
  detectDuplicates,
  runDiagnostics,
} from "../lib/discovery/diagnostics.ts";
import { getAllDirectoryRecords } from "../lib/directories/search.ts";
import { runSearch } from "../lib/search/runSearch.ts";
import { applyResultsFilters } from "../lib/search/resultsFilters.ts";
import { EMPTY_SEARCH_STATE } from "../lib/search/searchState.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Discovery Engine checks:\n");

check("deriveDomain extracts hostname from URL", () => {
  assert.equal(deriveDomain("https://www.example.com/about"), "example.com");
  assert.equal(deriveDomain("example.org"), "example.org");
  assert.equal(deriveDomain(""), null);
});

check("parseSearchIntent infers manufacturing + Ohio", () => {
  const intent = parseSearchIntent("manufacturers in ohio");
  assert.equal(intent.state, "OH");
  assert.ok(intent.sectorId === "manufacturing" || intent.industryId);
});

check("parseSearchIntent infers banks sector", () => {
  const intent = parseSearchIntent("banks in texas");
  assert.equal(intent.state, "TX");
  assert.ok(
    intent.industryId === "banks" ||
      intent.sectorId === "financial-services" ||
      intent.organizationTypeId === "bank",
  );
});

check("parseSearchIntent infers universities", () => {
  const intent = parseSearchIntent("universities in california");
  assert.equal(intent.state, "CA");
  assert.ok(
    intent.industryId === "universities" ||
      intent.sectorId === "education" ||
      intent.organizationTypeId === "university",
  );
});

check("rankOrganizations boosts matching industry and state", () => {
  const orgs = organizationsFromDirectory();
  const intent = parseSearchIntent("manufacturers in ohio", {
    sectorId: "manufacturing",
    state: "OH",
  });
  const ranked = rankOrganizations(orgs, intent);
  assert.ok(ranked.length > 0);
  const top = ranked[0];
  assert.equal(top.sectorId, "manufacturing");
  assert.ok(top.states.includes("OH"));
  assert.ok(top.relevance >= 70);
});

check("filterIncompatibleOrganizations removes banks from manufacturer query", () => {
  const orgs = organizationsFromDirectory();
  const intent = parseSearchIntent("manufacturers in ohio", {
    sectorId: "manufacturing",
    industryId: "industrial-products",
    state: "OH",
  });
  const ranked = rankOrganizations(orgs, intent);
  const filtered = filterIncompatibleOrganizations(ranked, intent);
  for (const org of filtered) {
    assert.notEqual(org.sectorId, "financial-services");
    assert.notEqual(org.industries[0], "banks");
  }
});

check("scoreOrganizationRelevance penalizes cross-sector mismatch", () => {
  const orgs = organizationsFromDirectory();
  const bank = orgs.find((o) => o.industries.includes("banks"));
  assert.ok(bank);
  const intent = parseSearchIntent("manufacturers in ohio", {
    sectorId: "manufacturing",
  });
  const { relevance, matchReasons } = scoreOrganizationRelevance(bank!, intent);
  assert.ok(relevance < 50 || matchReasons.includes("sector:incompatible"));
});

check("mergeOrganizations unions aliases and sources", () => {
  const a = directoryRecordToOrganization(getAllDirectoryRecords()[0]!);
  const b = {
    ...a,
    id: "other-id",
    aliases: ["extra alias"],
    sources: [
      {
        connector: "test",
        sourceId: "x",
        retrievedAt: new Date().toISOString(),
        evidence: ["test"],
      },
    ],
  };
  const merged = mergeOrganizations(a, b);
  assert.ok(merged.aliases.includes("extra alias"));
  assert.equal(merged.sources.length, 2);
});

check("dedupeOrganizations merges same domain", () => {
  const records = getAllDirectoryRecords().filter((r) => r.website);
  if (records.length < 2) return;
  const orgs = records.slice(0, 2).map(directoryRecordToOrganization);
  orgs[1]!.domain = orgs[0]!.domain;
  orgs[1]!.id = "duplicate-id";
  const deduped = dedupeOrganizations(orgs);
  assert.equal(deduped.length, 1);
});

check("discoverOrganizationsSync returns Ohio manufacturers", () => {
  initDiscoveryEngine();
  const result = discoverOrganizationsSync("manufacturers in ohio");
  assert.ok(result.organizations.length > 0);
  const top = result.organizations.slice(0, 20);
  const mfgLike = top.filter(
    (o) =>
      o.sectorId === "manufacturing" ||
      o.industries.some((i) =>
        /manufactur|food|industrial|chemical|automotive|packaging|life-sciences|medical-device/.test(
          i,
        ),
      ),
  );
  assert.ok(
    mfgLike.length >= 10,
    "top discovery results should skew toward manufacturing sector",
  );
  assert.ok(
    top.some((o) => o.states.includes("OH")),
    "expected Ohio organizations in top results",
  );
});

check("runDiagnostics reports catalog health", () => {
  const report = runDiagnostics();
  assert.ok(report.coverage.total >= 5_000, "catalog should exceed curated baseline");
  assert.ok(report.completeness.pctState >= 60);
  assert.ok(report.completeness.pctIndustry >= 95);
  assert.ok(report.completeness.pctOrganizationType >= 95);
  assert.ok(report.connectorHealth.length >= 6);
  assert.ok(typeof report.duplicates.duplicateDomains === "object");
});

check("computeCoverage categories sum sensibly", () => {
  const coverage = computeCoverage();
  const catSum =
    coverage.categories.healthcare +
    coverage.categories.manufacturers +
    coverage.categories.financialServices +
    coverage.categories.education +
    coverage.categories.retail +
    coverage.categories.technology +
    coverage.categories.nonprofits +
    coverage.categories.government;
  assert.ok(catSum >= coverage.total * 0.5);
});

check("diagnostics handles an empty connector result set", () => {
  const report = runDiagnostics([]);
  assert.equal(report.coverage.total, 0);
  assert.equal(report.completeness.total, 0);
  assert.deepEqual(report.duplicates.duplicateDomains, []);
  assert.ok(report.connectorHealth.length >= 1);
});

check("diagnostics detects duplicate connector records without crashing", () => {
  const [first] = organizationsFromDirectory();
  assert.ok(first);
  const duplicate = {
    ...first!,
    id: "duplicate-diagnostics-record",
    sources: [
      ...first!.sources,
      {
        connector: "test-failed-connector",
        sourceId: "dup",
        retrievedAt: new Date().toISOString(),
        evidence: ["duplicate fixture"],
      },
    ],
  };
  const duplicates = detectDuplicates([first!, duplicate]);
  assert.equal(duplicates.duplicateDomains.length, first!.domain ? 1 : 0);
  const health = computeConnectorHealth([first!, duplicate]);
  assert.ok(health.every((item) => typeof item.failures === "number"));
});

check("every catalog org has exactly one canonical organization type", () => {
  initDiscoveryEngine();
  const orgs = organizationsFromDirectory().slice(0, 20).map(finalizeOrganization);
  for (const org of orgs) {
    assert.ok(org.canonicalOrganizationType);
    assert.ok(typeof org.canonicalOrganizationType === "string");
  }
});

check("health plan facet counts come from full catalog not result cap", () => {
  initDiscoveryEngine();
  const intent = parseSearchIntent("health plans");
  const facets = computeCatalogFacetCounts(intent);
  const fromIndex = getCatalogOrganizations().filter(
    (o) => o.canonicalOrganizationType === "health-plan",
  ).length;
  const healthPlanCount = facets.canonicalOrganizationType["health-plan"] ?? 0;
  assert.equal(
    healthPlanCount,
    fromIndex,
    "facet count must match manual CatalogIndex tally",
  );
  const capped = discoverOrganizationsSync("health plans", { maxResults: 10 });
  const facetsAgain = computeCatalogFacetCounts(intent);
  assert.equal(
    facetsAgain.canonicalOrganizationType["health-plan"],
    healthPlanCount,
    "facet count must not change when search result cap changes",
  );
  assert.equal(capped.totalReturned, Math.min(10, capped.totalAfterRank));
  if (healthPlanCount > capped.totalReturned) {
    assert.ok(
      healthPlanCount > capped.totalReturned,
      "catalog facet must not be capped to returned page size",
    );
  }
});

check("national health_plan facet exposes every state with a health plan", () => {
  initDiscoveryEngine();
  // No state and no region selected → national scope, scoped to health plans.
  const intent = parseSearchIntent("", { organizationTypeId: "health-plan" });
  assert.equal(intent.state, null, "intent must be national (no state)");
  const facets = computeCatalogFacetCounts(intent);

  const healthPlans = getCatalogOrganizations().filter(
    (o) => o.canonicalOrganizationType === "health-plan",
  );
  assert.ok(healthPlans.length > 0, "catalog must contain health plans");

  // Every distinct state served by a health plan org in CatalogIndex.
  const expectedStates = new Set<string>();
  for (const o of healthPlans) {
    for (const s of o.states) {
      if (s) expectedStates.add(s);
    }
  }
  assert.ok(
    expectedStates.size > 0,
    "health plans must serve at least one state",
  );

  // Multi-state health plans previously collapsed to states[0]; the facet must
  // now expose every state that has at least one health_plan org.
  const facetStates = Object.keys(facets.state).filter(
    (k) => (facets.state[k] ?? 0) > 0,
  );
  assert.equal(
    facetStates.length,
    expectedStates.size,
    "state facet must list exactly the states with health_plan orgs",
  );
  for (const s of expectedStates) {
    const manual = healthPlans.filter((o) => o.states.includes(s)).length;
    assert.equal(
      facets.state[s],
      manual,
      `state ${s} count must equal the full CatalogIndex tally`,
    );
  }
});

check("discovery ranks full catalog before pagination cap", () => {
  initDiscoveryEngine();
  const result = discoverOrganizationsSync("manufacturers in ohio", {
    maxResults: 25,
  });
  assert.ok(result.totalAfterRank >= result.totalReturned);
  if (result.totalAfterRank > 25) {
    assert.equal(result.totalReturned, 25);
  }
});

check("multi-state prospect remains visible when filtering by secondary state", () => {
  const response = runSearch({
    query: "health plans",
    sells: "",
    targets: "health plans",
  });
  const multiState = response.prospects.find((p) =>
    p.stateCodes?.includes("PA") && p.stateCodes.includes("TX"),
  );
  assert.ok(multiState, "expected a health plan operating in PA and TX");

  const filtered = applyResultsFilters(response.prospects, {
    ...EMPTY_SEARCH_STATE,
    query: "health plans",
    state: "TX",
  });
  assert.ok(
    filtered.some((p) => p.id === multiState.id),
    `${multiState.name} should remain visible for secondary-state TX filter`,
  );
});

check("catalog-only SEC source records match SEC source filter", () => {
  const response = runSearch({
    query: "banks in texas",
    sells: "",
    targets: "banks in texas",
  });
  const secProspect = response.prospects.find((p) =>
    p.sourceRecords.some((rec) => rec.connector === "sec"),
  );
  assert.ok(secProspect, "expected a catalog SEC-backed bank prospect");

  const filtered = applyResultsFilters(response.prospects, {
    ...EMPTY_SEARCH_STATE,
    query: "banks in texas",
    sources: ["SEC"],
  });
  assert.ok(
    filtered.some((p) => p.id === secProspect.id),
    "SEC source filter should match sourceRecords, not only sourceTrail/signals",
  );
});

check("discovery v2 returns SEC candidates for pharma manufacturer query", () => {
  initDiscoveryEngine();
  const intent = parseSearchIntent("pharma manufacturer");
  const result = runDiscoveryPipelineV2(intent);
  assert.ok(
    (result.diagnostics.connectorCandidates.sec ?? 0) > 20,
    `expected SEC candidates, got ${result.diagnostics.connectorCandidates.sec ?? 0}`,
  );
  assert.ok(result.diagnostics.mergedUnique > 20);
  const names = result.organizations.map((o) => o.canonicalName.toLowerCase());
  assert.ok(
    names.some((n) => n.includes("pfizer") || n.includes("eli lilly") || n.includes("merck")),
    "expected major pharma companies in ranked results",
  );
});

check("staged discovery v2 exposes per-connector diagnostics", () => {
  initDiscoveryEngine();
  const staged = discoverOrganizationsStaged("pharma manufacturer");
  assert.ok(staged.metadata.connectorCandidates);
  assert.ok((staged.metadata.connectorCandidates?.sec ?? 0) > 0);
  assert.ok((staged.metadata.mergedUnique ?? 0) > 0);
  assert.ok(staged.metadata.stagesRun.includes("multi-connector-discovery"));
});

check("merge keys dedupe SEC orgs by CIK", () => {
  const orgs = getCatalogOrganizations().filter((o) =>
    o.sources.some((s) => s.connector === "sec"),
  );
  const unique = [...new Map(orgs.map((o) => [o.id, o])).values()].slice(0, 40);
  const merged = dedupeOrganizationsByMergeKeys([...unique, ...unique]);
  assert.equal(merged.length, unique.length);
});

console.log(`\nAll ${passed} discovery checks passed.`);
