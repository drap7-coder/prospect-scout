/**
 * Lightweight checks for the RSS / press-release provider.
 *
 * Run with:  npm run test:rss
 *
 * Uses mocked RSS XML fixtures — no network calls.
 */
import assert from "node:assert/strict";
import {
  RSS_UNAVAILABLE_EVIDENCE,
  extractSignalsFromRssItems,
  fetchRssProspects,
  isRssScopedQuery,
  matchFeedSources,
  parseRssXml,
} from "../lib/providers/rssNews.ts";

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

const HUMANA_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Humana News</title>
    <item>
      <title>Humana appoints new Chief Pharmacy Officer</title>
      <description>Humana Inc. announced the appointment of a new chief pharmacy officer to lead Medicare formulary strategy.</description>
      <pubDate>Mon, 02 Jun 2026 10:00:00 GMT</pubDate>
      <link>https://press.humana.com/example-leadership</link>
    </item>
    <item>
      <title>Humana expands Medicare Advantage footprint in Florida</title>
      <description>The health plan is expanding its Medicare Advantage presence with new markets in Florida.</description>
      <pubDate>Fri, 16 May 2026 09:00:00 GMT</pubDate>
      <link>https://press.humana.com/example-expansion</link>
    </item>
  </channel>
</rss>`;

const PEPSI_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PepsiCo News</title>
    <item>
      <title>PepsiCo announces acquisition of premium snack brand</title>
      <description>PepsiCo has entered an agreement to acquire a fast-growing snack business.</description>
      <pubDate>Tue, 20 May 2026 14:00:00 GMT</pubDate>
      <link>https://www.pepsico.com/example-mna</link>
    </item>
    <item>
      <title>PepsiCo launches new product line focused on reduced sugar</title>
      <description>The company unveiled a new product line as part of its innovation agenda.</description>
      <pubDate>Wed, 07 May 2026 11:00:00 GMT</pubDate>
      <link>https://www.pepsico.com/example-launch</link>
    </item>
  </channel>
</rss>`;

const HCA_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>HCA News</title>
  <entry>
    <title>HCA Healthcare announces partnership with regional health network</title>
    <summary>HCA Healthcare formed a strategic partnership to expand clinical collaboration.</summary>
    <published>2026-05-10T08:00:00Z</published>
    <link href="https://hcahealthcare.com/example-partnership"/>
  </entry>
  <entry>
    <title>HCA Healthcare facing regulatory review on billing practices</title>
    <summary>Regulatory authorities opened a review of billing compliance practices.</summary>
    <published>2026-04-28T08:00:00Z</published>
    <link href="https://hcahealthcare.com/example-regulatory"/>
  </entry>
