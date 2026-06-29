#!/usr/bin/env node
/**
 * Warehouse search checks — health plan query must reflect warehouse contents.
 * Run: ORG_WAREHOUSE=1 npm run test:warehouse-search
 */
import assert from "node:assert/strict";
import { importNationalHealthPlanCatalog } from "../lib/import/healthPlans/cms/importCms.ts";
import { importNationalManufacturerCatalog } from "../lib/import/manufacturers/importManufacturers.ts";
import { getHealthPlanIndexSize } from "../lib/import/healthPlans/memoryIndex.ts";
import { resetCatalogIndex } from "../lib/discovery/catalog/catalogIndex.ts";
import { parseSearchIntent } from "../lib/discovery/intent.ts";
import {
  discoverOrganizationsSync,
  discoverOrganizationsStaged,
  discoverOrganizationsStagedAsync,
} from "../lib/discovery/discoveryEngine.ts";
import { runSearch, runSearchAsync } from "../lib/search/runSearch.ts";
import { traceWarehouseSearchPipeline } from "../lib/import/warehouse/discover.ts";
import { countDuplicateOrganizationIds } from "../lib/import/warehouse/mergeByVerifiedIds.ts";
import { getWarehouseOrganizations } from "../lib/import/warehouse/organizations.ts";
import { discoverFromOrganizationWarehouse } from "../lib/import/warehouse/discover.ts";

process.env.ORG_WAREHOUSE = "1";
process.env.ENTERPRISE_ROLLUP = "0";

await importNationalHealthPlanCatalog();
importNationalManufacturerCatalog();
resetCatalogIndex();

const warehouseHp = getHealthPlanIndexSize();
const intent = parseSearchIntent("health plan");
const trace = traceWarehouseSearchPipeline(intent);
const sync = discoverOrganizationsSync("health plan", { maxResults: 5000 });
const staged = discoverOrganizationsStaged("health plan", { maxResults: 5000 });
const stagedAsync = await discoverOrganizationsStagedAsync("health plan", { maxResults: 5000 });
const search = runSearch({ query: "health plan", sells: "", targets: "health plan" });
const searchAsync = await runSearchAsync({ query: "health plan", sells: "", targets: "health plan" });

console.log("Warehouse search pipeline trace:");
for (const stage of trace.stages) {
  console.log(`  ${stage.stage}: ${stage.count} (−${stage.removed}) — ${stage.reason}`);
}

assert.ok(warehouseHp > 100, `expected substantial health plan warehouse, got ${warehouseHp}`);
assert.equal(countDuplicateOrganizationIds(getWarehouseOrganizations()), 0);
assert.equal(trace.matchingIntent, warehouseHp, "warehouse matching count should equal health plan index size");
assert.ok(
  sync.totalReturned >= warehouseHp * 0.95,
  `sync returned ${sync.totalReturned} of ${warehouseHp} warehouse health plans`,
);
assert.ok(
  staged.totalReturned >= warehouseHp * 0.95,
  `staged returned ${staged.totalReturned} of ${warehouseHp}`,
);
assert.ok(
  stagedAsync.totalReturned >= warehouseHp * 0.95,
  `async staged returned ${stagedAsync.totalReturned} of ${warehouseHp}`,
);
assert.equal(stagedAsync.metadata.stagesRun[0], "organization-warehouse");
assert.ok(
  search.prospects.length >= warehouseHp * 0.95,
  `UI search returned ${search.prospects.length} of ${warehouseHp}`,
);
assert.ok(
  searchAsync.prospects.length >= warehouseHp * 0.95,
  `async UI search returned ${searchAsync.prospects.length} of ${warehouseHp}`,
);
assert.ok(
  searchAsync.discovery?.metadata?.stagesRun?.includes("organization-warehouse"),
);

// Manufacturer in Ohio — warehouse path still works
const ohioMfgIntent = parseSearchIntent("manufacturer in Ohio", {
  organizationTypeId: "manufacturer",
  state: "OH",
});
const ohioMfg = discoverFromOrganizationWarehouse(ohioMfgIntent, { maxResults: 5000 });
assert.ok(ohioMfg.totalReturned > 0, "manufacturer in Ohio should return warehouse results");

// Classification filters when CMS data exists
const hpOrgs = getWarehouseOrganizations().filter((o) => o.buyerPack === "health-plans");
const maIndexed = hpOrgs.filter((o) =>
  o.classifications?.some((c) => c.namespace === "health-plans" && c.id === "medicare_advantage"),
).length;
if (maIndexed > 0) {
  const maIntent = parseSearchIntent("medicare advantage", {
    classificationNamespace: "health-plans",
    classificationId: "medicare_advantage",
  });
  const maResults = discoverFromOrganizationWarehouse(maIntent, { maxResults: 5000 });
  assert.equal(maResults.totalReturned, maIndexed, "Medicare Advantage filter matches indexed count");
}

const medicaidIndexed = hpOrgs.filter((o) =>
  o.classifications?.some(
    (c) => c.namespace === "health-plans" && c.id === "medicaid_managed_care",
  ),
).length;
if (medicaidIndexed > 0) {
  const medicaidIntent = parseSearchIntent("health plan", {
    organizationTypeId: "health-plan",
    classificationNamespace: "health-plans",
    classificationId: "medicaid_managed_care",
  });
  const medicaidResults = discoverFromOrganizationWarehouse(medicaidIntent, { maxResults: 5000 });
  assert.ok(
    medicaidResults.totalReturned >= medicaidIndexed * 0.95,
    `Medicaid filter returned ${medicaidResults.totalReturned} of ${medicaidIndexed}`,
  );
}

const acaIndexed = hpOrgs.filter((o) =>
  o.classifications?.some((c) => c.namespace === "health-plans" && c.id === "aca_marketplace"),
).length;
if (acaIndexed > 0) {
  const acaIntent = parseSearchIntent("health plan", {
    organizationTypeId: "health-plan",
    classificationNamespace: "health-plans",
    classificationId: "aca_marketplace",
  });
  const acaResults = discoverFromOrganizationWarehouse(acaIntent, { maxResults: 5000 });
  assert.ok(
    acaResults.totalReturned >= acaIndexed * 0.95,
    `ACA filter returned ${acaResults.totalReturned} of ${acaIndexed}`,
  );
}

// Classifications preserve source provenance
const withProv = hpOrgs.filter((o) =>
  o.classifications?.some((c) => c.provenance?.sourceConnector),
);
assert.ok(withProv.length > 0, "health plan classifications should include provenance");

console.log(`\nAll warehouse search checks passed (${warehouseHp} health plans searchable).`);
