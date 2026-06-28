#!/usr/bin/env node
/**
 * Import the full organization warehouse into Neon (production DATABASE_URL).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npm run import:warehouse:neon
 *
 * After import, production Vercel will hydrate from Neon on first request.
 */
import { isDatabaseConfigured } from "../lib/db/index.ts";
import { importOrganizationWarehouse } from "../lib/import/warehouse/import.ts";
import { countWarehouseOrganizationsInDb } from "../lib/import/warehouse/dbPersistence.ts";

if (!isDatabaseConfigured()) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

console.log("Importing organization warehouse to Neon...");
const result = await importOrganizationWarehouse();

const healthPlans = await countWarehouseOrganizationsInDb("health-plans");
const manufacturers = await countWarehouseOrganizationsInDb("manufacturers");

console.log("\nNeon row counts:");
console.log(`  health-plans: ${healthPlans}`);
console.log(`  manufacturers: ${manufacturers}`);
console.log(`  memory index total: ${result.totalIndexSize}`);
console.log("\nConnector outcomes:");
for (const outcome of result.connectorOutcomes) {
  console.log(`  ${outcome.id}: ${outcome.status}${outcome.error ? ` — ${outcome.error}` : ""}`);
}

if (healthPlans < 500 || manufacturers < 100) {
  console.error("\nImport finished but Neon counts look low. Check CMS/manufacturer source data.");
  process.exit(1);
}

console.log("\nDone. Redeploy or hit /api/diagnostics/runtime on production to verify hydration.");
