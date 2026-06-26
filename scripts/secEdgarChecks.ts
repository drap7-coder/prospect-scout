/**
 * Lightweight checks for the SEC EDGAR provider — no test framework required.
 *
 * Run with:  npm run test:sec
 * (executes via Node's built-in TypeScript support)
 *
 * Covers: ticker lookup, CIK padding, submissions URL generation, the
 * company-reference heuristic, and signal extraction from mocked filing
 * metadata / text. Pure functions only — no network calls.
 */
import assert from "node:assert/strict";
import {
  padCik,
  submissionsUrl,
  matchCompany,
  looksLikeCompanyReference,
  extractSignalsFromFilings,
  extractSignalsFromText,
  recentFilingsFromSubmissions,
  getUserAgent,
  normalizeSecState,
  inferUsRegionFromState,
  extractCompanyAddress,
  enrichLocationFromSubmissions,
  type TickerEntry,
  type FilingRef,
} from "../lib/providers/secEdgar.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const TICKERS: TickerEntry[] = [
  { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
  { cik_str: 789019, ticker: "MSFT", title: "MICROSOFT CORP" },
  { cik_str: 77476, ticker: "PEP", title: "PEPSICO INC" },
];

console.log("SEC EDGAR checks:");

// --- CIK padding ---
check("padCik pads numbers to 10 digits", () => {
  assert.equal(padCik(320193), "0000320193");
  assert.equal(padCik("77476"), "0000077476");
  assert.equal(padCik("CIK0000320193"), "0000320193");
});

// --- Submissions URL ---
check("submissionsUrl builds the canonical SEC URL", () => {
  assert.equal(
    submissionsUrl(320193),
    "https://data.sec.gov/submissions/CIK0000320193.json",
  );
});

// --- Ticker lookup ---
check("matchCompany resolves an exact ticker", () => {
  const m = matchCompany("AAPL", TICKERS);
  assert.ok(m);
  assert.equal(m!.cik, "0000320193");
  assert.equal(m!.ticker, "AAPL");
});

check("matchCompany resolves a company name", () => {
  const m = matchCompany("I sell benefits to PepsiCo", TICKERS);
  assert.ok(m);
  assert.equal(m!.ticker, "PEP");
});

check("matchCompany returns null for generic categories", () => {
  assert.equal(matchCompany("food manufacturers", TICKERS), null);
});

// --- Company-reference heuristic ---
check("looksLikeCompanyReference gates network calls", () => {
  assert.equal(looksLikeCompanyReference("AAPL"), true);
  assert.equal(looksLikeCompanyReference("PepsiCo"), true);
  assert.equal(looksLikeCompanyReference("food manufacturers"), false);
  assert.equal(looksLikeCompanyReference(""), false);
});

// --- Submissions flattening ---
check("recentFilingsFromSubmissions flattens parallel arrays", () => {
  const filings = recentFilingsFromSubmissions({
    filings: {
      recent: {
        form: ["8-K", "10-K"],
        filingDate: ["2026-06-20", "2026-03-01"],
        items: ["5.02", ""],
        primaryDocument: ["a.htm", "b.htm"],
        accessionNumber: ["1", "2"],
      },
    },
  });
  assert.equal(filings.length, 2);
  assert.equal(filings[0].form, "8-K");
  assert.equal(filings[1].filingDate, "2026-03-01");
});

// --- Signal extraction from filing metadata ---
check("extractSignalsFromFilings derives signals from forms + items", () => {
  const now = new Date("2026-06-26T00:00:00Z");
  const filings: FilingRef[] = [
    {
      form: "8-K",
      filingDate: "2026-06-20",
      items: "2.01,5.02",
      primaryDocument: "x.htm",
      accessionNumber: "1",
    },
    {
      form: "10-K",
      filingDate: "2026-03-01",
      items: "",
      primaryDocument: "y.htm",
      accessionNumber: "2",
    },
    {
      form: "10-Q",
      filingDate: "2026-05-01",
      items: "",
      primaryDocument: "z.htm",
      accessionNumber: "3",
    },
  ];
  const ids = new Set(extractSignalsFromFilings(filings, now).map((s) => s.id));
  for (const expected of [
    "sec-8k",
    "sec-acquisition",
    "sec-leadership-change",
    "sec-10k",
    "sec-risk-factors",
    "sec-10q",
  ]) {
    assert.ok(ids.has(expected), `expected signal ${expected}`);
  }
});

check("extractSignalsFromFilings ignores stale filings", () => {
  const now = new Date("2026-06-26T00:00:00Z");
  const stale: FilingRef[] = [
    {
      form: "8-K",
      filingDate: "2024-01-01",
      items: "",
      primaryDocument: "x.htm",
      accessionNumber: "1",
    },
  ];
  assert.equal(extractSignalsFromFilings(stale, now).length, 0);
});

