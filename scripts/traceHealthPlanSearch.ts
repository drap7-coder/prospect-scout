#!/usr/bin/env node
/**
 * Trace "health plan" query through every search pipeline stage.
 * Usage: ORG_WAREHOUSE=1 USE_CMS_FIXTURES=1 node --import tsx scripts/traceHealthPlanSearch.ts
 */
import { importOrganizationWarehouse } from "../lib/import/warehouse/import.ts";
import { getWarehouseOrganizations } from "../lib/import/warehouse/organizations.ts";
import { traceWarehouseSearchPipeline } from "../lib/import/warehouse/discover.ts";
import {
  resetCatalogIndex,
  getCatalogIndex,
  discoverFromCatalogIndex,
  orgMatchesIntent,
} from "../lib/discovery/catalog/catalogIndex.ts";
import { parseSearchIntent } from "../lib/discovery/intent.ts";
import {
  initDiscoveryEngine,
  discoverOrganizationsSync,
  discoverOrganizationsStaged,
} from "../lib/discovery/discoveryEngine.ts";
import {
  runDiscoveryPipelineV2,
  DISCOVERY_V2_CONNECTOR_IDS,
} from "../lib/discovery/discoveryPipelineV2.ts";
import { discoverFromOrganizationWarehouse } from "../lib/import/warehouse/discover.ts";
import { shouldUseOrganizationWarehouse } from "../lib/import/warehouse/featureFlag.ts";
import { getHealthPlanIndexSize, getHealthPlanOrganizations } from "../lib/import/healthPlans/memoryIndex.ts";
import { shouldUsePersistentHealthPlanCatalog } from "../lib/import/healthPlans/featureFlag.ts";
import { countDuplicateOrganizationIds } from "../lib/import/warehouse/mergeByVerifiedIds.ts";
import { runSearch } from "../lib/search/runSearch.ts";

process.env.ORG_WAREHOUSE = process.env.ORG_WAREHOUSE ?? "1";

const QUERY = "health plan";

console.log(`\n=== Health plan search pipeline trace: "${QUERY}" ===\n`);
console.log(`ORG_WAREHOUSE=${process.env.ORG_WAREHOUSE}`);
console.log(`USE_CMS_FIXTURES=${process.env.USE_CMS_FIXTURES ?? "(unset)"}\n`);

// Load warehouse
await importOrganizationWarehouse();
resetCatalogIndex();

const warehouseHealthPlans = getHealthPlanOrganizations();
const warehouseAll = getWarehouseOrganizations();
const intent = parseSearchIntent(QUERY);

console.log("── Stage 0: Organization Warehouse ──");
console.log(`  Health plans connector indexed: ${getHealthPlanIndexSize()}`);
console.log(`  Warehouse health plans: ${warehouseHealthPlans.length}`);
console.log(`  Warehouse all connectors: ${warehouseAll.length}`);
console.log(`  Warehouse mode active: ${shouldUseOrganizationWarehouse()}`);
console.log(`  shouldUsePersistentHealthPlanCatalog(): ${shouldUsePersistentHealthPlanCatalog()}`);
console.log(`  Duplicate org IDs (cross-connector): ${countDuplicateOrganizationIds(warehouseAll)}`);

const warehouseTrace = traceWarehouseSearchPipeline(intent);
console.log("\n── Warehouse-primary search pipeline (production path when ORG_WAREHOUSE=1) ──");
for (const stage of warehouseTrace.stages) {
  console.log(`  ${stage.stage}: ${stage.count} (−${stage.removed})`);
  console.log(`    ${stage.reason}`);
  console.log(`    ${stage.codePath}`);
}

const warehouseSearch = discoverFromOrganizationWarehouse(intent, { maxResults: 2000 });
console.log(`  Warehouse search returned: ${warehouseSearch.totalReturned}`);

console.log("\n── Parsed intent ──");
console.log(JSON.stringify({
  organizationTypeId: intent.organizationTypeId,
  sectorId: intent.sectorId,
  industryId: intent.industryId,
  state: intent.state,
  region: intent.region,
}, null, 2));

// Catalog index
const index = getCatalogIndex();
const catalogHealthPlans = index.orgs.filter((o) => o.canonicalOrganizationType === "health-plan");
const catalogWarehouseHp = index.orgs.filter((o) =>
  o.sources.some((s) =>
    ["cms-cpsc", "cms-qhp", "cms-medicaid-mco", "cms-medicaid-enrollment", "bootstrap-seed"].includes(s.connector),
  ),
);

