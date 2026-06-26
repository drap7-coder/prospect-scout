/**
 * Lightweight checks for the public website / directory provider.
 *
 * Run with:  npm run test:web
 *
 * Uses mocked HTML fixtures — no network calls.
 */
import assert from "node:assert/strict";
import {
  PageFailureCache,
  PUBLIC_WEB_UNAVAILABLE_EVIDENCE,
  buildPageCandidates,
  buildPageUrl,
  extractSignalsFromPageText,
  fetchPublicPages,
  fetchPublicWebProspects,
  isPublicWebScopedQuery,
  matchDirectoryEntries,
  normalizeWebsiteOrigin,
  publicWebTrailItem,
  stripHtmlToText,
} from "../lib/providers/publicWeb.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const CAREERS_HTML = `<!DOCTYPE html><html><head><title>Careers</title></head><body>
  <h1>Join our team</h1>
  <p>We are hiring packaging engineers and automation specialists across our Midwest facilities.</p>
  <p>Explore open positions in production, quality, and plant operations.</p>
</body></html>`;

const NEWS_HTML = `<!DOCTYPE html><html><body>
  <h1>News</h1>
  <p>Capital BlueCross announces expansion into new counties with Medicare Advantage products.</p>
  <p>The regional health plan appointed a new Chief Pharmacy Officer to lead formulary strategy.</p>
</body></html>`;

const ABOUT_HTML = `<!DOCTYPE html><html><body>
  <h1>About</h1>
  <p>Schreiber Foods is investing in sustainability initiatives and renewable energy at our Wisconsin plants.</p>
  <p>Our compliance program meets FDA and SQF quality system requirements.</p>
