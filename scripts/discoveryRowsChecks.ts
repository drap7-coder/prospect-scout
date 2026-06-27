/**
 * Discovery view carousel grouping checks.
 * Run: npm run test:discovery-rows
 */
import assert from "node:assert/strict";
import {
  buildDiscoveryRows,
  DEFAULT_RESULT_VIEW,
  MAX_ROW_CARDS,
  MIN_ROW_PROSPECTS,
  normalizeResultView,
  RESULT_VIEWS,
  shouldRefetchOnViewChange,
} from "../lib/discovery/discoveryRows.ts";
import {
  parseSearchStateFromParams,
  searchStateToParams,
} from "../lib/search/searchState.ts";
import type { Prospect } from "../lib/search/types.ts";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

let seq = 0;
function prospect(overrides: Partial<Prospect> = {}): Prospect {
  seq += 1;
  return {
    id: `p-${seq}`,
    name: `Org ${seq}`,
    location: "Columbus, OH",
    region: "midwest",
    buyerType: "Organization",
    buyerPack: "employers",
    score: 100 - seq,
    scoreBreakdown: { total: 100 - seq, factors: [] },
    whyItMatters: [],
    signals: [],
    whyNow: "",
    sourceTrail: [],
    outreachAngle: "",
    contactRoles: [],
    matchReasons: [],
    sourceRecords: [],
    ...overrides,
  };
}

function signal(
  overrides: Partial<Prospect["signals"][number]> &
    Pick<Prospect["signals"][number], "id">,
): Prospect["signals"][number] {
  return {
    label: "Signal",
    type: "other",
    strength: "moderate",
    strengthScore: 0.5,
    source: "Directory",
    evidenceText: "",
    whyNow: "",
    suggestedAction: "",
    freshnessDays: 10,
    urgency: 0.5,
    ...overrides,
  };
}

console.log("Discovery rows checks:\n");

check("Discovery is the default view", () => {
  assert.equal(DEFAULT_RESULT_VIEW, "discovery");
});

check("view toggle normalizes Discovery / List", () => {
  assert.deepEqual([...RESULT_VIEWS], ["discovery", "list"]);
  assert.equal(normalizeResultView("list"), "list");
  assert.equal(normalizeResultView("table"), "discovery");
  assert.equal(normalizeResultView("discovery"), "discovery");
  assert.equal(normalizeResultView("bogus"), "discovery");
  assert.equal(normalizeResultView(null), "discovery");
});

check("carousel rows render from existing prospects", () => {
  const prospects = Array.from({ length: 6 }, () => prospect());
  const rows = buildDiscoveryRows(prospects);
  const topMatches = rows.find((r) => r.id === "top-matches");
  assert.ok(topMatches, "Top Matches row should be present");
  assert.equal(topMatches!.prospects.length, 6);
  // Ranking order preserved (input order).
  assert.deepEqual(
    topMatches!.prospects.map((p) => p.id),
    prospects.map((p) => p.id),
  );
});

check("empty / under-threshold rows are hidden", () => {
  // Only 2 nonprofits — below MIN_ROW_PROSPECTS (3) — row must not appear.
  const prospects = [
    prospect({ canonicalOrganizationTypeId: "nonprofit" }),
    prospect({ canonicalOrganizationTypeId: "nonprofit" }),
    prospect(),
    prospect(),
  ];
  const rows = buildDiscoveryRows(prospects);
  assert.equal(MIN_ROW_PROSPECTS, 3);
  assert.ok(!rows.some((r) => r.id === "nonprofits"));
});

check("category rows surface qualifying prospects", () => {
  const prospects = [
    prospect({ canonicalOrganizationTypeId: "nonprofit" }),
    prospect({ sectorId: "nonprofit" }),
    prospect({ industryId: "nonprofit" }),
    prospect({ publicCompany: true }),
    prospect({ publicCompany: true }),
    prospect({ signals: [signal({ id: "a", source: "SEC" })] }),
  ];
  const rows = buildDiscoveryRows(prospects);
  const nonprofits = rows.find((r) => r.id === "nonprofits");
  const publicCos = rows.find((r) => r.id === "public-companies");
  assert.equal(nonprofits?.prospects.length, 3);
  assert.equal(publicCos?.prospects.length, 3);
});

check("filtering updates discovery rows (rows derive from input list)", () => {
  const all = [
    ...Array.from({ length: 4 }, () =>
      prospect({ canonicalOrganizationTypeId: "manufacturer" }),
    ),
    ...Array.from({ length: 4 }, () =>
      prospect({ canonicalOrganizationTypeId: "nonprofit" }),
    ),
  ];
  const fullRows = buildDiscoveryRows(all);
  assert.ok(fullRows.some((r) => r.id === "manufacturers"));
  assert.ok(fullRows.some((r) => r.id === "nonprofits"));

  // Simulate a filter that keeps only nonprofits.
  const filtered = all.filter(
    (p) => p.canonicalOrganizationTypeId === "nonprofit",
  );
  const filteredRows = buildDiscoveryRows(filtered);
  assert.ok(!filteredRows.some((r) => r.id === "manufacturers"));
  assert.ok(filteredRows.some((r) => r.id === "nonprofits"));
});

check("search is not refetched when switching view", () => {
  // View is not part of search state or URL params, so it cannot change the
  // search fetch fingerprint.
  const state = parseSearchStateFromParams(new URLSearchParams("q=hospitals"));
  const params = searchStateToParams(state);
  assert.ok(!params.has("view"));
  assert.equal(shouldRefetchOnViewChange(), false);
});

check("row limits are respected (max 12, no duplicates)", () => {
  const prospects = Array.from({ length: 20 }, () =>
    prospect({ publicCompany: true }),
  );
  const rows = buildDiscoveryRows(prospects);
  const publicCos = rows.find((r) => r.id === "public-companies");
  assert.ok(publicCos);
  assert.equal(publicCos!.prospects.length, MAX_ROW_CARDS);
  assert.equal(MAX_ROW_CARDS, 12);
  const ids = new Set(publicCos!.prospects.map((p) => p.id));
  assert.equal(ids.size, publicCos!.prospects.length);
});

console.log(`\n${passed} discovery rows checks passed.`);
