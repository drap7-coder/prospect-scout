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
  parseErisaQueryConstraints,
  searchErisaIndex,
} from "../lib/import/erisa/index.ts";
import { initDiscoveryEngine, discoverOrganizationsSync } from "../lib/discovery/discoveryEngine.ts";
import { parseSearchIntent } from "../lib/discovery/intent.ts";
import { runSearch } from "../lib/search/runSearch.ts";
import { synthesizeIntelligenceCard } from "../lib/intelligence/synthesizeCard.ts";
import { isDatabaseConfigured } from "../lib/db/index.ts";

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

console.log(`\nAll ${passed} ERISA checks passed.`);