</feed>`;

const WALMART_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Walmart announces hiring initiative for 10,000 new roles</title>
      <description>Walmart is adding jobs across stores and supply chain as part of workforce growth plans.</description>
      <pubDate>Thu, 22 May 2026 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Walmart outlines cost reduction program for employee benefits spend</title>
      <description>Leadership highlighted cost pressure and efficiency initiatives affecting benefits programs.</description>
      <pubDate>Mon, 12 May 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const FEEDS: Record<string, string> = {
  "https://press.humana.com/news-releases/rss": HUMANA_RSS,
  "https://www.pepsico.com/news/rss": PEPSI_RSS,
  "https://hcahealthcare.com/util/pages/rss/news-releases.rss": HCA_RSS,
  "https://corporate.walmart.com/newsroom/rss": WALMART_RSS,
};

const mockFetch = async (url: string) => {
  const xml = FEEDS[url];
  if (!xml) {
    return { ok: false, status: 404, text: async () => "" };
  }
  return { ok: true, status: 200, text: async () => xml };
};

async function main() {
  console.log("RSS provider checks:");

  check("parseRssXml extracts RSS 2.0 items", () => {
    const items = parseRssXml(HUMANA_RSS);
    assert.equal(items.length, 2);
    assert.ok(items[0].title.includes("Chief Pharmacy Officer"));
    assert.ok(items[0].pubDate.length > 0);
  });

  check("parseRssXml extracts Atom entries", () => {
    const items = parseRssXml(HCA_RSS);
    assert.equal(items.length, 2);
    assert.ok(items[0].title.includes("partnership"));
  });

  check("extractSignalsFromRssItems detects leadership and expansion", () => {
    const items = parseRssXml(HUMANA_RSS);
    const now = new Date("2026-06-15T12:00:00Z");
    const signals = extractSignalsFromRssItems(items, now);
    const ids = signals.map((s) => s.id);
    assert.ok(ids.includes("rss-leadership-change"));
    assert.ok(ids.includes("rss-expansion"));
    assert.equal(signals[0].source, "RSS");
    assert.ok(signals[0].evidenceText.includes("Leadership announcement"));
  });

  check("extractSignalsFromRssItems detects acquisition and product launch", () => {
    const items = parseRssXml(PEPSI_RSS);
    const now = new Date("2026-06-01T12:00:00Z");
    const signals = extractSignalsFromRssItems(items, now);
    const ids = signals.map((s) => s.id);
    assert.ok(ids.includes("rss-acquisition-merger"));
    assert.ok(ids.includes("rss-new-product-launch"));
  });

  check("extractSignalsFromRssItems detects partnership and regulatory issues", () => {
    const items = parseRssXml(HCA_RSS);
    const now = new Date("2026-06-01T12:00:00Z");
    const signals = extractSignalsFromRssItems(items, now);
    const ids = signals.map((s) => s.id);
    assert.ok(ids.includes("rss-partnership"));
    assert.ok(ids.includes("rss-regulatory-issue"));
  });

  check("extractSignalsFromRssItems detects hiring and cost pressure", () => {
    const items = parseRssXml(WALMART_RSS);
    const now = new Date("2026-06-01T12:00:00Z");
    const signals = extractSignalsFromRssItems(items, now);
    const ids = signals.map((s) => s.id);
    assert.ok(ids.includes("rss-hiring-workforce"));
    assert.ok(ids.includes("rss-cost-pressure"));
  });

  check("matchFeedSources resolves Humana for health-plans", () => {
    const matches = matchFeedSources("Humana Medicare Advantage", "health-plans");
    assert.ok(matches.length > 0);
    assert.equal(matches[0].feed.id, "rss-humana");
  });

  check("matchFeedSources resolves PepsiCo for manufacturers", () => {
    const matches = matchFeedSources("PepsiCo packaging", "manufacturers");
    assert.ok(matches.length > 0);
    assert.equal(matches[0].feed.id, "rss-pepsico");
  });

  check("matchFeedSources returns empty for unrelated queries", () => {
    assert.equal(matchFeedSources("regional health plans", "health-plans").length, 0);
    assert.equal(matchFeedSources("PepsiCo", "health-plans").length, 0);
  });

  check("isRssScopedQuery gates RSS fetches", () => {
    assert.equal(isRssScopedQuery("Humana", "health-plans"), true);
    assert.equal(isRssScopedQuery("generic manufacturers", "manufacturers"), false);
  });

  check("RSS unavailable evidence matches fallback contract", () => {
    assert.equal(
      RSS_UNAVAILABLE_EVIDENCE,
      "unavailable — showing mock news signals",
    );
  });

  await checkAsync("fetchRssProspects throws on feed failure (orchestrator catches)", async () => {
    await assert.rejects(
      () =>
        fetchRssProspects("Humana", "health-plans", {
          fetchImpl: async () => ({ ok: false, status: 503, text: async () => "" }),
        }),
      /RSS feed returned 503/,
    );
  });

  await checkAsync("fetchRssProspects returns Humana signals from mocked feed", async () => {
    const results = await fetchRssProspects("Humana Medicare", "health-plans", {
      fetchImpl: mockFetch,
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].match.feed.id, "rss-humana");
    assert.ok(results[0].signals.length >= 2);
  });

  await checkAsync("fetchRssProspects returns PepsiCo signals for manufacturers", async () => {
    const results = await fetchRssProspects("PepsiCo", "manufacturers", {
      fetchImpl: mockFetch,
    });
    assert.ok(results.length > 0);
    assert.ok(results[0].signals.some((s) => s.id === "rss-acquisition-merger"));
  });

  console.log(`\nAll ${passed} RSS provider checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
