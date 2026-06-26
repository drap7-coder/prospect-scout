import type {
  Prospect,
  ProspectSignal,
  RawProspect,
  RawSearchInput,
  SearchQuery,
  SearchResponse,
} from "@/lib/search/types";
import { getBuyerPack } from "@/lib/packs";
import { runSearch } from "./runSearch";
import { planSources } from "./sourcePlanner";
import { scoreProspect } from "./score";
import { synthesizeProspect } from "./synthesize";
import {
  enrichLocationFromSubmissions,
  extractSignalsFromFilings,
  fetchSubmissions,
  looksLikeCompanyReference,
  recentFilingsFromSubmissions,
  searchCompany,
  type CompanyMatch,
  type SecSubmissions,
} from "@/lib/providers/secEdgar";
import {
  CMS_UNAVAILABLE_EVIDENCE,
  fetchCmsProspects,
  isHealthPlanScopedQuery,
  type CmsFetchResult,
} from "@/lib/providers/cms";
import {
  RSS_UNAVAILABLE_EVIDENCE,
  fetchRssProspects,
  isRssScopedQuery,
  type RssFetchResult,
} from "@/lib/providers/rssNews";

/**
 * Provider-aware search pipeline.
 *
 * Runs the existing mock pipeline first (always), then augments results with
 * real provider signals when eligible:
 *   - SEC EDGAR for public-company references (non public-sector packs)
 *   - CMS for health-plan org references (health-plans pack only)
 *   - RSS for press releases when a curated feed matches (four packs)
 *
 * Guarantees:
 *   - Every real provider is best-effort. Failures are caught and mock results
 *     are returned with a source-trail note — the UI never breaks.
 *   - Mock data always remains as the fallback.
 */
export async function runSearchWithProviders(
  input: RawSearchInput,
): Promise<SearchResponse> {
  let result = runSearch(input);
  const plan = planSources(result.query);

  if (plan.providers.includes("sec-edgar")) {
    result = await trySecProvider(result);
  }

  if (plan.providers.includes("cms")) {
    result = await tryCmsProvider(result);
  }

  if (plan.providers.includes("news-rss")) {
    result = await tryRssProvider(result);
  }

  return result;
}

/** Derives an org/company hint from the (original) free-text input. */
function orgHint(query: SearchQuery): string {
  return [query.raw.targets, query.raw.sells]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(" ")
    .trim();
}

// ---------------------------------------------------------------------------
// SEC EDGAR
// ---------------------------------------------------------------------------

async function trySecProvider(base: SearchResponse): Promise<SearchResponse> {
  const { query } = base;
  const hint = orgHint(query);
  if (!hint || !looksLikeCompanyReference(hint)) return base;

  try {
    const match = await searchCompany(hint);
    if (!match) return base;

    const submissions = await fetchSubmissions(match.cik);
    const filings = recentFilingsFromSubmissions(submissions);
    const signals = extractSignalsFromFilings(filings);
    if (signals.length === 0) return base;

    const secProspect = buildSecProspect(match, submissions, signals, query);
    const prospects = [secProspect, ...base.prospects].sort(
      (a, b) => b.score - a.score,
    );
    return { query, prospects };
  } catch (err) {
    console.warn("[secEdgar] provider unavailable, falling back to mock:", err);
    return withSecUnavailableNote(base);
  }
}

function buildSecProspect(
  match: CompanyMatch,
  submissions: SecSubmissions,
  signals: ProspectSignal[],
  query: SearchQuery,
): Prospect {
  const pack = getBuyerPack(query.profile.targetBuyer);
  const location = enrichLocationFromSubmissions(submissions);

  const raw: RawProspect = {
    id: `sec-${match.cik}`,
    name: match.title,
    location: location?.displayLocation
      ?? (match.ticker ? `Public company · ${match.ticker}` : "Public company"),
    region: location?.region ?? "any",
    buyerPack: query.profile.targetBuyer,
    size: "large",
    signals: [],
    fitKeywords: [],
  };

  const breakdown = scoreProspect(raw, signals, query);
  const prospect = synthesizeProspect(raw, signals, query, pack, breakdown);

  if (!location) return prospect;

  return {
    ...prospect,
    sourceTrail: [
      ...prospect.sourceTrail,
      { source: "SEC", evidenceText: "EDGAR · Company business address" },
    ],
  };
}

function withSecUnavailableNote(base: SearchResponse): SearchResponse {
  if (base.prospects.length === 0) return base;
  const [first, ...rest] = base.prospects;
  const noted: Prospect = {
    ...first,
    sourceTrail: [
      ...first.sourceTrail,
      {
        source: "SEC",
        evidenceText: "EDGAR unavailable — showing mock signals",
      },
    ],
  };
  return { query: base.query, prospects: [noted, ...rest] };
}

// ---------------------------------------------------------------------------
// CMS (Health Plans)
// ---------------------------------------------------------------------------