</body></html>`;

const FIXTURES: Record<string, string> = {
  "https://www.capbluecross.com/": "<html><body>Capital BlueCross regional health plan</body></html>",
  "https://www.capbluecross.com/about": ABOUT_HTML,
  "https://www.capbluecross.com/news": NEWS_HTML,
  "https://www.capbluecross.com/careers": CAREERS_HTML,
  "https://www.schreiberfoods.com/": "<html><body>Schreiber Foods dairy</body></html>",
  "https://www.schreiberfoods.com/about": ABOUT_HTML,
  "https://www.schreiberfoods.com/careers": CAREERS_HTML,
};

const mockFetch = async (url: string) => {
  const html = FIXTURES[url];
  if (!html) {
    return { ok: false, status: 404, text: async () => "" };
  }
  return { ok: true, status: 200, text: async () => html };
};

async function main() {
  console.log("Public Web provider checks:");

  check("normalizeWebsiteOrigin adds https scheme", () => {
    assert.equal(
      normalizeWebsiteOrigin("www.capbluecross.com"),
      "https://www.capbluecross.com",
    );
  });

  check("buildPageUrl joins origin and path", () => {
    assert.equal(
      buildPageUrl("https://example.com", "/careers"),
      "https://example.com/careers",
    );
  });

  check("buildPageCandidates includes standard public paths", () => {
    const pages = buildPageCandidates("https://example.com");
    assert.ok(pages.some((p) => p.pageType === "careers"));
    assert.ok(pages.some((p) => p.pageType === "news"));
    assert.equal(pages.length, 7);
  });

  check("matchDirectoryEntries resolves Capital BlueCross", () => {
    const matches = matchDirectoryEntries(
      "Capital BlueCross Medicare",
      "health-plans",
    );
    assert.ok(matches.length > 0);
    assert.equal(matches[0].entry.id, "dir-hp-capital-blue");
  });

  check("matchDirectoryEntries resolves Schreiber Foods", () => {
    const matches = matchDirectoryEntries("Schreiber Foods dairy", "manufacturers");
    assert.ok(matches.length > 0);
    assert.equal(matches[0].entry.id, "dir-mf-schreiber");
  });

  check("isPublicWebScopedQuery gates health-plans regional queries", () => {
    assert.equal(isPublicWebScopedQuery("regional health plans PA", "health-plans"), true);
    assert.equal(isPublicWebScopedQuery("national enterprise software", "health-plans"), false);
  });

  check("isPublicWebScopedQuery gates manufacturer directory queries", () => {
    assert.equal(
      isPublicWebScopedQuery("contract packaging companies", "manufacturers"),
      true,
    );
  });

  check("stripHtmlToText removes tags and scripts", () => {
    const text = stripHtmlToText(CAREERS_HTML);
    assert.ok(text.includes("hiring packaging engineers"));
    assert.ok(!text.includes("<h1>"));
  });

  check("extractSignalsFromPageText detects hiring from careers page", () => {
    const text = stripHtmlToText(CAREERS_HTML);
    const signals = extractSignalsFromPageText(text, "Careers page");
    assert.ok(signals.some((s) => s.id === "web-hiring"));
    assert.ok(signals.some((s) => s.id === "web-packaging-automation"));
  });

  check("extractSignalsFromPageText detects expansion and leadership from news", () => {
    const text = stripHtmlToText(NEWS_HTML);
    const signals = extractSignalsFromPageText(text, "News page");
    const ids = signals.map((s) => s.id);
    assert.ok(ids.includes("web-expansion"));
    assert.ok(ids.includes("web-leadership-change"));
    assert.ok(ids.includes("web-pharmacy-pbm-specialty"));
  });

  check("extractSignalsFromPageText detects sustainability and compliance from about", () => {
    const text = stripHtmlToText(ABOUT_HTML);
    const signals = extractSignalsFromPageText(text, "About page");
    const ids = signals.map((s) => s.id);
    assert.ok(ids.includes("web-sustainability"));
    assert.ok(ids.includes("web-regulatory-compliance"));
  });

  check("publicWebTrailItem formats source trail rows", () => {
    const item = publicWebTrailItem("Careers page");
    assert.equal(item.source, "Public Web");
    assert.equal(item.evidenceText, "Careers page");
  });

  check("PUBLIC_WEB_UNAVAILABLE_EVIDENCE matches fallback contract", () => {
    assert.equal(
      PUBLIC_WEB_UNAVAILABLE_EVIDENCE,
      "unavailable — showing mock directory signals",
    );
  });

  check("PageFailureCache skips cached failed URLs", () => {
    const cache = new PageFailureCache();
    cache.mark("https://example.com/press");
    assert.equal(cache.has("https://example.com/press"), true);
  });

  await checkAsync("fetchPublicPages falls back across page paths", async () => {
    const cache = new PageFailureCache();
    const pages = await fetchPublicPages(
      "https://www.capbluecross.com",
      cache,
      { fetchImpl: mockFetch },
    );
    assert.ok(pages.length >= 2);
    assert.ok(pages.some((p) => p.pageType === "news"));
    assert.ok(pages.some((p) => p.signals.length > 0));
    assert.equal(cache.has("https://www.capbluecross.com/press"), true);
  });

  await checkAsync(
    "fetchPublicWebProspects returns Capital BlueCross signals",
    async () => {
      const { results, allSourcesFailed } = await fetchPublicWebProspects(
        "Capital BlueCross",
        "health-plans",
        "mid-atlantic",
        { fetchImpl: mockFetch },
      );
      assert.equal(allSourcesFailed, false);
      assert.equal(results.length, 1);
      assert.equal(results[0].match.entry.id, "dir-hp-capital-blue");
      assert.ok(results[0].signals.length >= 2);
      assert.ok(results[0].pageTrails.some((t) => t.trailLabel === "News page"));
    },
  );

  await checkAsync(
    "fetchPublicWebProspects returns Schreiber Foods manufacturer signals",
    async () => {
      const { results } = await fetchPublicWebProspects(
        "Schreiber Foods",
        "manufacturers",
        "midwest",
        { fetchImpl: mockFetch },
      );
      assert.equal(results.length, 1);
      assert.ok(results[0].signals.some((s) => s.id === "web-sustainability"));
    },
  );

  await checkAsync(
    "fetchPublicWebProspects returns allSourcesFailed when all pages fail",
    async () => {
      const { results, allSourcesFailed } = await fetchPublicWebProspects(
        "Capital BlueCross",
        "health-plans",
        undefined,
        {
          fetchImpl: async () => ({
            ok: false,
            status: 503,
            text: async () => "",
          }),
        },
      );
      assert.equal(results.length, 0);
      assert.equal(allSourcesFailed, true);
    },
  );

  await checkAsync(
    "fetchPublicWebProspects handles generic Pennsylvania regional query",
    async () => {
      const { results } = await fetchPublicWebProspects(
        "regional health plans in Pennsylvania",
        "health-plans",
        "mid-atlantic",
        { fetchImpl: mockFetch },
      );
      assert.ok(results.length > 0);
    },
  );

  console.log(`\nAll ${passed} Public Web provider checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
