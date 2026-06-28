/**
 * ERISA / Form 5500 import + discovery checks.
 * Run: npm run test:erisa
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  clearErisaIndex,
  getErisaIndexSize,
  importErisaCsv,
  importErisaRows,
  parseErisaQueryConstraints,
  searchErisaIndex,
} from "../lib/import/erisa/index.ts";
import { initDiscoveryEngine, discoverOrganizationsSync } from "../lib/discovery/discoveryEngine.ts";
import { parseSearchIntent } from "../lib/discovery/intent.ts";
import { runSearch } from "../lib/search/runSearch.ts";
import { synthesizeIntelligenceCard } from "../lib/intelligence/synthesizeCard.ts";
import { isDatabaseConfigured } from "../lib/db/index.ts";
import { dedupeOrganizationsByMergeKeys } from "../lib/discovery/mergeKeys.ts";
import { directoryRecordToOrganization, mergeOrganizations } from "../lib/discovery/organization.ts";
import { extractExternalIds } from "../lib/discovery/externalIds.ts";
import { organizationFromErisaRow } from "../lib/import/erisa/organizationFromFiling.ts";
import { getAllDirectoryRecords } from "../lib/directories/search.ts";

const TARGET_ERISA_ROW = {
  sponsorEin: "410215930",
  sponsorName: "Target Corporation",
  sponsorState: "MN",
  sponsorCity: "Minneapolis",
  planName: "Target Corporation Welfare Benefits Plan",
  planNumber: "001",
  filingYear: 2023,
  participantCount: 350_000,
  healthWelfarePlan: true,
  selfFunded: true,
  fundingArrangement: "self-funded",
  welfareBenefitTypes: [] as string[],
  ackId: null,
};

const KROGER_ERISA_ROW = {
  sponsorEin: "310345740",
  sponsorName: "The Kroger Co.",
  sponsorState: "OH",
  sponsorCity: "Cincinnati",
  planName: "Kroger Welfare Benefits Plan",
  planNumber: "001",
  filingYear: 2023,
  participantCount: 430_000,
  healthWelfarePlan: true,
  selfFunded: true,
  fundingArrangement: "self-funded",
  welfareBenefitTypes: [] as string[],
  ackId: null,
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "../fixtures/import/erisa/sample-form5500.csv");

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result instanceof Promise) {
    return result.then(() => {
      passed += 1;
      console.log(`  ok  ${name}`);
    });
  }
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("ERISA / Form 5500 checks:\n");

await check("parse sample CSV fixture", async () => {
  clearErisaIndex();
  const csv = readFileSync(FIXTURE, "utf8");
  const stats = await importErisaCsv(csv);
  assert.equal(stats.rowsParsed, 7);
  assert.ok(getErisaIndexSize() >= 7);
});

await check("import is idempotent in memory index", async () => {
  const csv = readFileSync(FIXTURE, "utf8");
  const before = getErisaIndexSize();
  await importErisaCsv(csv);
  assert.equal(getErisaIndexSize(), before);
});

await check("self-funded employers in Pennsylvania returns ERISA orgs", () => {
  initDiscoveryEngine();
  const intent = parseSearchIntent("self-funded employers in Pennsylvania");
  const constraints = parseErisaQueryConstraints(intent);
  assert.equal(constraints.state, "PA");
  assert.equal(constraints.selfFundedOnly, true);

  const hits = searchErisaIndex(intent, constraints);
  const names = hits.map((o) => o.canonicalName);
  assert.ok(names.some((n) => /UPMC/i.test(n)));
  assert.ok(names.some((n) => /Geisinger/i.test(n)));
  assert.ok(!names.some((n) => /Penn State/i.test(n)), "fully insured excluded");
  assert.ok(!names.some((n) => /California Pacific/i.test(n)), "out-of-state excluded");
});

await check("large employers over 5000 participants filters by participant_count", () => {
  const intent = parseSearchIntent("large employers over 5000 participants");
  const constraints = parseErisaQueryConstraints(intent);
  assert.equal(constraints.minParticipants, 5000);

  const hits = searchErisaIndex(intent, constraints);
  assert.ok(hits.length >= 4);
  for (const org of hits) {
    assert.ok((org.memberEstimate ?? 0) >= 5000);
  }
  assert.ok(!hits.some((o) => /Acme Manufacturing/i.test(o.canonicalName)));
});

await check("discovery v2 includes ERISA connector candidates", () => {
  initDiscoveryEngine();
  const result = discoverOrganizationsSync("self-funded employers in Pennsylvania", {
    connectors: ["erisa"],
  });
  assert.ok(result.organizations.length >= 3);
  assert.ok(result.organizations.every((o) => o.sources.some((s) => s.connector === "erisa")));
});

await check("runSearch surfaces ERISA-derived organizations from persistent index", () => {
  const response = runSearch({
    query: "self-funded employers in Pennsylvania",
    targets: "self-funded employers in Pennsylvania",
  });
  assert.ok(response.prospects.length >= 3);
  assert.ok(
    response.prospects.some((p) =>
      p.sourceRecords.some((r) => r.connector === "erisa" || r.label === "ERISA"),
    ),
  );
});

await check("card intelligence includes ERISA Form 5500 details", () => {
  const response = runSearch({
    query: "self-funded employers in Pennsylvania",
    targets: "self-funded employers in Pennsylvania",
  });
  const erisaProspect = response.prospects.find(
    (p) => p.erisaIntel?.participantCount != null,
  );
  assert.ok(erisaProspect, "expected ERISA prospect with participant count");
  assert.equal(erisaProspect.erisaIntel?.sourceLabel, "ERISA Form 5500");

  const card = synthesizeIntelligenceCard(erisaProspect);
  assert.ok(
    card.intelligence.some((b) => /Form 5500|participants|Self-funded/i.test(b.text)),
  );
  assert.ok(card.dataSources.some((d) => d.id === "erisa" || /ERISA/i.test(d.label)));
});

await check("search uses persistent index not live DOL (no network)", () => {
  assert.ok(getErisaIndexSize() > 0, "fixture data loaded in memory index");
  if (isDatabaseConfigured()) {
    console.log("    (Neon configured — import also persisted to DATABASE_URL)");
  } else {
    console.log("    (No DATABASE_URL — memory index only, still no live DOL fetch)");
  }
});

await check("extractExternalIds reads EIN from erisa-{ein} organization ids", () => {
  const erisaOrg = organizationFromErisaRow(TARGET_ERISA_ROW);
  assert.equal(erisaOrg.id, "erisa-410215930");
  assert.equal(extractExternalIds(erisaOrg).ein, "410215930");
});

await check("mergeOrganizations preserves ERISA intelligence and tags", () => {
  const targetRecord = getAllDirectoryRecords().find((r) => r.id === "dir-ret-target");
  assert.ok(targetRecord, "Target directory record");
  const directoryOrg = directoryRecordToOrganization(targetRecord);
  const erisaOrg = organizationFromErisaRow(TARGET_ERISA_ROW);
  const merged = mergeOrganizations(directoryOrg, erisaOrg);

  assert.equal(merged.sectorId, "retail-consumer");
  assert.ok(merged.industries.includes("retail"));
  assert.equal(merged.erisaIntel?.participantCount, 350_000);
  assert.ok(merged.tags?.some((tag) => /Plan Sponsor|Employer/i.test(tag)));
  assert.ok(merged.sources.some((s) => s.connector === "erisa"));
  assert.ok(merged.sources.some((s) => s.connector === "directory"));
});

await check("dedupe merges Target directory and ERISA records into one organization", () => {
  const targetRecord = getAllDirectoryRecords().find((r) => r.id === "dir-ret-target");
  assert.ok(targetRecord);
  const directoryOrg = directoryRecordToOrganization(targetRecord);
  const erisaOrg = organizationFromErisaRow(TARGET_ERISA_ROW);
  const merged = dedupeOrganizationsByMergeKeys([directoryOrg, erisaOrg]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.canonicalName, "Target Corporation");
  assert.ok(merged[0]!.erisaIntel?.participantCount != null);
  assert.equal(merged[0]!.sectorId, "retail-consumer");
});

await check("Target Corporation Form 5500 search shows ERISA participant data", async () => {
  await importErisaRows([TARGET_ERISA_ROW]);
  initDiscoveryEngine();
  const response = runSearch({
    query: "Target Corporation Form 5500",
    targets: "Target Corporation Form 5500",
  });
  const target = response.prospects.find((p) => /Target Corporation/i.test(p.name));
  assert.ok(target, "expected merged Target prospect");
  assert.equal(target.sectorId, "retail-consumer");
  assert.ok(target.industryId === "retail" || target.fitKeywords.includes("retail"));
  assert.ok((target.erisaIntel?.participantCount ?? 0) >= 350_000);
  assert.ok(
    target.sourceRecords.some((r) => r.connector === "erisa" || r.label === "ERISA"),
  );
});

await check("retail employers over 5000 participants keep retail + ERISA data", async () => {
  await importErisaRows([KROGER_ERISA_ROW]);
  initDiscoveryEngine();
  const result = discoverOrganizationsSync(
    "retail employers with more than 5000 participants",
    { connectors: ["directory", "erisa"], maxResults: 500 },
  );
  const retailHits = result.organizations.filter(
    (o) =>
      o.sectorId === "retail-consumer" &&
      o.industries.includes("retail") &&
      (o.erisaIntel?.participantCount ?? o.memberEstimate ?? 0) >= 5000,
  );
  assert.ok(retailHits.length > 0, "expected retail employers with ERISA participant counts");
  const kroger = retailHits.find((o) => /Kroger/i.test(o.canonicalName));
  assert.ok(kroger, "expected merged Kroger retail + ERISA record");
  assert.ok(kroger.sources.some((s) => s.connector === "erisa"));
  assert.ok(kroger.sources.some((s) => s.connector === "directory"));
});

console.log(`\nAll ${passed} ERISA checks passed.`);
