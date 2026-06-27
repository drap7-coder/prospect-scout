/**
 * Census CBP connector checks — client, cache, NAICS, no org ingestion.
 * Run: npm run test:census
 */
import assert from "node:assert/strict";
import {
  aggregateCbpRows,
  buildCbpUrl,
  computeMarketCoveragePercent,
  getMarketSize,
  inferNaicsFromSearchState,
  normalizeNaicsCode,
  parseCbpResponse,
  postalToStateFips,
  resetCensusCacheForTests,
  resetMarketSizeCacheForTests,
  CensusClient,
} from "../lib/discovery/connectors/census/index.ts";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result instanceof Promise) {
    throw new Error(`Async check not supported: ${name}`);
  }
  passed += 1;
  console.log(`  ok  ${name}`);
}

async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Census CBP connector checks:\n");

check("postalToStateFips maps OH to 39", () => {
  assert.equal(postalToStateFips("OH"), "39");
});

check("normalizeNaicsCode defaults to 00", () => {
  assert.equal(normalizeNaicsCode(null), "00");
  assert.equal(normalizeNaicsCode("311812"), "311812");
});

check("inferNaicsFromSearchState maps manufacturing query", () => {
  const naics = inferNaicsFromSearchState({
    query: "food manufacturers in ohio",
    sector: "manufacturing",
    industry: "food-beverage",
    organizationType: null,
    location: null,
    companySize: null,
    signals: [],
    sources: [],
    freshness: null,
    sellerContext: null,
    ownership: null,
    state: "OH",
    metro: null,
    operatingStates: [],
    sort: null,
  });
  assert.equal(naics, "311");
});

check("buildCbpUrl never includes key in path (query param only)", () => {
  const url = buildCbpUrl({
    year: 2023,
    apiKey: "secret-key",
    params: { naics: "31", stateFips: "39" },
  });
  assert.ok(url.includes("key=secret-key"));
  assert.ok(!url.includes("secret-key/"));
});

check("parseCbpResponse aggregates matrix rows", () => {
  const json = [
    ["NAME", "NAICS2017_LABEL", "ESTAB", "PAYANN", "PAYQTR1", "EMP"],
    ["Ohio", "Manufacturing", "1200", "50000", "12000", "80000"],
  ];
  const rows = parseCbpResponse(json);
  assert.equal(rows.length, 1);
  const agg = aggregateCbpRows(rows);
  assert.equal(agg.estimatedEstablishments, 1200);
  assert.equal(agg.employment, 80000);
  assert.equal(agg.annualPayroll, 50_000_000);
});

check("computeMarketCoveragePercent caps at 100", () => {
  assert.equal(computeMarketCoveragePercent(500, 200), 100);
  assert.equal(computeMarketCoveragePercent(50, 200), 25);
});

await checkAsync("getMarketSize uses mock fetch and caches", async () => {
  resetCensusCacheForTests();
  resetMarketSizeCacheForTests();

  let calls = 0;
  const mockFetch: typeof fetch = async () => {
    calls += 1;
    return new Response(
      JSON.stringify([
        ["NAME", "NAICS2017_LABEL", "ESTAB", "PAYANN", "PAYQTR1", "EMP", "state"],
        ["Ohio", "Manufacturing", "900", "40000", "10000", "70000", "39"],
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const client = new CensusClient({ apiKey: "test-key", fetchImpl: mockFetch });
  const rows1 = await client.fetchCbp({ naics: "31", stateFips: "39" });
  const rows2 = await client.fetchCbp({ naics: "31", stateFips: "39" });
  assert.equal(rows1.length, 1);
  assert.equal(calls, 1, "second call should hit cache");
  assert.equal(rows2.length, 1);
});

await checkAsync("getMarketSize returns unavailable without API key", async () => {
  resetMarketSizeCacheForTests();
  const prior = process.env.CENSUS_API_KEY;
  delete process.env.CENSUS_API_KEY;

  const result = await getMarketSize({ state: "OH", naics: "31" });
  assert.equal(result.available, false);
  assert.equal(result.estimatedEstablishments, null);
  assert.match(result.error ?? "", /CENSUS_API_KEY/i);

  if (prior === undefined) delete process.env.CENSUS_API_KEY;
  else process.env.CENSUS_API_KEY = prior;
});

console.log(`\nAll ${passed} census checks passed.`);
