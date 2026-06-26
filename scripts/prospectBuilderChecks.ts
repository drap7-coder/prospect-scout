/**
 * Prospect list builder — URL param round-trip and empty-field hygiene.
 *
 * Run with:  npm run test:builder
 */
import assert from "node:assert/strict";
import {
  builderToSearchState,
  EMPTY_BUILDER_STATE,
  type ProspectListBuilderState,
} from "../lib/search/prospectListBuilder.ts";
import {
  EXAMPLE_SEARCHES,
  parseSearchStateFromParams,
  resolveSearchState,
  searchStateToParams,
} from "../lib/search/searchState.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Prospect builder checks\n");

check("empty builder omits noisy URL params", () => {
  const state = builderToSearchState(EMPTY_BUILDER_STATE);
  const params = searchStateToParams(state);
  assert.equal(params.get("q"), "organizations");
  assert.equal(params.get("sort"), null);
  assert.equal(params.get("sector"), null);
  assert.equal(params.get("industry"), null);
  assert.equal(params.get("org"), null);
  assert.equal(params.get("location"), null);
  assert.equal(params.get("size"), null);
  assert.equal(params.get("signals"), null);
  assert.equal(params.get("sources"), null);
  assert.equal(params.get("ownership"), null);
  assert.equal(params.get("state"), null);
  assert.equal(params.get("metro"), null);
  assert.equal(params.get("opStates"), null);
});

check("full builder maps all fields to URL params", () => {
  const builder: ProspectListBuilderState = {
    ...EMPTY_BUILDER_STATE,
    industry: "food-beverage",
    sector: "manufacturing",
    organizationType: "manufacturer",
    ownership: "public",
    companySize: "Large",
    location: "midwest",
    state: "OH",
    metro: "Columbus",
    operatingStates: ["PA", "MI"],
    builderSignals: ["sec-filings", "hiring"],
    builderSources: ["SEC", "DIR"],
    sort: "freshness",
    query: "",
  };
  const state = builderToSearchState(builder);
  const params = searchStateToParams(state);
  assert.ok(params.get("q")?.trim());
  assert.equal(params.get("industry"), "food-beverage");
  assert.equal(params.get("sector"), null, "sector omitted when industry set");
  assert.equal(params.get("org"), "manufacturer");
  assert.equal(params.get("ownership"), "public");
  assert.equal(params.get("size"), "Large");
  assert.equal(params.get("location"), "midwest");
  assert.equal(params.get("state"), "OH");
  assert.equal(params.get("metro"), "Columbus");
  assert.equal(params.get("opStates"), "PA,MI");
  assert.equal(params.get("signals"), "sec-filing,hiring");
  assert.equal(params.get("sources"), "SEC,Directory");
  assert.equal(params.get("sort"), "freshness");
});

check("default sort score is omitted from URL", () => {
  const builder: ProspectListBuilderState = {
    ...EMPTY_BUILDER_STATE,
    industry: "software",
    sector: "technology",
    sort: "score",
  };
  const params = searchStateToParams(builderToSearchState(builder));
  assert.equal(params.get("sort"), null);
});

check("URL round-trip preserves builder filters for results rail", () => {
  const builder: ProspectListBuilderState = {
    ...EMPTY_BUILDER_STATE,
    ownership: "nonprofit",
    state: "PA",
    builderSources: ["CMS"],
    builderSignals: ["regulatory"],
    sort: "evidence",
  };
  const serialized = searchStateToParams(builderToSearchState(builder)).toString();
  const parsed = resolveSearchState(
    parseSearchStateFromParams(new URLSearchParams(serialized)),
  );
  assert.equal(parsed.ownership, "nonprofit");
  assert.equal(parsed.state, "PA");
  assert.ok(parsed.sources.includes("CMS"));
  assert.ok(parsed.signals.includes("regulatory-pressure"));
  assert.equal(parsed.sort, "evidence");
});

check("example searches produce valid results URLs", () => {
  for (const example of EXAMPLE_SEARCHES) {
    const url = `/results?q=${encodeURIComponent(example)}`;
    assert.match(url, /^\/results\?q=/);
    const parsed = parseSearchStateFromParams(
      new URLSearchParams(url.split("?")[1]),
    );
    assert.equal(parsed.query, example);
  }
});

check("healthcare sources are builder-only, not in homepage examples", () => {
  const joined = EXAMPLE_SEARCHES.join(" ").toLowerCase();
  assert.ok(!joined.includes("cms"));
  assert.ok(!joined.includes("fda"));
  assert.ok(!joined.includes("medicare"));
});

console.log(`\n${passed} checks passed.`);
