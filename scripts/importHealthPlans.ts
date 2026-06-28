#!/usr/bin/env node
/**
 * Import curated healthPlans.ts bootstrap seed into Neon + refresh memory index.
 * Usage: npm run import:health-plans
 */
import { importHealthPlanSeed } from "../lib/import/healthPlans/import.ts";

const stats = await importHealthPlanSeed();
console.log(JSON.stringify(stats, null, 2));
