#!/usr/bin/env node
/**
 * Enterprise Rollup v1 checks — collapse child orgs into enterprise profiles.
 * Run: ORG_WAREHOUSE=1 npm run test:enterprise
 */
import assert from "node:assert/strict";
import { importNationalHealthPlanCatalog } from "../lib/import/healthPlans/cms/importCms.ts";
import { importNationalManufacturerCatalog } from "../lib/import/manufacturers/importManufacturers.ts";
import { resetCatalogIndex } from "../lib/discovery/catalog/catalogIndex.ts";
import { parseSearchIntent } from "../lib/discovery/intent.ts";
import { discoverOrganizationsStaged } from "../lib/discovery/discoveryEngine.ts";
import { runSearch } from "../lib/search/runSearch.ts";
import { getWarehouseOrganizations } from "../lib/import/warehouse/organizations.ts";
import {
  computeEnterpriseRollupDiagnostics,
  findEnterpriseProfileById,
} from "../lib/enterprise/diagnostics.ts";
import { canonicalEnterpriseId } from "../lib/enterprise/canonicalId.ts";
import { rollupAllHealthPlanOrganizations } from "../lib/enterprise/rollup.ts";
import { resolveEnterpriseKey } from "../lib/enterprise/resolveKey.ts";

process.env.ORG_WAREHOUSE = "1";
process.env.ENTERPRISE_ROLLUP = "1";

await importNationalHealthPlanCatalog();
importNationalManufacturerCatalog();
resetCatalogIndex();

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const orgs = getWarehouseOrganizations();
const hpOrgs = orgs.filter((o) => o.buyerPack === "health-plans");
const rollup = rollupAllHealthPlanOrganizations(hpOrgs);
const diagnostics = computeEnterpriseRollupDiagnostics(orgs);

console.log("Enterprise rollup checks:\n");
console.log(
  `  Raw health plans: ${hpOrgs.length} → ${rollup.enterpriseCount} enterprises (${rollup.suppressedChildCount} suppressed)`,
);
console.log(
  `  Raw org domain coverage: ${diagnostics.rawOrgDomainCoverage.withDomain}/${diagnostics.rawOrgDomainCoverage.total} (${diagnostics.rawOrgDomainCoverage.pctDomain}%)`,
);
console.log(
  `  Enterprise profiles: ${diagnostics.rollupProfileCount} rollups + ${diagnostics.passthroughOrphans} passthrough orphans = ${diagnostics.searchResultCount} search results`,
);
console.log(
  `  Enterprise domain coverage: ${diagnostics.enterpriseProfilesWithDomain}/${diagnostics.rollupProfileCount} (${diagnostics.enterpriseDomainCoverage.pctDomain}%)`,
);
console.log(
  `  Promotion failures: ${diagnostics.promotionFailures} (${diagnostics.enterpriseProfilesWithDomainBearingChildren} profiles with domain-bearing children)`,
);

check("collapses warehouse orgs into fewer enterprise profiles", () => {
  assert.ok(rollup.enterpriseCount < hpOrgs.length);
  assert.ok(rollup.suppressedChildCount > 100);
  assert.ok(rollup.enterpriseCount < hpOrgs.length * 0.9);
});

check("Centene appears once in enterprise rollup", () => {
  const centene = rollup.profiles.find((p) =>
    canonicalEnterpriseId(p.id).includes("centene"),
  );
  assert.ok(centene, "expected Centene enterprise profile");
  assert.ok(centene!.childCount >= 10, `Centene should aggregate multiple children, got ${centene!.childCount}`);
  assert.equal(centene!.canonicalDomain, "centene.com");
});

check("Centene aggregates operating brands including Medicaid plans", () => {
  const centene = findEnterpriseProfileById("centene-corporation", orgs);
  assert.ok(centene);
  const brands = centene!.operatingBrands.join(" ").toLowerCase();
  assert.ok(
    brands.includes("sunshine") ||
      brands.includes("wellcare") ||
      brands.includes("buckeye") ||
      brands.includes("absolute"),
    `expected Centene operating brands, got: ${centene!.operatingBrands.slice(0, 8).join(", ")}`,
  );
});

check("Centene query returns one enterprise not many Medicaid operating plans", () => {
  const staged = discoverOrganizationsStaged("Centene health plans", {
    maxResults: 5000,
  });
  const centeneCards = staged.organizations.filter(
    (o) =>
      o.id.includes("centene") || o.canonicalName.toLowerCase().includes("centene"),
  );
  assert.equal(centeneCards.length, 1, "Centene should appear once in Centene search");
  assert.ok(staged.totalReturned < 24, "should not return every Centene child org");
});

