#!/usr/bin/env node
/**
 * Backfill company-level email pattern intelligence for warehouse organizations.
 * Run: npm run backfill:email-patterns
 * Options: EMAIL_BACKFILL_LIMIT=100 FORCE=1
 */
import { getWarehouseOrganizations } from "../lib/import/warehouse/organizations.ts";
import { applyEmailIntelligenceToWarehouseOrgs } from "../lib/emailIntelligence/pipeline.ts";

const limit = process.env.EMAIL_BACKFILL_LIMIT
  ? Number(process.env.EMAIL_BACKFILL_LIMIT)
  : undefined;
const force = process.env.FORCE === "1";

const orgs = getWarehouseOrganizations().filter((o) => o.website || o.domain);
const targetCount = limit ?? orgs.length;
console.log(
  `Backfilling email patterns for up to ${targetCount} organizations (${orgs.length} have website/domain)...`,
);

if (orgs.length === 0) {
  console.warn(
    "No warehouse organizations with website/domain — backfill skipped. Populate org websites first.",
  );
  process.exit(0);
}

const { processed } = await applyEmailIntelligenceToWarehouseOrgs(orgs, {
  force,
  skipNetwork: false,
  limit,
});

console.log(`Email pattern backfill complete: ${processed} organizations processed.`);
