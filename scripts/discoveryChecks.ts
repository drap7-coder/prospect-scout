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
import {
  discoverOrganizationsSync,
  initDiscoveryEngine,
} from "../lib/discovery/discoveryEngine.ts";
import {
  computeCoverage,
  computeConnectorHealth,
  detectDuplicates,
  runDiagnostics,
} from "../lib/discovery/diagnostics.ts";
import { getAllDirectoryRecords } from "../lib/directories/search.ts";

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
  const allMfg = result.organizations.every(
    (o) => o.sectorId === "manufacturing" || o.industries.some((i) => i.includes("manufactur") || i.includes("food") || i.includes("industrial") || i.includes("chemical") || i.includes("automotive") || i.includes("packaging") || i.includes("life-sciences") || i.includes("medical-device")),
  );
  assert.ok(allMfg, "top results should be manufacturing sector");
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

console.log(`\nAll ${passed} discovery checks passed.`);
