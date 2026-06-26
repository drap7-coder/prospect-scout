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
  fetchCmsProspectData,
  looksLikeHealthPlanReference,
  type CmsFetchResult,
} from "@/lib/providers/cms";

/**
 * Provider-aware search pipeline.
 *
 * Runs the existing mock pipeline first (always), then augments results with
 * real provider signals when eligible:
 *   - SEC EDGAR for public-company references (non public-sector packs)
 *   - CMS for health-plan org references (health-plans pack only)
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
  if (!hint || !looksLikeHealthPlanReference(hint)) return base;

  try {
    const cmsData = await fetchCmsProspectData(
      hint,
      query.profile.region,
    );
    if (!cmsData) return base;

    const cmsProspect = buildCmsProspect(cmsData, query);
    const prospects = [cmsProspect, ...base.prospects].sort(
      (a, b) => b.score - a.score,
    );
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
  const prospect = synthesizeProspect(raw, signals, query, pack, breakdown);

  const trail = [...prospect.sourceTrail];
  if (enrollmentTrend) {
    trail.push({
      source: "CMS",
      evidenceText: "Medicare Monthly Enrollment · data.cms.gov",
    });
  }
  trail.push({
    source: "CMS",
    evidenceText: "Contract registry · CMS CPSC / Star Ratings",
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
