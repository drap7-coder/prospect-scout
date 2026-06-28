#!/usr/bin/env node
/**
 * Warehouse hydration reliability — search must await hydration, not fall back to
 * fixture-scale results on a cold in-memory index.
 *
 * Run: ORG_WAREHOUSE=1 npm run test:warehouse-hydration
 */
import assert from "node:assert/strict";
import { importNationalHealthPlanCatalog } from "../lib/import/healthPlans/cms/importCms.ts";
import { importNationalManufacturerCatalog } from "../lib/import/manufacturers/importManufacturers.ts";
import { clearHealthPlanIndex } from "../lib/import/healthPlans/memoryIndex.ts";
import { clearManufacturerIndex } from "../lib/import/manufacturers/memoryIndex.ts";
import { getHealthPlanIndexSize } from "../lib/import/healthPlans/memoryIndex.ts";
import { resetCatalogIndex } from "../lib/discovery/catalog/catalogIndex.ts";
import {
  discoverOrganizationsStaged,
  discoverOrganizationsStagedAsync,
} from "../lib/discovery/discoveryEngine.ts";
import { runSearch, runSearchAsync } from "../lib/search/runSearch.ts";
import { resetWarehouseHydrationStateForTests } from "../lib/import/warehouse/hydration.ts";

process.env.ORG_WAREHOUSE = "1";

await importNationalHealthPlanCatalog();
importNationalManufacturerCatalog();
resetCatalogIndex();

const warehouseHp = getHealthPlanIndexSize();
assert.ok(warehouseHp > 100, `expected substantial health plan warehouse, got ${warehouseHp}`);

const warmAsync = await discoverOrganizationsStagedAsync("health plan", {
  maxResults: 5000,
});
assert.equal(
  warmAsync.metadata.stagesRun[0],
  "organization-warehouse",
  "hydrated async search must use organization-warehouse",
);
assert.equal(warmAsync.metadata.warehouse?.status, "warehouse-hydrated");
assert.ok(
  warmAsync.totalAfterRank >= warehouseHp * 0.95,
  `async warm search returned ${warmAsync.totalAfterRank} of ${warehouseHp}`,
);

const warmSearch = await runSearchAsync({
  query: "health plan",
  sells: "",
  targets: "health plan",
});
assert.ok(
  warmSearch.discovery?.metadata?.stagesRun?.includes("organization-warehouse"),
  "runSearchAsync must use warehouse stage",
);
assert.ok(
  (warmSearch.discovery?.totalAfterRank ?? 0) >= warehouseHp * 0.95,
  `runSearchAsync returned ${warmSearch.discovery?.totalAfterRank} of ${warehouseHp}`,
);

// Simulate cold serverless instance: empty in-memory index, hydration not cached.
clearHealthPlanIndex();
clearManufacturerIndex();
resetWarehouseHydrationStateForTests();

const coldSync = discoverOrganizationsStaged("health plan", { maxResults: 5000 });
assert.ok(
  !coldSync.metadata.stagesRun.includes("organization-warehouse"),
  `sync cold path must not use organization-warehouse (stages=${coldSync.metadata.stagesRun.join(",")})`,
);
assert.ok(
  coldSync.totalAfterRank < warehouseHp * 0.5,
  `sync cold path should stay below warehouse scale (got ${coldSync.totalAfterRank} vs ${warehouseHp})`,
);

// Refill memory (dev/test without DATABASE_URL) then async must still route warehouse.
await importNationalHealthPlanCatalog();
importNationalManufacturerCatalog();
resetCatalogIndex();
resetWarehouseHydrationStateForTests();

const coldAsync = await discoverOrganizationsStagedAsync("health plan", {
  maxResults: 5000,
});
assert.equal(
  coldAsync.metadata.stagesRun[0],
  "organization-warehouse",
  "async search after re-import must use warehouse even when hydration cache was reset",
);
assert.ok(
  coldAsync.totalAfterRank >= warehouseHp * 0.95,
  `async after re-import returned ${coldAsync.totalAfterRank} of ${warehouseHp}`,
);

// Repeated async requests stay warehouse-backed (warm path).
for (let i = 0; i < 3; i++) {
  const repeat = await discoverOrganizationsStagedAsync("health plan", {
    maxResults: 5000,
  });
  assert.equal(repeat.metadata.stagesRun[0], "organization-warehouse");
  assert.ok(repeat.totalAfterRank >= warehouseHp * 0.95);
}

const syncAfterLoad = runSearch({
  query: "health plan",
  sells: "",
  targets: "health plan",
});
assert.ok(
  syncAfterLoad.discovery?.metadata?.stagesRun?.includes("organization-warehouse"),
  "sync runSearch works when index is preloaded in-process",
);

console.log(
  `\nAll warehouse hydration reliability checks passed (${warehouseHp} health plans).`,
);
