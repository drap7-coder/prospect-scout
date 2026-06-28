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
import { discoverOrganizationsSync, discoverOrganizationsStaged, discoverOrganizationsStagedAsync } from "../lib/discovery/discoveryEngine.ts";
import { runSearch, runSearchAsync } from "../lib/search/runSearch.ts";
import { traceWarehouseSearchPipeline } from "../lib/import/warehouse/discover.ts";
import { countDuplicateOrganizationIds } from "../lib/import/warehouse/mergeByVerifiedIds.ts";
import { getWarehouseOrganizations } from "../lib/import/warehouse/organizations.ts";

process.env.ORG_WAREHOUSE = "1";

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

console.log(`\nAll warehouse search checks passed (${warehouseHp} health plans searchable).`);
