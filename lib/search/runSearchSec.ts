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

/**
 * SEC-aware search pipeline.
 *
 * Runs the existing mock pipeline first (always), then — when the buyer pack
 * is SEC-eligible and the query appears to reference a public company or
 * ticker — augments the results with REAL SEC EDGAR signals.
 *
 * Guarantees:
 *   - SEC is best-effort. Any failure is caught and the mock results are
 *     returned unchanged except for a single "SEC unavailable" source-trail
 *     note, so the UI never breaks and no raw JSON is exposed.
 *   - Mock data always remains as the fallback.
 */
export async function runSearchWithProviders(
  input: RawSearchInput,
): Promise<SearchResponse> {
  const base = runSearch(input);
  const { query } = base;
  const plan = planSources(query);

  if (!plan.providers.includes("sec-edgar")) return base;

  const hint = companyHint(query);
  if (!hint || !looksLikeCompanyReference(hint)) return base;

  try {
    const match = await searchCompany(hint);
    // For all packs, SEC only contributes when a real company is resolved.
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

/** Derives a company/ticker hint from the (original) free-text input. */
function companyHint(query: SearchQuery): string {
  return [query.raw.targets, query.raw.sells]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(" ")
    .trim();
}

/** Builds a render-ready prospect from an SEC company + its signals. */
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

/**
 * Returns the base results with a non-intrusive note on the top result's
 * source trail indicating SEC was attempted but unavailable.
 */
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
