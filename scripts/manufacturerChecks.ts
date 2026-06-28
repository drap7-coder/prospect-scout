/**
 * Manufacturer warehouse connector checks.
 * Run: npm run test:manufacturers
 */
import assert from "node:assert/strict";
import { MANUFACTURERS_DIRECTORY } from "../lib/directories/manufacturers.ts";
import {
  clearManufacturerIndex,
  getManufacturerIndexSize,
  getManufacturerOrganizations,
  importManufacturerFullCatalog,
  importNationalManufacturerCatalog,
  parseManufacturerSeed,
} from "../lib/import/manufacturers/index.ts";
import { countDuplicateOrganizationIds } from "../lib/import/warehouse/mergeByVerifiedIds.ts";
import { resetCatalogIndex, getCatalogOrganizations } from "../lib/discovery/catalog/catalogIndex.ts";
import { discoverOrganizationsSync } from "../lib/discovery/discoveryEngine.ts";

process.env.ORG_WAREHOUSE = "1";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Manufacturer warehouse connector checks:\n");

check("parseManufacturerSeed returns directory records", () => {
  clearManufacturerIndex();
  const rows = parseManufacturerSeed();
  assert.equal(rows.length, MANUFACTURERS_DIRECTORY.length);
  assert.ok(rows.length >= 30);
});

check("national import indexes manufacturers beyond seed-only scale", () => {
  clearManufacturerIndex();
  resetCatalogIndex();
  const stats = importNationalManufacturerCatalog();
  assert.ok(stats.indexSizeAfterImport > MANUFACTURERS_DIRECTORY.length);
  assert.equal(stats.duplicateOrganizationIds, 0);
  assert.ok(stats.secRecordsParsed > 0);
  assert.ok(stats.fdaRecordsParsed > 0);
});

check("full import merges bootstrap seed via verified ids", () => {
  clearManufacturerIndex();
  resetCatalogIndex();
  const stats = importManufacturerFullCatalog();
  assert.ok(stats.organizationsMerged > 0);
  assert.equal(getManufacturerIndexSize(), stats.indexSizeAfterImport);
});

check("indexed manufacturers have warehouse connector provenance", () => {
  const orgs = getManufacturerOrganizations();
  assert.ok(orgs.length > 0);
  for (const org of orgs) {
    assert.equal(org.buyerPack, "manufacturers");
    assert.ok(
      org.sources.some((source) => source.connector.startsWith("warehouse-manufacturers")),
      `missing warehouse provenance on ${org.canonicalName}`,
    );
  }
});

check("catalog index includes warehouse manufacturers when index loaded", () => {
  resetCatalogIndex();
  const catalog = getCatalogOrganizations();
  const warehouseMfg = catalog.filter((org) =>
    org.sources.some((source) => source.connector.startsWith("warehouse-manufacturers")),
  );
  assert.ok(warehouseMfg.length > 0);
  assert.equal(countDuplicateOrganizationIds(getManufacturerOrganizations()), 0);
});

check("discovery search finds warehouse manufacturers", () => {
  resetCatalogIndex();
  const result = discoverOrganizationsSync("manufacturers in ohio");
  assert.ok(result.organizations.length > 0);
  assert.ok(
    result.organizations.some((org) =>
      org.sources.some((source) => source.connector.startsWith("warehouse-manufacturers")),
    ),
  );
});

console.log(`\nAll ${passed} manufacturer warehouse checks passed.`);
