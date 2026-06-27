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
  formatStructuredSelectionDisplay,
  HOMEPAGE_INDUSTRY_SELECTORS,
  industrySelectorToBuilderState,
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
  assert.equal(starterState("healthcare").sector, "healthcare");
  assert.equal(starterState("healthcare").organizationType, null);
  assert.equal(starterState("healthcare").industry, null);

  assert.equal(starterState("manufacturers").organizationType, "manufacturer");
  assert.equal(starterState("financial-services").sector, "financial-services");
  assert.equal(starterState("financial-services").industry, null);
  assert.equal(starterState("universities").organizationType, "university");
});

check("homepage industry starter displays are clean and preserve state", () => {
  const expected = new Map<
    string,
    {
      primary: string;
      secondary: string | null;
      sector: string | null;
      industry: string | null;
      organizationType: string | null;
    }
  >([
    [
      "health-plans",
      {
        primary: "Health Plans",
        secondary: "Healthcare · Payers",
        sector: "healthcare",
        industry: "payers",
        organizationType: "health-plan",
      },
    ],
    [
      "hospitals",
      {
        primary: "Hospitals & Health Systems",
        secondary: "Healthcare · Providers",
        sector: "healthcare",
        industry: "providers",
        organizationType: "hospital-health-system",
      },
    ],
    [
      "pbm-pharmacy",
      {
        primary: "PBMs / Pharmacy",
        secondary: "Pharmacy · Benefit Management",
        sector: "healthcare",
        industry: "payers",
        organizationType: "pbm",
      },
    ],
    [
      "manufacturers",
      {
        primary: "Manufacturers",
        secondary: "Manufacturing · Industrial Products",
        sector: "manufacturing",
        industry: "industrial-products",
        organizationType: "manufacturer",
      },
    ],
    [
      "employers",
      {
        primary: "Employers",
        secondary: null,
        sector: null,
        industry: null,
        organizationType: "employer",
      },
    ],
    [
      "nonprofits",
      {
        primary: "Nonprofits",
        secondary: null,
        sector: "nonprofit",
        industry: "nonprofit",
        organizationType: "nonprofit",
      },
    ],
    [
      "financial-services",
      {
        primary: "Financial Services",
        secondary: null,
        sector: "financial-services",
        industry: null,
        organizationType: null,
      },
    ],
    [
      "restaurants-hospitality",
      {
        primary: "Restaurants / Hospitality",
        secondary: "Hospitality & Leisure",
        sector: "hospitality-leisure",
        industry: "hospitality",
        organizationType: null,
      },
    ],
  ]);

  for (const selector of HOMEPAGE_INDUSTRY_SELECTORS) {
    const target = expected.get(selector.id);
    assert.ok(target, `missing expected display for ${selector.id}`);
    const builder = industrySelectorToBuilderState(selector);
    const display = formatStructuredSelectionDisplay(builder);
    assert.equal(display.primaryLabel, target.primary, selector.id);
    assert.equal(display.secondaryLabel, target.secondary, selector.id);
    assert.equal(builder.sector, target.sector, `${selector.id} sector changed`);
    assert.equal(builder.industry, target.industry, `${selector.id} industry changed`);
    assert.equal(
      builder.organizationType,
      target.organizationType,
      `${selector.id} org type changed`,
    );
  }
});

check("structured display collapses duplicate taxonomy labels", () => {
  const healthPlan = formatStructuredSelectionDisplay({
    sector: "healthcare",
    industry: "payers",
    organizationType: "health-plan",
  });
  assert.equal(healthPlan.primaryLabel, "Health Plans");
  assert.equal(healthPlan.secondaryLabel, "Healthcare · Payers");
  assert.ok(!healthPlan.secondaryLabel.includes("Health Plan"));

  const nonprofit = formatStructuredSelectionDisplay({
    sector: "nonprofit",
    industry: "nonprofit",
    organizationType: "nonprofit",
    ownership: "nonprofit",
  });
  assert.equal(nonprofit.primaryLabel, "Nonprofits");
  assert.equal(nonprofit.secondaryLabel, null);

  const generic = formatStructuredSelectionDisplay({
    sector: "manufacturing",
    industry: "packaging",
    organizationType: null,
  });
  assert.equal(generic.primaryLabel, "Packaging");
  assert.equal(generic.secondaryLabel, "Manufacturing");
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
