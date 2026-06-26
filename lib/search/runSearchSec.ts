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
import {
  FDA_UNAVAILABLE_EVIDENCE,
  fetchFdaProspects,
  isFdaScopedQuery,
  type FdaFetchResult,
} from "@/lib/providers/fda";
import {
  PUBLIC_WEB_UNAVAILABLE_EVIDENCE,
  fetchPublicWebProspects,
  isPublicWebScopedQuery,
  matchDirectoryEntries,
  publicWebTrailItem,
  type PublicWebFetchResult,
} from "@/lib/providers/publicWeb";

/**
 * Provider-aware search pipeline.
 *
 * Runs the existing mock pipeline first (always), then augments results with
 * real provider signals when eligible:
 *   - SEC EDGAR for public-company references (non public-sector packs)
 *   - CMS for health-plan org references (health-plans pack only)
 *   - RSS for press releases when a curated feed matches (four packs)
 *   - FDA / openFDA for recall enforcement (manufacturers; conditional others)
 *   - Public Web / directory for regional private orgs (health-plans, manufacturers)
 *
 * Guarantees:
 *   - Every real provider is best-effort. Failures are caught and mock results
 *     are returned with a source-trail note — the UI never breaks.
 *   - Mock data always remains as the fallback.
 */
export async function runSearchWithProviders(
  input: RawSearchInput,
): Promise<SearchResponse> {
  const base = runSearchMockOnly(input);
  const plan = planSources(base.query);
  const { enrichWithLiveProviders } = await import("./providerPhase");
  return enrichWithLiveProviders(base, plan);
}

