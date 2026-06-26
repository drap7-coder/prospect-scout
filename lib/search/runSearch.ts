import type {
  RawProspect,
  RawSearchInput,
  SearchResponse,
} from "@/lib/search/types";
import { getBuyerPack } from "@/lib/packs";
import { searchDirectory } from "@/lib/directories/search";
import { directoryRecordsToRawProspects } from "@/lib/directories/toRawProspect";
import { parseIntent } from "./intentParser";
import { planSources } from "./sourcePlanner";
import { buildProspectSignals } from "./signalBuilder";
import { scoreProspect } from "./score";
import { synthesizeProspect } from "./synthesize";
import { getMockProspects } from "@/lib/providers/mockProspects";
import { ANY_REGION } from "./regions";

function buildDirectoryQuery(input: RawSearchInput, region: string): string {
  return [input.targets, input.sells, region !== ANY_REGION ? region : ""]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(" ")
    .trim();
}

/**
 * Orchestrates the full search pipeline:
 *   raw input -> parse intent (profile) -> plan sources -> master directory
 *   -> (mock fallback) -> exclude targets -> (region filter) -> build signals
 *   -> score -> synthesize -> sort.
 *
 * The master directory is the source of truth for who exists; providers enrich
 * results in runSearchSec / providerPhase.
 */
export function runSearch(input: RawSearchInput): SearchResponse {
  const query = parseIntent(input);
  const { profile } = query;
  const plan = planSources(query);
  const pack = getBuyerPack(profile.targetBuyer);

  const directoryQuery = buildDirectoryQuery(input, profile.region);
  const directoryMatches = searchDirectory({
    query: directoryQuery,
    buyerPack: profile.targetBuyer,
    region: profile.region !== ANY_REGION ? profile.region : undefined,
  });

  let candidates: RawProspect[] = directoryRecordsToRawProspects(
    directoryMatches.map((m) => m.record),
  );

  // Mock remains as fallback when the directory has no matches for this pack.
  if (candidates.length === 0) {
    candidates = getMockProspects(plan);
  }

  // Apply excluded targets (name / location / fit-keyword match).
  if (profile.excludedTargets.length > 0) {
    candidates = candidates.filter((c) => {
      const haystack = `${c.name} ${c.location} ${c.fitKeywords.join(" ")}`.toLowerCase();
      return !profile.excludedTargets.some((term) => term && haystack.includes(term));
    });
  }

  // Filter by region when the user restricted geography. Fall back to the
  // full candidate set if filtering would leave nothing to show.
  if (profile.region !== ANY_REGION) {
    const matches = candidates.filter((c) => c.region === profile.region);
    if (matches.length > 0) candidates = matches;
  }

  const prospects = candidates
    .map((candidate) => {
      const signals = buildProspectSignals(candidate);
      const breakdown = scoreProspect(candidate, signals, query);
      return synthesizeProspect(candidate, signals, query, pack, breakdown);
    })
    .sort((a, b) => b.score - a.score);

  return { query, prospects };
}
