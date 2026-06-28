#!/usr/bin/env node
/**
 * Fetch national CMS health plan datasets and write production CSV snapshots.
 * Usage: npm run fetch:health-plans
 */
import { fetchNationalCmsHealthPlanData } from "../lib/import/healthPlans/cms/sources/fetch.ts";

const stats = await fetchNationalCmsHealthPlanData();
console.log(JSON.stringify(stats, null, 2));
