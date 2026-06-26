/**
 * Universal taxonomy checks — sector/industry/org-type inference and provider routing.
 *
 * Run with:  npm run test:taxonomy
 */
import assert from "node:assert/strict";
import {
  inferTaxonomyFromQuery,
  resolveProviders,
  resolveTaxonomyTarget,
  getOrganizationType,
} from "../lib/taxonomy/index.ts";
import {
  inferSearchStateFromQuery,
  resolveSearchState,
  searchStateToRawInput,
} from "../lib/search/searchState.ts";
import { parseIntent } from "../lib/search/intentParser.ts";
import { planSources } from "../lib/search/sourcePlanner.ts";
import { plannedPrimaryProviders } from "../lib/search/providerPlan.ts";
import { resolveOrganization } from "../lib/directories/search.ts";
import { runSearch } from "../lib/search/runSearch.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Universal taxonomy checks\n");

check("infers healthcare sector from health plan query", () => {
  const t = inferTaxonomyFromQuery("regional health plans in Pennsylvania");
  assert.equal(t.sectorId, "healthcare");
  assert.equal(t.taxonomyTarget, "health-plans");
});

check("infers manufacturing from food manufacturers query", () => {
  const t = inferTaxonomyFromQuery("food manufacturers in Ohio");
  assert.equal(t.sectorId, "manufacturing");
  assert.equal(t.taxonomyTarget, "manufacturers");
});

check("infers public sector from municipalities query", () => {
  const t = inferTaxonomyFromQuery("Municipalities in the Mid-Atlantic");
  assert.equal(t.sectorId, "public-sector");
  assert.equal(t.taxonomyTarget, "public-sector");
});

check("infers financial services from banks query", () => {
  const t = inferTaxonomyFromQuery("Banks in the Northeast");
  assert.equal(t.sectorId, "financial-services");
  assert.equal(t.taxonomyTarget, "employers");
  assert.equal(getOrganizationType(t.organizationTypeId!)?.label, "Bank");
});

check("infers education from universities query", () => {
  const t = inferTaxonomyFromQuery("Universities with workforce growth");
  assert.equal(t.sectorId, "education");
  assert.equal(t.taxonomyTarget, "employers");
});

check("search state inference maps Humana to healthcare payers", () => {
  const state = resolveSearchState({
    query: "Humana Medicare Advantage",
    sector: null,
    industry: null,
    organizationType: null,
    location: null,
    companySize: null,
    signals: [],
    sources: [],
    freshness: null,
    sellerContext: null,
  });
  assert.equal(state.sector, "healthcare");
  assert.equal(searchStateToRawInput(state).buyerPack, "health-plans");
});

check("health plans still resolve in master directory", () => {
  const record = resolveOrganization("Highmark", "health-plans");
  assert.ok(record);
  assert.equal(record!.name, "Highmark");
});

check("Pennsylvania health plans search still returns curated organizations", () => {
  const response = runSearch({
    query: "Pennsylvania health plans",
    sells: "",
    targets: "Pennsylvania health plans",
  });
  assert.ok(response.prospects.length >= 11);
  assert.ok(response.prospects.some((p) => p.name === "Highmark"));
});

check("manufacturers taxonomy target from PepsiCo query", () => {
  const input = searchStateToRawInput(
    resolveSearchState({
      query: "PepsiCo",
      sector: null,
      industry: null,
      organizationType: null,
      location: null,
      companySize: null,
      signals: [],
      sources: [],
      freshness: null,
      sellerContext: null,
    }),
  );
  const query = parseIntent({ ...input, sells: "", targets: input.query });
  assert.equal(query.profile.targetBuyer, "manufacturers");
});

check("public companies route to SEC via provider plan", () => {
  const query = parseIntent({
    sells: "",
    query: "PepsiCo",
    targets: "PepsiCo",
  });
  const plan = planSources(query);
  const primary = plannedPrimaryProviders(plan);
  assert.ok(primary.includes("sec"), "SEC should be planned for PepsiCo");
});

check("health plans route to CMS", () => {
  const query = parseIntent({
    sells: "",
    query: "Humana Medicare Advantage",
    targets: "Humana Medicare Advantage",
  });
  const plan = planSources(query);
  const primary = plannedPrimaryProviders(plan);
  assert.ok(primary.includes("cms"));
  assert.ok(primary.includes("sec"));
});

check("FDA routes for food manufacturing queries", () => {
  const providers = resolveProviders({
    taxonomyTarget: "manufacturers",
    queryText: "food manufacturers in Ohio with FDA recalls",
  });
  assert.ok(providers.includes("fda"));
});

check("FDA routes for life sciences queries", () => {
  const providers = resolveProviders({
    taxonomyTarget: "manufacturers",
    queryText: "pharma manufacturer recall activity",
  });
  assert.ok(providers.includes("fda"));
});

check("RSS remains broad fallback across sectors", () => {
  for (const target of [
    "health-plans",
    "manufacturers",
    "health-systems",
    "employers",
    "public-sector",
  ] as const) {
    const providers = resolveProviders({
      taxonomyTarget: target,
      queryText: "regional organizations",
    });
    assert.ok(
      providers.includes("news-rss"),
      `RSS expected for ${target}, got ${providers.join(",")}`,
    );
  }
});

check("hospitals with merger activity maps to health systems", () => {
  const inferred = inferSearchStateFromQuery("Hospitals with merger activity");
  assert.equal(inferred.sector, "healthcare");
  assert.equal(
    resolveTaxonomyTarget({
      organizationTypeId: inferred.organizationType ?? "hospital",
    }),
    "health-systems",
  );
});

check("resolveTaxonomyTarget prefers organization type over sector", () => {
  assert.equal(
    resolveTaxonomyTarget({
      organizationTypeId: "bank",
      sectorId: "healthcare",
    }),
    "employers",
  );
});

console.log(`\n${passed} checks passed.`);
