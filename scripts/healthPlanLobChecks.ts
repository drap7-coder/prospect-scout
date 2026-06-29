#!/usr/bin/env node
/**
 * Health Plan LOB classification + search passthrough checks.
 * Run: ORG_WAREHOUSE=1 npm run test:lob
 */
import assert from "node:assert/strict";
import { importNationalHealthPlanCatalog } from "../lib/import/healthPlans/cms/importCms.ts";
import { importNationalManufacturerCatalog } from "../lib/import/manufacturers/importManufacturers.ts";
import { resetCatalogIndex } from "../lib/discovery/catalog/catalogIndex.ts";
import { getCatalogNode, catalogNodeToSearchState } from "../lib/catalog/index.ts";
import { searchStateToRawInput } from "../lib/search/searchState.ts";
import { runSearch } from "../lib/search/runSearch.ts";
import { discoverOrganizationsStaged } from "../lib/discovery/discoveryEngine.ts";
import { parseSearchIntent } from "../lib/discovery/intent.ts";
import { rollupAllHealthPlanOrganizations } from "../lib/enterprise/rollup.ts";
import { computeEnterpriseRollupDiagnostics } from "../lib/enterprise/diagnostics.ts";
import { getWarehouseOrganizations } from "../lib/import/warehouse/organizations.ts";
import type { Prospect } from "../lib/search/types.ts";
import { HEALTH_PLANS_CLASSIFICATION_NAMESPACE } from "../lib/import/healthPlans/warehouseMapping.ts";

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

function catalogRawInput(nodeId: string) {
  const node = getCatalogNode(nodeId);
  assert.ok(node, `missing catalog node ${nodeId}`);
  return searchStateToRawInput(catalogNodeToSearchState(node));
}

function prospectLobIds(prospect: Prospect): string[] {
  if (prospect.enterpriseProfile?.linesOfBusiness.length) {
    return prospect.enterpriseProfile.linesOfBusiness;
  }
  return (prospect.classifications ?? [])
    .filter((c) => c.namespace === HEALTH_PLANS_CLASSIFICATION_NAMESPACE)
    .map((c) => c.id);
}

function hasLob(prospect: Prospect, lobId: string): boolean {
  return prospectLobIds(prospect).includes(lobId);
}

function isMaOnly(prospect: Prospect): boolean {
  const lobs = prospectLobIds(prospect);
  return lobs.length > 0 && lobs.every((id) => id === "medicare_advantage" || id === "part_d");
}

function isMedicaidOnly(prospect: Prospect): boolean {
  const lobs = prospectLobIds(prospect);
  return lobs.length > 0 && lobs.every((id) => id === "medicaid_managed_care");
}

function isCommercialOnly(prospect: Prospect): boolean {
  const lobs = prospectLobIds(prospect);
  return lobs.length > 0 && lobs.every((id) => id === "commercial" || id === "aca_marketplace");
}

function assertAllHaveLob(prospects: Prospect[], lobId: string, label: string) {
  const missing = prospects.filter((p) => !hasLob(p, lobId));
  assert.equal(
    missing.length,
    0,
    `${label}: ${missing.length} results missing ${lobId}, e.g. ${missing[0]?.name ?? "none"}`,
  );
}

console.log("Health Plan LOB classification checks:\n");

check("catalog Commercial Plans preserves classification on raw input", () => {
  const raw = catalogRawInput("commercial-plans");
  assert.equal(raw.classificationId, "commercial");
  assert.equal(raw.classificationNamespace, HEALTH_PLANS_CLASSIFICATION_NAMESPACE);
  assert.equal(raw.query, "");
});

check("runSearch passes commercial classification into discovery intent", () => {
  const raw = catalogRawInput("commercial-plans");
  const search = runSearch(raw);
  const intent = parseSearchIntent(raw.query ?? "", {
    sectorId: raw.sectorId,
    industryId: raw.industryId,
    organizationTypeId: raw.organizationTypeId,
    classificationNamespace: raw.classificationNamespace,
    classificationId: raw.classificationId,
  });
  assert.deepEqual(intent.classificationFilter, {
    namespace: HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
    ids: ["commercial"],
  });
  assert.ok(search.discovery?.metadata?.stagesRun?.includes("enterprise-rollup"));
});

check("empty-query Medicare Advantage catalog preserves MA classification", () => {
  const raw = catalogRawInput("medicare-advantage-plans");
  assert.equal(raw.query, "");
  assert.equal(raw.classificationId, "medicare_advantage");
  const staged = discoverOrganizationsStaged(raw.query ?? "", {
    sectorId: raw.sectorId,
    industryId: raw.industryId,
    organizationTypeId: raw.organizationTypeId,
    classificationNamespace: raw.classificationNamespace,
    classificationId: raw.classificationId,
  });
  assert.equal(staged.intent.classificationFilter?.ids[0], "medicare_advantage");
});

