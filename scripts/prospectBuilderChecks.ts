/**
 * Prospect list builder — URL param round-trip and empty-field hygiene.
 *
 * Run with:  npm run test:builder
 */
import assert from "node:assert/strict";
import {
  BUILDER_PRIMARY_CATEGORIES,
  BUILDER_SIGNAL_OPTIONS,
  BUILDER_SOURCE_OPTIONS,
  builderToSearchState,
  buildNaturalLanguageSummary,
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

function starterState(cardId: string) {
  const starter = BUILDER_PRIMARY_CATEGORIES.find((c) => c.cardId === cardId);
  assert.ok(starter, `missing starter ${cardId}`);
  return builderToSearchState({
    ...EMPTY_BUILDER_STATE,
    sector: starter.sectorId,
    industry: starter.industry ?? null,
    organizationType: starter.organizationType ?? null,
    ownership: starter.ownership ?? null,
    builderSources: [...(starter.builderSources ?? [])],
    builderSignals: [...(starter.builderSignals ?? [])],
  });
}

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
    builderSources: ["SEC", "WEB"],
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
  assert.equal(params.get("sources"), "SEC,Public Web");
  assert.equal(params.get("sort"), "freshness");
});

check("starter chips map to expected search state", () => {
  assert.equal(starterState("health-plans").organizationType, "health-plan");
  assert.equal(starterState("health-plans").industry, "payers");

  assert.equal(
    starterState("hospitals").organizationType,
    "hospital-health-system",
  );
  assert.equal(starterState("hospitals").industry, "providers");

  assert.equal(starterState("manufacturers").organizationType, "manufacturer");
  assert.equal(starterState("banks").industry, "banks");
  assert.equal(starterState("universities").organizationType, "university");
});

check("public companies starter carries public ownership and SEC intent", () => {
  const state = starterState("public-companies");
  assert.equal(state.ownership, "public");
  assert.ok(state.sources.includes("SEC"));
  assert.ok(state.signals.includes("sec-filing"));
});

check("nonprofits starter maps to canonical nonprofit", () => {
  const state = starterState("nonprofits");
  assert.equal(state.organizationType, "nonprofit");
  assert.equal(state.sector, "nonprofit");
  assert.equal(state.ownership, "nonprofit");
});

check("source chips map only to real source filters", () => {
  const sourceIds = BUILDER_SOURCE_OPTIONS.map((o) => o.id);
  assert.deepEqual(sourceIds, ["SEC", "CMS", "FDA", "WEB", "RSS"]);
  assert.ok(!sourceIds.includes("IRS"));
  assert.ok(!sourceIds.includes("SAM"));

  for (const source of BUILDER_SOURCE_OPTIONS) {
    const state = builderToSearchState({
      ...EMPTY_BUILDER_STATE,
      builderSources: [source.id],
    });
    assert.ok(
      state.sources.includes(source.filterId),
      `${source.id} should map to ${source.filterId}`,
    );
  }
});

check("misleading signal chips are not exposed", () => {
  const signalIds = BUILDER_SIGNAL_OPTIONS.map((o) => o.id);
  assert.ok(!signalIds.includes("website-changes"));
  assert.ok(!signalIds.includes("government-contracts"));
  assert.ok(!signalIds.includes("new-products"));
});

check("signal chips map to supported filters or source evidence", () => {
  for (const signal of BUILDER_SIGNAL_OPTIONS) {
    const state = builderToSearchState({
      ...EMPTY_BUILDER_STATE,
      builderSignals: [signal.id],
    });
    assert.ok(
      state.signals.length > 0 || state.sources.length > 0,
      `${signal.id} should affect signals or sources`,
    );
  }
});

check("location builder state maps to state, metro, and operating states", () => {
  const state = builderToSearchState({
    ...EMPTY_BUILDER_STATE,
    state: "TX",
    metro: "Dallas",
    operatingStates: ["PA", "OH"],
  });
  assert.equal(state.state, "TX");
  assert.equal(state.metro, "Dallas");
  assert.deepEqual(state.operatingStates, ["PA", "OH"]);
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

check("home examples are benchmark-style discovery queries", () => {
  const joined = EXAMPLE_SEARCHES.join(" ").toLowerCase();
  for (const expected of [
    "health plans in texas",
    "hospitals near philadelphia",
    "manufacturers in ohio",
    "universities in california",
    "nonprofits in pennsylvania",
    "public companies with recent sec filings",
    "banks in texas",
  ]) {
    assert.ok(joined.includes(expected), `missing example: ${expected}`);
  }
});

check("natural language summary reads as a sentence", () => {
  const builder: ProspectListBuilderState = {
    ...EMPTY_BUILDER_STATE,
    sector: "manufacturing",
    state: "OH",
    builderSignals: ["hiring"],
  };
  const summary = buildNaturalLanguageSummary(builder);
  assert.match(summary, /^We'll search for/i);
  assert.match(summary, /Ohio/i);
  assert.match(summary, /hiring/i);
  assert.ok(summary.endsWith("."));
});

console.log(`\n${passed} checks passed.`);
