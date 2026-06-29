#!/usr/bin/env node
/**
 * Backfill canonical website/domain for warehouse organizations.
 * Run: npm run backfill:domains
 * Options: DOMAIN_BACKFILL_LIMIT=100 FORCE=1
 */
import { getWarehouseOrganizations } from "../lib/import/warehouse/organizations.ts";
import { applyDomainIntelligenceToWarehouseOrgs } from "../lib/domainIntelligence/pipeline.ts";

const limit = process.env.DOMAIN_BACKFILL_LIMIT
  ? Number(process.env.DOMAIN_BACKFILL_LIMIT)
  : undefined;
const force = process.env.FORCE === "1";

const orgs = getWarehouseOrganizations();
const missingDomain = orgs.filter((o) => !o.domain?.trim());
const targetCount = limit ?? orgs.length;

console.log(
  `Backfilling domains for up to ${targetCount} organizations (${orgs.length} total, ${missingDomain.length} missing domain)...`,
);

if (orgs.length === 0) {
  console.warn("No warehouse organizations indexed — run import:warehouse first.");
  process.exit(0);
}

const { enriched, coverage } = await applyDomainIntelligenceToWarehouseOrgs(orgs, {
  force,
  limit,
});

console.log(`Domain backfill complete: ${enriched} organizations enriched.`);
console.log(
  `Coverage: ${coverage.withDomain}/${coverage.total} with domain (${coverage.pctDomain}%), ${coverage.withWebsite}/${coverage.total} with website (${coverage.pctWebsite}%)`,
);
for (const bucket of coverage.byBuyerPack) {
  console.log(
    `  ${bucket.label}: ${bucket.withDomain}/${bucket.total} domain (${bucket.pctDomain}%)`,
  );
}