async function tryCmsProvider(base: SearchResponse): Promise<SearchResponse> {
  const { query } = base;
  if (query.profile.targetBuyer !== "health-plans") return base;

  const hint = orgHint(query);
  if (!hint || !isHealthPlanScopedQuery(hint, query.profile.region)) return base;

  try {
    const cmsResults = await fetchCmsProspects(hint, query.profile.region);
    if (cmsResults.length === 0) return base;

    const cmsProspects = cmsResults.map((data) => buildCmsProspect(data, query));
    const named = cmsProspects.filter((_, i) => cmsResults[i].confidence === "named");
    const criteria = cmsProspects.filter((_, i) => cmsResults[i].confidence === "criteria");
    const merged = [...named, ...criteria].sort((a, b) => b.score - a.score);

    const existingIds = new Set(merged.map((p) => p.id));
    const rest = base.prospects.filter((p) => !existingIds.has(p.id));
    const prospects = [...merged, ...rest].sort((a, b) => b.score - a.score);
    return { query, prospects };
  } catch (err) {
    console.warn("[cms] provider unavailable, falling back to mock:", err);
    return withCmsUnavailableNote(base);
  }
}

function buildCmsProspect(
  cmsData: CmsFetchResult,
  query: SearchQuery,
): Prospect {
  const pack = getBuyerPack(query.profile.targetBuyer);
  const { match, signals, location, enrollmentTrend } = cmsData;

  const raw: RawProspect = {
    id: match.org.id,
    name: match.org.organizationName,
    location: location.displayLocation,
    region: location.region,
    buyerPack: "health-plans",
    size: match.org.contracts.length >= 5 ? "enterprise" : "large",
    signals: [],
    fitKeywords: ["medicare", "advantage", "part d", "pharmacy", "pbm"],
  };

  const breakdown = scoreProspect(raw, signals, query);
  let prospect = synthesizeProspect(raw, signals, query, pack, breakdown);

  // Named org matches are highest-confidence CMS hits.
  if (cmsData.confidence === "named") {
    prospect = {
      ...prospect,
      score: Math.min(100, prospect.score + 5),
      scoreBreakdown: {
        ...prospect.scoreBreakdown,
        total: Math.min(100, prospect.scoreBreakdown.total + 5),
      },
    };
  }

  const trail = [...prospect.sourceTrail];
  if (enrollmentTrend) {
    trail.push({
      source: "CMS",
      evidenceText: "Medicare Monthly Enrollment · data.cms.gov",
    });
  }
  trail.push({
    source: "CMS",
    evidenceText:
      cmsData.confidence === "named"
        ? "Contract registry · named organization match"
        : `Contract registry · ${cmsData.match.matchedOn}`,
  });

  return { ...prospect, sourceTrail: trail };
}

function withCmsUnavailableNote(base: SearchResponse): SearchResponse {
  if (base.prospects.length === 0) return base;
  const [first, ...rest] = base.prospects;
  const noted: Prospect = {
    ...first,
    sourceTrail: [
      ...first.sourceTrail,
      { source: "CMS", evidenceText: CMS_UNAVAILABLE_EVIDENCE },
    ],
  };
  return { query: base.query, prospects: [noted, ...rest] };
}

// ---------------------------------------------------------------------------
// RSS / Press releases
// ---------------------------------------------------------------------------

const RSS_ELIGIBLE_PACKS = new Set([
  "health-plans",
  "manufacturers",
  "health-systems",
  "employers",
]);

async function tryRssProvider(base: SearchResponse): Promise<SearchResponse> {
  const { query } = base;
  if (!RSS_ELIGIBLE_PACKS.has(query.profile.targetBuyer)) return base;

  const hint = orgHint(query);
  if (!hint || !isRssScopedQuery(hint, query.profile.targetBuyer)) return base;

  try {
    const rssResults = await fetchRssProspects(hint, query.profile.targetBuyer);
    if (rssResults.length === 0) return base;

    const rssProspects = rssResults.map((data) => buildRssProspect(data, query));
    const existingIds = new Set(rssProspects.map((p) => p.id));
    const rest = base.prospects.filter((p) => !existingIds.has(p.id));
    const prospects = [...rssProspects, ...rest].sort((a, b) => b.score - a.score);
    return { query, prospects };
  } catch (err) {
    console.warn("[rss] provider unavailable, falling back to mock:", err);
    return withRssUnavailableNote(base);
  }
}

function buildRssProspect(
  rssData: RssFetchResult,
  query: SearchQuery,
): Prospect {
  const pack = getBuyerPack(query.profile.targetBuyer);
  const { match, signals } = rssData;
  const { feed } = match;

  const raw: RawProspect = {
    id: feed.id,
    name: feed.organizationName,
    location: feed.location,
    region: feed.region,
    buyerPack: query.profile.targetBuyer,
    size: feed.size,
    signals: [],
    fitKeywords: [],
  };

  const breakdown = scoreProspect(raw, signals, query);
  const prospect = synthesizeProspect(raw, signals, query, pack, breakdown);

  const trail = [...prospect.sourceTrail];
  trail.push({
    source: "RSS",
    evidenceText: `Press feed · ${match.matchedOn}`,
  });

  return { ...prospect, sourceTrail: trail };
}

function withRssUnavailableNote(base: SearchResponse): SearchResponse {
  if (base.prospects.length === 0) return base;
  const [first, ...rest] = base.prospects;
  const noted: Prospect = {
    ...first,
    sourceTrail: [
      ...first.sourceTrail,
      { source: "RSS", evidenceText: RSS_UNAVAILABLE_EVIDENCE },
    ],
  };
  return { query: base.query, prospects: [noted, ...rest] };
}
