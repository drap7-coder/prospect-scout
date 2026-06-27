/**
 * ACA Marketplace seed foundation checks.
 * Run: npm run test:aca
 */
import assert from "node:assert/strict";
import {
  normalizeIssuerId,
  acaMarketplaceCatalogRecords,
  getAcaMarketplaceConnectorStatus,
} from "../lib/discovery/connectors/aca/index.ts";
import { inferHealthPlanTypeFromQuery } from "../lib/discovery/healthPlanType.ts";
import { parseSearchIntent } from "../lib/discovery/intent.ts";
import { getCatalogOrganizations } from "../lib/discovery/catalog/catalogIndex.ts";
import { organizationToRawProspect } from "../lib/discovery/toRawProspect.ts";
import { runSearch } from "../lib/search/runSearch.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

// --- Issuer id normalization ---------------------------------------------

check("normalizeIssuerId pads to 5-digit HIOS form", () => {
  assert.equal(normalizeIssuerId("123"), "00123");
  assert.equal(normalizeIssuerId("33653"), "33653");
  assert.equal(normalizeIssuerId("H1234"), "01234");
  assert.equal(normalizeIssuerId("1234567"), "34567");
});

// --- Query mapping --------------------------------------------------------

const ACA_SYNONYMS = [
  "ACA plans",
  "exchange plans in Maine",
  "marketplace plans",
  "HealthCare.gov plans",
  "QHP issuers",
];

for (const q of ACA_SYNONYMS) {
  check(`"${q}" infers aca_marketplace subtype`, () => {
    assert.equal(inferHealthPlanTypeFromQuery(q), "aca_marketplace");
  });
}

check('"ACA plans" maps to health-plan org type + aca_marketplace', () => {
  const intent = parseSearchIntent("ACA plans");
  assert.equal(intent.organizationTypeId, "health-plan");
  assert.equal(intent.healthPlanType, "aca_marketplace");
});

check('"exchange plans in Maine" maps to healthPlanType = aca_marketplace, state ME', () => {
  const intent = parseSearchIntent("exchange plans in Maine");
  assert.equal(intent.healthPlanType, "aca_marketplace");
  assert.equal(intent.organizationTypeId, "health-plan");
  assert.equal(intent.state, "ME");
});

check('"Medicare Advantage plans" does not infer aca_marketplace', () => {
  const intent = parseSearchIntent("Medicare Advantage plans");
  assert.equal(intent.healthPlanType, "medicare_advantage");
  assert.notEqual(intent.healthPlanType, "aca_marketplace");
});

check('"health plans in Maine" carries no subtype filter', () => {
  const intent = parseSearchIntent("health plans in Maine");
  assert.equal(intent.organizationTypeId, "health-plan");
  assert.equal(intent.healthPlanType, null);
});

// --- Seed connector -------------------------------------------------------

check("seed records are normalized as ACA Marketplace health plans", () => {
  const records = acaMarketplaceCatalogRecords();
  assert.ok(records.length >= 5, "expected several curated issuers");
  for (const r of records) {
    assert.equal(r.organizationType, "health-plan");
    assert.equal(r.healthPlanType, "aca_marketplace");
    assert.equal(r.metadata.sourceName, "CMS Marketplace / QHP seed");
  }
  const cho = records.find((r) => /community health options/i.test(r.name));
  assert.ok(cho, "Community Health Options should be seeded");
  assert.ok(cho!.states.includes("ME"), "Community Health Options should serve ME");
});

check("connector status is transparent: seeded only, partial, API off", () => {
  const status = getAcaMarketplaceConnectorStatus();
  assert.equal(status.status, "Seeded only");
  assert.equal(status.completeness, "partial");
  assert.equal(status.api, "not enabled");
  assert.ok(status.issuerCount >= 5);
});

check("ACA seed organizations land in the catalog with subtype", () => {
  const cho = getCatalogOrganizations().find((o) =>
    /community health options/i.test(o.canonicalName),
  );
  assert.ok(cho, "Community Health Options should be indexed");
  assert.equal(cho!.canonicalOrganizationType, "health-plan");
  assert.equal(cho!.healthPlanType, "aca_marketplace");
});

// --- Pipeline survival ----------------------------------------------------

check("healthPlanType survives Organization -> RawProspect", () => {
  const cho = getCatalogOrganizations().find((o) =>
    /community health options/i.test(o.canonicalName),
  );
  assert.ok(cho);
  const raw = organizationToRawProspect(cho!);
  assert.equal(raw.healthPlanType, "aca_marketplace");
});

// --- End-to-end search ----------------------------------------------------

function searchProspects(query: string) {
  return runSearch({ query, sells: "", targets: query }).prospects;
}

check('"ACA plans in Maine" returns Community Health Options', () => {
  const prospects = searchProspects("ACA plans in Maine");
  const cho = prospects.find((p) => /community health options/i.test(p.name));
  assert.ok(cho, "expected Community Health Options for ACA plans in Maine");
  // healthPlanType survives Organization -> RawProspect -> Prospect.
  assert.equal(cho!.healthPlanType, "aca_marketplace");
});

check('"health plans in Maine" can include ACA marketplace plans', () => {
  const prospects = searchProspects("health plans in Maine");
  assert.ok(
    prospects.some((p) => p.healthPlanType === "aca_marketplace"),
    "general health plan search should still surface ACA issuers",
  );
});

check('"Medicare Advantage plans" excludes ACA marketplace issuers', () => {
  const prospects = searchProspects("Medicare Advantage plans");
  assert.ok(
    !prospects.some((p) => p.healthPlanType === "aca_marketplace"),
    "Medicare Advantage search must not pull in ACA marketplace plans",
  );
});

console.log(`\n${passed} ACA Marketplace checks passed.`);
