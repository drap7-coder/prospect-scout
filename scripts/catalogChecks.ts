/**
 * Industry catalog registry and routing checks.
 * Run: npm run test:catalog
 */
import assert from "node:assert/strict";
import {
  INDUSTRY_CATALOG,
  getCatalogNode,
  topLevelCatalogNodes,
} from "../lib/catalog/registry.ts";
import {
  aggregateSectorCoverage,
  intentUsesWarehouse,
  resolveCatalogNodeForIntent,
} from "../lib/catalog/routing.ts";
import {
  catalogNodeIsSearchable,
  catalogNodeToSearchState,
} from "../lib/catalog/launch.ts";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Industry catalog checks:\n");

check("top-level catalog has 18 industries", () => {
  assert.equal(topLevelCatalogNodes().length, 18);
});

check("healthcare drill-down includes health plans", () => {
  const hp = getCatalogNode("health-plans");
  assert.ok(hp);
  assert.equal(hp!.coverage, "warehouse");
  assert.equal(hp!.organizationTypeId, "health-plan");
});

check("manufacturing sector aggregates warehouse coverage", () => {
  const mfg = getCatalogNode("manufacturing");
  assert.ok(mfg);
  assert.equal(aggregateSectorCoverage(mfg!), "warehouse");
});

check("higher education uses live discovery", () => {
  const he = getCatalogNode("higher-education");
  assert.ok(he);
  assert.equal(he!.coverage, "live-discovery");
});

check("intentUsesWarehouse for health plans", () => {
  assert.equal(
    intentUsesWarehouse({
      sectorId: "healthcare",
      industryId: "payers",
      organizationTypeId: "health-plan",
      classificationFilter: null,
    }),
    true,
  );
});

check("intentUsesWarehouse false for universities", () => {
  assert.equal(
    intentUsesWarehouse({
      sectorId: "education",
      industryId: "universities",
      organizationTypeId: "university",
      classificationFilter: null,
    }),
    false,
  );
});

check("catalogNodeToSearchState maps taxonomy ids", () => {
  const state = catalogNodeToSearchState(getCatalogNode("health-plans")!);
  assert.equal(state.sector, "healthcare");
  assert.equal(state.organizationType, "health-plan");
  assert.ok(state.query.length > 0);
});

check("planned nodes without taxonomy are not searchable", () => {
  const streaming = getCatalogNode("streaming");
  assert.ok(streaming);
  assert.equal(catalogNodeIsSearchable(streaming!), false);
});

check("every top-level node has description and icon or label", () => {
  for (const node of INDUSTRY_CATALOG) {
    assert.ok(node.description.length > 0, node.id);
    assert.ok(node.label.length > 0, node.id);
  }
});

check("resolveCatalogNodeForIntent prefers org type", () => {
  const node = resolveCatalogNodeForIntent({
    sectorId: "healthcare",
    industryId: "payers",
    organizationTypeId: "health-plan",
  });
  assert.ok(node);
  assert.equal(node!.organizationTypeId, "health-plan");
});

console.log(`\n${passed} industry catalog checks passed.`);