check("default health plan search uses enterprise rollup stage", () => {
  const search = runSearch({ query: "health plan", sells: "", targets: "health plan" });
  assert.ok(
    search.discovery?.metadata?.stagesRun?.includes("enterprise-rollup"),
    "expected enterprise-rollup stage",
  );
  assert.ok(search.prospects.length < hpOrgs.length);
  const centeneProspects = search.prospects.filter((p) =>
    p.name.toLowerCase().includes("centene"),
  );
  assert.equal(centeneProspects.length, 1);
  assert.ok(centeneProspects[0]?.isEnterpriseRollup);
  assert.ok((centeneProspects[0]?.childOrganizationCount ?? 0) >= 10);
});

check("child orgs with Centene parent resolve to centene enterprise key", () => {
  const centeneChild = hpOrgs.find((o) => o.parentDisplayName?.includes("Centene"));
  assert.ok(centeneChild, "fixture should include Centene child orgs");
  const key = resolveEnterpriseKey(centeneChild!);
  assert.ok(key.key.includes("centene"));
});

check("orphan standalone orgs remain passthrough without EnterpriseProfile", () => {
  assert.ok(diagnostics.passthroughOrphans >= 400);
  assert.equal(diagnostics.passthroughOrphans, diagnostics.passthroughOrphanCount);
  assert.equal(diagnostics.rollupProfileCount + diagnostics.passthroughOrphans, diagnostics.searchResultCount);
  const orphanIds = new Set(
    rollup.organizations
      .filter((o) => !o.id.startsWith("enterprise:"))
      .map((o) => o.id),
  );
  assert.equal(orphanIds.size, diagnostics.passthroughOrphans);
});

function findProfileByDomainOrName(
  domain: string,
  nameFragment: string,
): (typeof rollup.profiles)[number] | undefined {
  return rollup.profiles.find(
    (p) =>
      p.canonicalDomain === domain ||
      p.id.includes(nameFragment) ||
      p.name.toLowerCase().includes(nameFragment),
  );
}

check("national enterprise profiles inherit canonical carrier domains", () => {
  const centene = findProfileByDomainOrName("centene.com", "centene");
  const uhc = findProfileByDomainOrName("uhc.com", "unitedhealth");
  const aetna = findProfileByDomainOrName("aetna.com", "aetna");
  const humana = findProfileByDomainOrName("humana.com", "humana");
  const elevance = findProfileByDomainOrName("elevancehealth.com", "elevance");
  const floridaBlue = findProfileByDomainOrName("floridablue.com", "florida");

  assert.equal(centene?.canonicalDomain, "centene.com");
  assert.equal(uhc?.canonicalDomain, "uhc.com");
  assert.equal(aetna?.canonicalDomain, "aetna.com");
  assert.equal(humana?.canonicalDomain, "humana.com");
  assert.equal(elevance?.canonicalDomain, "elevancehealth.com");
  assert.equal(floridaBlue?.canonicalDomain, "floridablue.com");
});

check("no enterprise profile exposes multiple canonical domains", () => {
  for (const profile of rollup.profiles) {
    if (!profile.canonicalDomain) continue;
    const domain = profile.canonicalDomain.toLowerCase();
    assert.ok(!domain.includes(","), `${profile.name} has comma-separated domains`);
    assert.ok(!domain.includes(" "), `${profile.name} has space-separated domains`);
  }
});

check("promotion failures are zero — missing domains reflect raw org coverage", () => {
  assert.equal(diagnostics.promotionFailures, 0);
  assert.ok(
    diagnostics.rawOrgDomainCoverage.withDomain >= diagnostics.enterpriseProfilesWithDomain,
    "raw org domains consolidate into enterprise profiles",
  );
  assert.ok(
    diagnostics.enterpriseProfilesWithDomain >= diagnostics.enterpriseProfilesWithDomainBearingChildren,
    "curated parent mappings can assign domains beyond child-record promotion",
  );
});

check("domain provenance fields populated on promoted enterprises", () => {
  const promoted = rollup.profiles.filter((p) => p.canonicalDomain);
  assert.ok(promoted.length >= 20);
  for (const profile of promoted) {
    assert.ok(profile.website?.includes(profile.canonicalDomain!), `${profile.name} website`);
    assert.ok(profile.domainConfidence != null && profile.domainConfidence >= 0.85, profile.name);
    assert.ok(profile.domainSource, profile.name);
    assert.ok(profile.domainEvidenceCount >= 1, profile.name);
    assert.equal(profile.domainAmbiguous, false, profile.name);
  }
});

check("ambiguous multi-domain enterprises are rejected", () => {
  assert.equal(diagnostics.domainPromotion.ambiguousEnterprises, 0);
  const ambiguousWithDomain = rollup.profiles.filter(
    (p) => p.domainAmbiguous && p.canonicalDomain,
  );
  assert.equal(ambiguousWithDomain.length, 0);
});

check("every rollup with domain-bearing children receives a canonical domain", () => {
  assert.equal(diagnostics.promotionFailures, 0);
  assert.equal(diagnostics.domainPromotion.promotionSuccessPct, 100);
});

console.log(`\n${passed} checks passed.`);
