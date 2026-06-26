import type { ProviderId, SearchQuery, SourcePlan } from "@/lib/search/types";

/**
 * Decides which buyer pack(s) and data providers a search should hit.
 *
 * MVP behavior: a single buyer pack, served only by the `mock` provider.
 *
 * Future: this is the natural place to fan out to real free providers based
 * on the buyer pack. For example:
 *   - health-plans   -> CMS (Medicare enrollment / plan data), NPPES, news-rss
 *   - manufacturers  -> SEC EDGAR (public filings), FDA (recalls), news-rss
 *   - health-systems -> CMS, NPPES, news-rss, company-site
 *   - employers      -> SEC EDGAR, Census (County Business Patterns), news-rss
 *   - public-sector  -> Census, government RFP feeds (RSS), company-site
 * Each provider would implement the same `ProspectProvider` contract used by
 * the mock provider, so the scoring/synthesis pipeline stays unchanged.
 */
export function planSources(query: SearchQuery): SourcePlan {
  const providers: ProviderId[] = ["mock"];
  const pack = query.profile.targetBuyer;

  // SEC EDGAR is the first real provider. It is eligible whenever the target
  // ecosystem can contain public companies:
  //   - manufacturers, employers           -> always eligible
  //   - health-plans, health-systems       -> eligible *if* a public
  //                                            parent/company match exists
  //   - public-sector                      -> not eligible (no SEC filers)
  // For the conditional packs, the provider still only contributes when a
  // company is actually resolved at fetch time, so listing it here is safe.
  if (pack !== "public-sector") {
    providers.push("sec-edgar");
  }

  // CMS is the second real provider — Medicare Advantage / Part D signals for
  // the Health Plans pack only. Failures fall back to mock data.
  if (pack === "health-plans") {
    providers.push("cms");
  }

  return {
    query,
    buyerPacks: [pack],
    providers,
  };
}
