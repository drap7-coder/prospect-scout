#!/usr/bin/env node
/**
 * Full organization ingestion pipeline audit.
 * Usage: npm run audit:pipeline
 */
import {
  formatPipelineAudit,
  runPipelineAudit,
  runPipelineAuditWithFullHealthPlanImport,
} from "../lib/import/pipelineAudit.ts";

const defaultReport = runPipelineAudit();
console.log(formatPipelineAudit(defaultReport));
console.log("\n--- DEFAULT RUNTIME JSON ---\n");
console.log(JSON.stringify(defaultReport, null, 2));

console.log("\n\n========== AFTER FULL HEALTH PLAN IMPORT (simulated) ==========\n");
const fullHpReport = await runPipelineAuditWithFullHealthPlanImport();
console.log(formatPipelineAudit(fullHpReport));
console.log("\n--- FULL HP IMPORT JSON ---\n");
console.log(JSON.stringify(fullHpReport, null, 2));
