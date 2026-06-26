import type {
  RawProspect,
  RawSearchInput,
  SearchResponse,
} from "@/lib/search/types";
import { getBuyerPack } from "@/lib/packs";
import { parseIntent } from "./intentParser";
import { planSources } from "./sourcePlanner";
import { buildProspectSignals } from "./signalBuilder";
import { scoreProspect } from "./score";
import { synthesizeProspect } from "./synthesize";
import { getMockProspects } from "@/lib/providers/mockProspects";
import { ANY_REGION } from "./regions";

/**
 * Orchestrates the full search pipeline:
 *   raw input -> parse intent (profile) -> plan sources -> fetch candidates
 *   -> exclude targets -> (region filter) -> build signals -> score
 *   -> synthesize -> sort.
 *
 * Pure and provider-agnostic: swapping the mock provider for real ones only
 * touches `planSources`/the provider modules, not this orchestration.
 */
export function runSearch(input: RawSearchInput): SearchResponse {
  const query = parseIntent(input);
  const { profile } = query;
  const plan = planSources(query);
  const pack = getBuyerPack(profile.targetBuyer);

  // Today only the mock provider participates. With real providers, fetch
  // from each planned provider and merge/dedupe before scoring.
  let candidates: RawProspect[] = getMockProspects(plan);

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