/** Fast local/mock phase — no live provider network calls. */
export function runSearchMockOnly(input: RawSearchInput): SearchResponse {
  return runSearch(input);
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

export async function trySecProvider(base: SearchResponse): Promise<SearchResponse> {
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

export function withSecUnavailableNote(base: SearchResponse): SearchResponse {
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

export async function tryCmsProvider(base: SearchResponse): Promise<SearchResponse> {
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

export function withCmsUnavailableNote(base: SearchResponse): SearchResponse {
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

export async function tryRssProvider(base: SearchResponse): Promise<SearchResponse> {
  const { query } = base;
  if (!RSS_ELIGIBLE_PACKS.has(query.profile.targetBuyer)) return base;

  const hint = orgHint(query);
  if (!hint || !isRssScopedQuery(hint, query.profile.targetBuyer)) return base;

  try {
    const { results, allSourcesFailed } = await fetchRssProspects(
      hint,
      query.profile.targetBuyer,
    );
    if (results.length === 0) {
      return allSourcesFailed ? withRssUnavailableNote(base) : base;
    }

    const rssProspects = results.map((data) => buildRssProspect(data, query));
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
  const { match, signals, sourceUsed } = rssData;
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
    evidenceText: `${sourceUsed.label} · ${match.matchedOn}`,
  });

  return { ...prospect, sourceTrail: trail };
}

export function withRssUnavailableNote(base: SearchResponse): SearchResponse {
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

// ---------------------------------------------------------------------------
// FDA / openFDA
// ---------------------------------------------------------------------------

export async function tryFdaProvider(base: SearchResponse): Promise<SearchResponse> {
  const { query } = base;
  const hint = orgHint(query);
  const sells = query.raw.sells?.trim() ?? "";
  if (!hint || !isFdaScopedQuery(hint, query.profile.targetBuyer, sells)) {
    return base;
  }

  try {
    const { results, allSourcesFailed } = await fetchFdaProspects(
      `${hint} ${sells}`.trim(),
      query.profile.targetBuyer,
    );
    if (results.length === 0) {
      return allSourcesFailed ? withFdaUnavailableNote(base) : base;
    }

    const fdaProspects = results.map((data) => buildFdaProspect(data, query));
    const existingIds = new Set(fdaProspects.map((p) => p.id));
    const rest = base.prospects.filter((p) => !existingIds.has(p.id));
    const prospects = [...fdaProspects, ...rest].sort((a, b) => b.score - a.score);
    return { query, prospects };
  } catch (err) {
    console.warn("[fda] provider unavailable, falling back to mock:", err);
    return withFdaUnavailableNote(base);
  }
}

function buildFdaProspect(
  fdaData: FdaFetchResult,
  query: SearchQuery,
): Prospect {
  const pack = getBuyerPack(query.profile.targetBuyer);
  const { firm, signals, matchedOn, confidence, domains } = fdaData;

  const raw: RawProspect = {
    id: firm.id,
    name: firm.firmName,
    location: firm.location,
    region: firm.region,
    buyerPack: query.profile.targetBuyer,
    size: firm.size,
    signals: [],
    fitKeywords: [],
  };

  const breakdown = scoreProspect(raw, signals, query);
  let prospect = synthesizeProspect(raw, signals, query, pack, breakdown);

  if (confidence === "named") {
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
  trail.push({
    source: "FDA",
    evidenceText: `openFDA ${domains.join("/")} enforcement · ${matchedOn}`,
  });

  return { ...prospect, sourceTrail: trail };
}

export function withFdaUnavailableNote(base: SearchResponse): SearchResponse {
  if (base.prospects.length === 0) return base;
  const [first, ...rest] = base.prospects;
  const noted: Prospect = {
    ...first,
    sourceTrail: [
      ...first.sourceTrail,
      { source: "FDA", evidenceText: FDA_UNAVAILABLE_EVIDENCE },
    ],
  };
  return { query: base.query, prospects: [noted, ...rest] };
}

// ---------------------------------------------------------------------------
// Public Web / Directory
// ---------------------------------------------------------------------------

/** True when SEC or CMS already returned a high-confidence named org match. */
function hasStrongSecOrCmsMatch(prospects: Prospect[]): boolean {
  for (const p of prospects) {
    if (p.id.startsWith("sec-") && p.score >= 55) return true;
    if (
      p.id.startsWith("cms-") &&
      p.sourceTrail.some(
        (t) =>
          t.source === "CMS" &&
          t.evidenceText.includes("named organization match"),
      )
    ) {
      return true;
    }
  }
  return false;
}

export async function tryPublicWebProvider(
  base: SearchResponse,
): Promise<SearchResponse> {
  const { query } = base;
  const hint = orgHint(query);
  if (
    !hint ||
    !isPublicWebScopedQuery(hint, query.profile.targetBuyer, query.profile.region)
  ) {
    return base;
  }

  const namedDirectory = matchDirectoryEntries(
    hint,
    query.profile.targetBuyer,
    query.profile.region,
  ).some((m) => m.score >= 20);

  if (!namedDirectory && hasStrongSecOrCmsMatch(base.prospects)) {
    return base;
  }

  try {
    const { results, allSourcesFailed } = await fetchPublicWebProspects(
      hint,
      query.profile.targetBuyer,
      query.profile.region,
    );
    if (results.length === 0) {
      return allSourcesFailed ? withPublicWebUnavailableNote(base) : base;
    }

    const webProspects = results.map((data) => buildPublicWebProspect(data, query));
    const existingIds = new Set(webProspects.map((p) => p.id));
    const rest = base.prospects.filter((p) => !existingIds.has(p.id));
    const prospects = [...webProspects, ...rest].sort((a, b) => b.score - a.score);
    return { query, prospects };
  } catch (err) {
    console.warn("[publicWeb] provider unavailable, falling back to mock:", err);
    return withPublicWebUnavailableNote(base);
  }
}

function buildPublicWebProspect(
  webData: PublicWebFetchResult,
  query: SearchQuery,
): Prospect {
  const pack = getBuyerPack(query.profile.targetBuyer);
  const { match, signals, pageTrails, confidence, location, region, size } =
    webData;
  const { entry } = match;

  const raw: RawProspect = {
    id: `web-${entry.id}`,
    name: entry.name,
    location,
    region,
    buyerPack: query.profile.targetBuyer,
    size,
    signals: [],
    fitKeywords: [],
  };

  const breakdown = scoreProspect(raw, signals, query);
  let prospect = synthesizeProspect(raw, signals, query, pack, breakdown);

  if (confidence === "named") {
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
  for (const page of pageTrails) {
    trail.push(publicWebTrailItem(page.trailLabel));
  }
  trail.push({
    source: "Public Web",
    evidenceText: `Directory · ${match.matchedOn}`,
  });

  return { ...prospect, sourceTrail: trail };
}

export function withPublicWebUnavailableNote(base: SearchResponse): SearchResponse {
  if (base.prospects.length === 0) return base;
  const [first, ...rest] = base.prospects;
  const noted: Prospect = {
    ...first,
    sourceTrail: [
      ...first.sourceTrail,
      { source: "Public Web", evidenceText: PUBLIC_WEB_UNAVAILABLE_EVIDENCE },
    ],
  };
  return { query: base.query, prospects: [noted, ...rest] };
}
