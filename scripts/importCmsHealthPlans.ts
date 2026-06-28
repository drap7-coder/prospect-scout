#!/usr/bin/env node
/**
 * Import bootstrap seed plus CMS public-source health plan catalog fixtures.
 * Usage: npm run import:health-plans:full
 */
import { importHealthPlanFullCatalog } from "../lib/import/healthPlans/cms/importCms.ts";

const stats = await importHealthPlanFullCatalog();
console.log(JSON.stringify(stats, null, 2));
