#!/usr/bin/env node
/**
 * Import the national health plan connector (legacy script name).
 * Prefer: npm run import:warehouse
 *
 * Usage: npm run import:health-plans:national
 *
 * Run npm run fetch:health-plans first to refresh CMS snapshots (or set USE_CMS_FIXTURES=1).
 */
import { importNationalHealthPlanCatalog } from "../lib/import/healthPlans/cms/importCms.ts";
import { cmsImportMode } from "../lib/import/healthPlans/cms/resolvePaths.ts";
import { formatRegressionFindings } from "../lib/import/healthPlans/importRegression.ts";

console.log(`CMS import mode: ${cmsImportMode()}`);
const stats = await importNationalHealthPlanCatalog();

console.log("\nImport summary:");
console.log(`  Canonical orgs indexed: ${stats.indexSizeAfterImport}`);
console.log(`  QHP issuers parsed: ${stats.qhpIssuersParsed}`);
console.log(`  QHP net-new from Service Area PUF: ${stats.qhpNetNewFromServiceArea}`);
console.log(`  Medicaid MCO orgs (programs): ${stats.medicaidRowsParsed}`);
console.log(`  Medicaid enrollment plans: ${stats.medicaidEnrollmentOrganizations}`);
console.log(`  Medicaid net-new from enrollment: ${stats.medicaidNetNewFromEnrollment}`);
console.log(`  Identity enrichments applied: ${stats.identityEnrichmentApplied}`);
console.log(`  Possible duplicates (needs review): ${stats.possibleDuplicatesNeedsReview}`);
console.log(`  Duplicate org IDs: ${stats.indexSizeAfterImport > 0 ? "check manifest" : 0}`);

if (stats.regressionFindings.length > 0) {
  console.log("\nRegression:");
  console.log(formatRegressionFindings(stats.regressionFindings));
}

console.log("\nFull stats:");
console.log(JSON.stringify(stats, null, 2));
