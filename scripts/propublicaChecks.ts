/**
 * ProPublica Nonprofit Explorer connector checks.
 * Run: npm run test:propublica
 */
import assert from "node:assert/strict";
import {
  enrichNonprofit,
  formatStrein,
  nameSimilarity,
  normalizeEinDigits,
  normalizeOrganizationEnrichment,
  normalizeSearchCandidate,
  ProPublicaClient,
  resetCacheStatsForTests,
  resetProPublicaForTests,
  scoreNonprofitMatch,
  ENRICHMENT_CONFIDENCE_THRESHOLD,
} from "../lib/discovery/connectors/propublica/index.ts";

let passed = 0;

async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("ProPublica connector checks:\n");

check("normalizeEinDigits preserves nine digits", () => {
  assert.equal(normalizeEinDigits("01-2345678"), "012345678");
  assert.equal(formatStrein("142007220"), "14-2007220");
});

check("nameSimilarity scores exact names highly", () => {
  assert.ok(nameSimilarity("Red Cross", "Red Cross") >= 0.95);
  assert.ok(nameSimilarity("American Red Cross", "Red Cross") >= 0.8);
});

check("scoreNonprofitMatch prefers EIN match", () => {
  const score = scoreNonprofitMatch(
    { ein: "142007220", name: "Pro Publica Inc" },
    { ein: 142007220, name: "Pro Publica Inc", state: "NY" },
  );
  assert.ok(score >= 0.95);
});

check("normalizeOrganizationEnrichment maps filing financials", () => {
  const enrichment = normalizeOrganizationEnrichment({
    organization: {
      ein: 142007220,
      strein: "14-2007220",
      name: "Pro Publica Inc",
      city: "New York",
      state: "NY",
      ntee_code: "A20",
      subsection_code: 3,
    },
    filings_with_data: [
      {
        tax_prd_yr: 2023,
        totrevenue: 57_970_562,
        totfuncexpns: 44_080_009,
        totassetsend: 85_514_123,
        compnsatncurrofcr: 2_232_164,
        pdf_url: "https://example.com/990.pdf",
      },
    ],
  });

  assert.equal(enrichment.subsection501c, "501(c)(3)");
  assert.equal(enrichment.revenue, 57_970_562);
  assert.equal(enrichment.latestForm990Year, 2023);
  assert.equal(enrichment.form990PdfUrl, "https://example.com/990.pdf");
});

await checkAsync("ProPublicaClient caches organization lookups", async () => {
  resetProPublicaForTests();
  resetCacheStatsForTests();

  let calls = 0;
  const mockFetch: typeof fetch = async (input) => {
    calls += 1;
    const url = String(input);
    if (url.includes("/organizations/")) {
      return new Response(
        JSON.stringify({
          organization: {
            ein: 123456789,
            name: "Test Nonprofit",
            city: "Columbus",
            state: "OH",
            subsection_code: 3,
          },
          filings_with_data: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ organizations: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" } },
    );
  };

  const client = new ProPublicaClient({ fetchImpl: mockFetch });
  await client.fetchOrganization("123456789");
  await client.fetchOrganization("123456789");
  assert.equal(calls, 1);
});

await checkAsync("enrichNonprofit returns enrichment on EIN lookup", async () => {
  resetProPublicaForTests();
  resetCacheStatsForTests();

  const mockFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("/organizations/142007220")) {
      return new Response(
        JSON.stringify({
          organization: {
            ein: 142007220,
            strein: "14-2007220",
            name: "Pro Publica Inc",
            city: "New York",
            state: "NY",
            subsection_code: 3,
            ntee_code: "A20",
          },
          filings_with_data: [
            {
              tax_prd_yr: 2023,
              totrevenue: 1000,
              totfuncexpns: 800,
              totassetsend: 5000,
              pdf_url: "https://example.com/990.pdf",
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ organizations: [] }), { status: 200 });
  };

  const client = new ProPublicaClient({ fetchImpl: mockFetch });
  const result = await enrichNonprofit(
    { ein: "142007220", name: "Pro Publica Inc", state: "NY" },
    { client },
  );

  assert.equal(result.source, "propublica-nonprofit-explorer");
  assert.ok(result.confidence >= ENRICHMENT_CONFIDENCE_THRESHOLD);
  assert.ok(result.enrichment);
  assert.equal(result.enrichment!.legalName, "Pro Publica Inc");
});

await checkAsync("enrichNonprofit fails gracefully on API error", async () => {
  resetProPublicaForTests();
  resetCacheStatsForTests();

  const mockFetch: typeof fetch = async () =>
    new Response("Service unavailable", { status: 503 });

  const client = new ProPublicaClient({ fetchImpl: mockFetch });
  const result = await enrichNonprofit(
    { name: "Unknown Org", state: "OH" },
    { client },
  );

  assert.equal(result.available, false);
  assert.ok(result.error);
  assert.equal(result.enrichment, null);
});

check("normalizeSearchCandidate strips raw API fields", () => {
  const candidate = normalizeSearchCandidate(
    {
      ein: 142007220,
      strein: "14-2007220",
      name: "Pro Publica Inc",
      city: "New York",
      state: "NY",
      ntee_code: "A20",
    },
    0.9,
  );
  assert.equal(candidate.ein, "142007220");
  assert.equal(candidate.confidence, 0.9);
  assert.ok(!("score" in candidate));
});

console.log(`\nAll ${passed} propublica checks passed.`);