console.log("\n── Stage 1: CatalogIndex ──");
console.log(`  Total canonical orgs in index: ${index.orgs.length}`);
console.log(`  Health plans (canonicalOrganizationType): ${catalogHealthPlans.length}`);
console.log(`  Warehouse-sourced health plans in index: ${catalogWarehouseHp.length}`);
console.log(`  Merged during catalog build: ${index.mergedCount}`);
console.log(`  Source record count: ${index.sourceRecordCount}`);

const byConnector: Record<string, number> = {};
for (const org of index.orgs) {
  for (const src of org.sources) {
    byConnector[src.connector] = (byConnector[src.connector] ?? 0) + 1;
  }
}
console.log("  By connector (top warehouse/cms):");
for (const [k, v] of Object.entries(byConnector).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`    ${k}: ${v}`);
}

// Catalog index query
const catalogMatches = discoverFromCatalogIndex(intent, [...DISCOVERY_V2_CONNECTOR_IDS]);
console.log("\n── Stage 2: discoverFromCatalogIndex (all v2 connectors) ──");
console.log(`  Matches: ${catalogMatches.length}`);
console.log(`  Code: lib/discovery/catalog/catalogIndex.ts → discoverFromCatalogIndex`);

// Per-connector breakdown
initDiscoveryEngine();
const pipeline = runDiscoveryPipelineV2(intent, { maxResults: 500 });
console.log("\n── Stage 3: Per-connector candidates (discoveryPipelineV2) ──");
for (const [id, count] of Object.entries(pipeline.diagnostics.connectorCandidates).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${id}: ${count}`);
}
console.log(`  Total before dedupe: ${pipeline.totalBeforeDedupe}`);

console.log("\n── Stage 4: After connector merge/dedupe ──");
console.log(`  mergedUnique: ${pipeline.diagnostics.mergedUnique}`);
console.log(`  Code: dedupeOrganizationsByMergeKeys in discoveryPipelineV2.ts`);

console.log("\n── Stage 5: After ranking ──");
const allPool = Object.values(pipeline.diagnostics.connectorCandidates).reduce((a, b) => a + b, 0);
console.log(`  (ranked pool input was mergedUnique=${pipeline.diagnostics.mergedUnique})`);

console.log("\n── Stage 6: After filterIncompatibleOrganizations ──");
console.log(`  rankedCount (filtered): ${pipeline.diagnostics.rankedCount}`);
console.log(`  totalAfterRank: ${pipeline.totalAfterRank}`);

console.log("\n── Stage 7: After limitResults ──");
console.log(`  displayedCount: ${pipeline.diagnostics.displayedCount}`);
console.log(`  totalReturned: ${pipeline.totalReturned}`);

const staged = discoverOrganizationsStaged(QUERY, { maxResults: 2000 });
console.log("\n── Stage 8: discoverOrganizationsStaged (production search path) ──");
console.log(`  totalBeforeDedupe: ${staged.totalBeforeDedupe}`);
console.log(`  totalAfterRank: ${staged.totalAfterRank}`);
console.log(`  totalReturned: ${staged.totalReturned}`);
console.log(`  metadata.resultCount: ${staged.metadata.resultCount}`);

const search = runSearch({ query: QUERY, sells: "", targets: QUERY });
console.log("\n── Stage 9: runSearch → UI prospects ──");
console.log(`  prospects returned: ${search.prospects.length}`);
console.log(`  discovery.totalAfterRank: ${search.discovery?.totalAfterRank}`);
console.log(`  discovery.totalReturned: ${search.discovery?.totalReturned}`);
console.log(`  discovery.catalogTotal: ${search.discovery?.catalogTotal}`);

// Intent match on warehouse orgs
const warehouseMatchingIntent = warehouseHealthPlans.filter((o) => orgMatchesIntent(o, intent));
console.log("\n── Diagnostic: warehouse orgs matching intent filters ──");
console.log(`  ${warehouseMatchingIntent.length} / ${warehouseHealthPlans.length}`);

const warehouseInResults = staged.organizations.filter((o) =>
  o.sources.some((s) => s.connector.startsWith("cms-") || s.connector === "bootstrap-seed"),
);
console.log(`  Warehouse-sourced in staged results: ${warehouseInResults.length}`);

console.log("\n=== Trace complete ===\n");
