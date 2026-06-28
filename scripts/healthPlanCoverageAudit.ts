#!/usr/bin/env node
/**
 * Health plan catalog coverage audit.
 * Usage: npm run audit:health-plans
 */
import {
  auditHealthPlanCatalogCoverage,
  formatHealthPlanCoverageAudit,
} from "../lib/import/healthPlans/cms/coverageAudit.ts";

const audit = auditHealthPlanCatalogCoverage();
console.log(formatHealthPlanCoverageAudit(audit));
console.log("\n--- JSON ---\n");
console.log(JSON.stringify(audit, null, 2));
