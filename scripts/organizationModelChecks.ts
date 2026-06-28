#!/usr/bin/env node
/** Generic organization warehouse model checks. Run: ORG_WAREHOUSE=1 npm run test:organization-model */
import assert from "node:assert/strict";
import { importNationalHealthPlanCatalog } from "../lib/import/healthPlans/cms/importCms.ts";
import { getHealthPlanOrganizations } from "../lib/import/healthPlans/memoryIndex.ts";
import { parseSearchIntent } from "../lib/discovery/intent.ts";
import { discoverFromOrganizationWarehouse } from "../lib/import/warehouse/discover.ts";
import { inferStateFromQuery } from "../lib/directories/search.ts";

process.env.ORG_WAREHOUSE = "1";
process.env.HEALTH_PLAN_IMPORT_STRICT = "0";

await importNationalHealthPlanCatalog();
const orgs = getHealthPlanOrganizations();

assert.ok(orgs.every((o) => (o.classifications?.length ?? 0) > 0), "all HP orgs have classifications");
assert.ok(orgs.every((o) => o.parentDisplayName), "all HP orgs have parentDisplayName");
assert.equal(orgs.filter((o) => o.geography?.national).length, 314, "CPSC national geography");

const txIntent = parseSearchIntent("health plans in texas");
const txResults = discoverFromOrganizationWarehouse(txIntent, { maxResults: 5000 });
const txActual = orgs.filter((o) => o.states.includes("TX")).length;
assert.ok(txResults.totalReturned <= txActual + 5, `TX search ${txResults.totalReturned} vs ${txActual} indexed`);
assert.ok(txResults.totalReturned >= txActual * 0.9);

assert.equal(parseSearchIntent("health plans in CT").state, "CT");
assert.equal(inferStateFromQuery("health plans in CT"), "CT");

const maIntent = parseSearchIntent("medicare advantage plans");
assert.ok(maIntent.classificationFilter?.namespace === "health-plans");
const maResults = discoverFromOrganizationWarehouse(maIntent, { maxResults: 5000 });
assert.equal(maResults.totalReturned, orgs.filter((o) =>
  o.classifications?.some((c) => c.namespace === "health-plans" && c.id === "medicare_advantage"),
).length);

const centeneIntent = parseSearchIntent("health plans Centene");
const centeneResults = discoverFromOrganizationWarehouse(centeneIntent, { maxResults: 5000 });
const centeneIndexed = orgs.filter((o) =>
  `${o.parentDisplayName} ${o.canonicalName}`.toLowerCase().includes("centene"),
).length;
assert.ok(centeneResults.totalReturned >= centeneIndexed * 0.8);
assert.ok(centeneResults.totalReturned < orgs.length / 2);

console.log("Organization model checks passed.");
console.log(`  TX: ${txResults.totalReturned}/${txActual}`);
console.log(`  MA: ${maResults.totalReturned}`);
console.log(`  Centene: ${centeneResults.totalReturned}/${centeneIndexed}`);