check("empty-query Medicaid MCO catalog preserves Medicaid classification", () => {
  const raw = catalogRawInput("medicaid-mcos");
  assert.equal(raw.classificationId, "medicaid_managed_care");
  const search = runSearch(raw);
  assert.ok(search.prospects.length > 0);
});

const commercialSearch = runSearch(catalogRawInput("commercial-plans"));
const maSearch = runSearch(catalogRawInput("medicare-advantage-plans"));
const medicaidSearch = runSearch(catalogRawInput("medicaid-mcos"));

console.log("\nLOB search counts (after classification passthrough fix):");
console.log(`  Commercial Plans: ${commercialSearch.prospects.length} results`);
console.log(`  Medicare Advantage: ${maSearch.prospects.length} results`);
console.log(`  Medicaid MCOs: ${medicaidSearch.prospects.length} results`);
console.log(
  `  Commercial rollup: ${JSON.stringify(commercialSearch.discovery?.metadata?.enterpriseRollup ?? null)}`,
);

check("Commercial Plans returns only organizations with commercial LOB", () => {
  assert.ok(commercialSearch.prospects.length > 0);
  assert.ok(commercialSearch.prospects.length < 800, "commercial should not return full warehouse");
  assertAllHaveLob(commercialSearch.prospects, "commercial", "Commercial Plans");
});

check("Commercial Plans excludes MA-only and Medicaid-only organizations", () => {
  const maOnly = commercialSearch.prospects.filter(isMaOnly);
  const medicaidOnly = commercialSearch.prospects.filter(isMedicaidOnly);
  assert.equal(maOnly.length, 0, `MA-only in commercial: ${maOnly.map((p) => p.name).slice(0, 3).join(", ")}`);
  assert.equal(
    medicaidOnly.length,
    0,
    `Medicaid-only in commercial: ${medicaidOnly.map((p) => p.name).slice(0, 3).join(", ")}`,
  );
});

check("Medicare Advantage excludes commercial-only organizations", () => {
  assert.ok(maSearch.prospects.length > 0);
  assertAllHaveLob(maSearch.prospects, "medicare_advantage", "Medicare Advantage");
  const commercialOnly = maSearch.prospects.filter(isCommercialOnly);
  assert.equal(
    commercialOnly.length,
    0,
    `commercial-only in MA: ${commercialOnly.map((p) => p.name).slice(0, 3).join(", ")}`,
  );
});

check("Medicaid MCO excludes commercial-only organizations", () => {
  assert.ok(medicaidSearch.prospects.length > 0);
  assertAllHaveLob(medicaidSearch.prospects, "medicaid_managed_care", "Medicaid MCO");
  const commercialOnly = medicaidSearch.prospects.filter(isCommercialOnly);
  assert.equal(
    commercialOnly.length,
    0,
    `commercial-only in Medicaid: ${commercialOnly.map((p) => p.name).slice(0, 3).join(", ")}`,
  );
});

check("multi-LOB enterprise can appear when it has the requested LOB", () => {
  const multiLob = commercialSearch.prospects.filter((p) => {
    const lobs = prospectLobIds(p);
    return lobs.includes("commercial") && lobs.length > 1;
  });
  assert.ok(
    multiLob.length > 0,
    "expected at least one commercial result with additional LOBs",
  );
});

const orgs = getWarehouseOrganizations();
const hpOrgs = orgs.filter((o) => o.buyerPack === "health-plans");
const rollupBefore = rollupAllHealthPlanOrganizations(hpOrgs);
const diagnosticsBefore = computeEnterpriseRollupDiagnostics(hpOrgs);

check("enterprise rollup behavior unchanged after LOB passthrough fix", () => {
  assert.ok(rollupBefore.enterpriseCount < hpOrgs.length);
  assert.equal(diagnosticsBefore.promotionFailures, 0);
  assert.ok(commercialSearch.discovery?.metadata?.enterpriseRollup);
});

check("passthrough orphans still appear when unmatched by enterprise key", () => {
  const orphans = commercialSearch.prospects.filter((p) => !p.isEnterpriseRollup);
  assert.ok(orphans.length > 0, "expected some passthrough orphans in commercial results");
});

check("enterprise rollup metadata preserved in search response", () => {
  const rollup = commercialSearch.discovery?.metadata?.enterpriseRollup;
  assert.ok(rollup);
  assert.ok(rollup!.rawCount > rollup!.enterpriseCount);
  assert.ok(rollup!.suppressedChildCount > 0);
});

console.log(`\n${passed} checks passed.`);
