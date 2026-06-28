#!/usr/bin/env node
/**
 * Import the organization warehouse (production connectors only — no bootstrap seed).
 * Usage: npm run import:warehouse
 */
import { importOrganizationWarehouse } from "../lib/import/warehouse/import.ts";
import { cmsImportMode } from "../lib/import/healthPlans/cms/resolvePaths.ts";
import { manufacturerImportMode } from "../lib/import/manufacturers/sources/loadSources.ts";
import { formatRegressionFindings } from "../lib/import/healthPlans/importRegression.ts";
import { resetCatalogIndex } from "../lib/discovery/catalog/catalogIndex.ts";

console.log(
  `Organization warehouse import · strict=${process.env.WAREHOUSE_STRICT_IMPORT ?? "(default)"} · health-plans: ${cmsImportMode()} · manufacturers: ${manufacturerImportMode()}`,
);
const stats = await importOrganizationWarehouse();
resetCatalogIndex();

console.log("\nWarehouse import summary:");
console.log(`  Total indexed: ${stats.totalIndexSize}`);
console.log(`  Strict mode: ${stats.strictMode}`);
for (const outcome of stats.connectorOutcomes) {
  console.log(
    `  ${outcome.id}: ${outcome.status}${outcome.error ? ` — ${outcome.error.split("\n")[0]}` : ""}`,
  );
}
if (stats.healthPlans) {
  console.log(`  Health plans indexed: ${stats.healthPlans.indexSizeAfterImport}`);
}
if (stats.manufacturers) {
  console.log(`  Manufacturers indexed: ${stats.manufacturers.indexSizeAfterImport}`);
}

if (stats.healthPlans?.regressionFindings.length) {
  console.log("\nRegression:");
  console.log(formatRegressionFindings(stats.healthPlans.regressionFindings));
}

console.log("\nFull stats:");
console.log(JSON.stringify(stats, null, 2));