// --- Signal extraction from text ---
check("extractSignalsFromText finds language-based signals", () => {
  const text =
    "The company completed an acquisition and disclosed new risk factors; " +
    "the CFO resigned amid margin pressure and increased capex for a new facility.";
  const ids = new Set(
    extractSignalsFromText(text, { filingDate: "2026-06-10", now: new Date("2026-06-26") }).map(
      (s) => s.id,
    ),
  );
  for (const expected of [
    "sec-acquisition",
    "sec-risk-factors",
    "sec-leadership-change",
    "sec-cost-pressure",
    "sec-capital-investment",
  ]) {
    assert.ok(ids.has(expected), `expected signal ${expected}`);
  }
});

// --- State / region normalization ---
check("normalizeSecState accepts US state codes and names", () => {
  assert.equal(normalizeSecState("NY"), "NY");
  assert.equal(normalizeSecState("ny"), "NY");
  assert.equal(normalizeSecState("New York"), "NY");
  assert.equal(normalizeSecState("IL"), "IL");
});

check("normalizeSecState returns null for unknown or non-US values", () => {
  assert.equal(normalizeSecState(""), null);
  assert.equal(normalizeSecState("X0"), null);
  assert.equal(normalizeSecState("Ontario"), null);
  assert.equal(normalizeSecState("GB"), null);
});

check("inferUsRegionFromState maps states to region buckets", () => {
  assert.equal(inferUsRegionFromState("NY"), "mid-atlantic");
  assert.equal(inferUsRegionFromState("PA"), "mid-atlantic");
  assert.equal(inferUsRegionFromState("MA"), "northeast");
  assert.equal(inferUsRegionFromState("IL"), "midwest");
  assert.equal(inferUsRegionFromState("CO"), "mountain-west");
  assert.equal(inferUsRegionFromState("CA"), "west");
  assert.equal(inferUsRegionFromState("TX"), "southwest");
  assert.equal(inferUsRegionFromState("FL"), "southeast");
});

check("inferUsRegionFromState returns any for unknown/non-US", () => {
  assert.equal(inferUsRegionFromState("X0"), "any");
  assert.equal(inferUsRegionFromState(""), "any");
});

// --- Address extraction ---
check("extractCompanyAddress prefers business over mailing", () => {
  const addr = extractCompanyAddress({
    addresses: {
      business: {
        city: "Purchase",
        stateOrCountry: "NY",
        zipCode: "10577",
      },
      mailing: {
        city: "Wilmington",
        stateOrCountry: "DE",
        zipCode: "19801",
      },
    },
  });
  assert.ok(addr);
  assert.equal(addr!.source, "business");
  assert.equal(addr!.city, "Purchase");
  assert.equal(addr!.stateOrCountry, "NY");
});

check("extractCompanyAddress falls back to mailing when business absent", () => {
  const addr = extractCompanyAddress({
    addresses: {
      mailing: { city: "Chicago", stateOrCountry: "IL", zipCode: "60601" },
    },
  });
  assert.ok(addr);
  assert.equal(addr!.source, "mailing");
  assert.equal(addr!.city, "Chicago");
});

check("PepsiCo Purchase NY maps to mid-atlantic with display location", () => {
  const loc = enrichLocationFromSubmissions({
    addresses: {
      business: {
        city: "Purchase",
        stateOrCountry: "NY",
        zipCode: "10577",
      },
    },
  });
  assert.ok(loc);
  assert.equal(loc!.displayLocation, "Purchase, NY");
  assert.equal(loc!.region, "mid-atlantic");
});

check("enrichLocationFromSubmissions returns null region any for foreign address", () => {
  const loc = enrichLocationFromSubmissions({
    addresses: {
      business: { city: "London", stateOrCountry: "X0" },
    },
  });
  assert.ok(loc);
  assert.equal(loc!.displayLocation, "London");
  assert.equal(loc!.region, "any");
});

// --- User-Agent fallback ---
check("getUserAgent honors env and falls back safely", () => {
  const saved = process.env.SEC_USER_AGENT;
  delete process.env.SEC_USER_AGENT;
  assert.ok(getUserAgent().length > 0); // warns + returns dev fallback
  process.env.SEC_USER_AGENT = "Prospect Scout test@example.com";
  assert.equal(getUserAgent(), "Prospect Scout test@example.com");
  if (saved === undefined) delete process.env.SEC_USER_AGENT;
  else process.env.SEC_USER_AGENT = saved;
});

console.log(`\nAll ${passed} SEC EDGAR checks passed.`);
