/**
 * Schema smoke checks — no live database required.
 * Run: npm run test:db
 */
import assert from "node:assert/strict";
import {
  discoveryRuns,
  externalIds,
  organizationSources,
  organizations,
} from "../lib/db/schema/index.ts";
import { isDatabaseConfigured } from "../lib/db/index.ts";
import {
  discoveryRunToRow,
  externalIdsToRows,
  organizationSourcesToRows,
  organizationToRow,
} from "../lib/db/mappers.ts";
import { finalizeOrganization } from "../lib/discovery/organization.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Database schema checks:\n");

check("schema exports four core tables", () => {
  assert.equal(organizations.id.name, "id");
  assert.equal(externalIds.id.name, "id");
  assert.equal(organizationSources.id.name, "id");
  assert.equal(discoveryRuns.id.name, "id");
});

check("organization mapper preserves canonical fields", () => {
  const org = finalizeOrganization({
    id: "sec-320193",
    canonicalName: "Apple Inc.",
    aliases: ["AAPL"],
    website: "https://apple.com",
    domain: "apple.com",
    organizationType: "employer",
    industries: ["technology"],
    sectorId: "technology",
    headquarters: "Cupertino, CA",
    locations: [],
    states: ["CA"],
    regions: ["west"],
    ownership: "public",
    employeeRange: null,
    revenueRange: null,
    description: null,
    sources: [
      {
        connector: "sec",
        sourceId: "320193",
        retrievedAt: new Date().toISOString(),
        evidence: ["SEC"],
      },
    ],
    buyerPack: "employers",
    canonicalOrganizationType: "employer",
  });

  const row = organizationToRow(org);
  assert.equal(row.id, "sec-320193");
  assert.equal(row.domain, "apple.com");
  assert.deepEqual(row.aliases, ["AAPL"]);

  const sources = organizationSourcesToRows(org);
  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.connector, "sec");

  const ids = externalIdsToRows(org);
  assert.ok(ids.some((r) => r.idType === "cik" && r.idValue === "0000320193"));
  assert.ok(ids.some((r) => r.idType === "domain" && r.idValue === "apple.com"));
});

check("discovery run mapper captures diagnostics", () => {
  const row = discoveryRunToRow({
    intent: {
      query: "pharma manufacturer",
      sectorId: "healthcare",
      industryId: "life-sciences",
      organizationTypeId: "pharma-manufacturer",
      state: null,
      city: null,
      region: "any",
      alternateSectorIds: [],
      alternateIndustryIds: [],
      healthPlanType: null,
      keywords: ["pharma"],
    },
    diagnostics: {
      connectorCandidates: { sec: 118, fda: 61 },
      connectorLabels: { sec: "SEC", fda: "FDA" },
      mergedUnique: 301,
      rankedCount: 280,
      displayedCount: 50,
    },
    totalBeforeDedupe: 400,
    latencyMs: 42.5,
    stagesRun: ["multi-connector-discovery"],
    expanded: false,
    fallbackReason: null,
  });
  assert.equal(row.queryText, "pharma manufacturer");
  assert.equal(row.mergedUnique, 301);
  assert.equal(row.connectorCandidates?.sec, 118);
});

check("isDatabaseConfigured reflects DATABASE_URL presence", () => {
  const prev = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  assert.equal(isDatabaseConfigured(), false);
  process.env.DATABASE_URL = "postgresql://example";
  assert.equal(isDatabaseConfigured(), true);
  if (prev === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = prev;
});

console.log(`\nAll ${passed} database schema checks passed.`);
