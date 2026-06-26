import type { Prospect, SearchResponse, SourcePlan } from "@/lib/search/types";
import { mergeProspectLists } from "./mergeProspects";
import {
  plannedPrimaryProviders,
  plannedSecondaryProviders,
  PROVIDER_TIMEOUT_MS,
  type LiveProviderKey,
  type ProviderRunStatus,
} from "./providerPlan";
import { withTimeout } from "./withTimeout";
import {
  tryCmsProvider,
  tryFdaProvider,
  tryPublicWebProvider,
  tryRssProvider,
  trySecProvider,
  withCmsUnavailableNote,
  withFdaUnavailableNote,
  withPublicWebUnavailableNote,
  withRssUnavailableNote,
  withSecUnavailableNote,
} from "./runSearchSec";

export type { ProviderBadgeKey, LiveProviderKey, ProviderBadgeStatus } from "./providerPlan";
export {
  plannedPrimaryProviders,
  plannedSecondaryProviders,
  PROVIDER_TIMEOUT_MS,
  ALL_BADGE_KEYS,
} from "./providerPlan";

export interface ProviderPhaseResult {
  provider: LiveProviderKey;
  status: ProviderRunStatus | "skipped";
  prospects: Prospect[];
  ms: number;
}

async function runProviderInternal(
  provider: LiveProviderKey,
  base: SearchResponse,
): Promise<SearchResponse> {
  switch (provider) {
    case "sec":
      return trySecProvider(base);
    case "cms":
      return tryCmsProvider(base);
    case "rss":
      return tryRssProvider(base);
    case "fda":
      return tryFdaProvider(base);
    case "public-web":
      return tryPublicWebProvider(base);
    default:
      return base;
  }
}

function withUnavailableNote(
  provider: LiveProviderKey,
  base: SearchResponse,
): SearchResponse {
  switch (provider) {
    case "sec":
      return withSecUnavailableNote(base);
    case "cms":
      return withCmsUnavailableNote(base);
    case "rss":
      return withRssUnavailableNote(base);
    case "fda":
      return withFdaUnavailableNote(base);
    case "public-web":
      return withPublicWebUnavailableNote(base);
    default:
      return base;
  }
}

/** Runs one live provider with timeout, logging, and graceful fallback. */
export async function runProviderPhase(
  provider: LiveProviderKey,
  base: SearchResponse,
): Promise<ProviderPhaseResult> {
  const start = Date.now();
  const timeoutMs = PROVIDER_TIMEOUT_MS[provider];

  try {
    const updated = await withTimeout(
      runProviderInternal(provider, base),
      timeoutMs,
      provider,
    );
    const ms = Date.now() - start;
    console.info(`[search] provider=${provider} status=ready ms=${ms}`);
    return {
      provider,
      status: "ready",
      prospects: updated.prospects,
      ms,
    };
  } catch (err) {
    const ms = Date.now() - start;
    console.warn(
      `[search] provider=${provider} status=unavailable ms=${ms}`,
      err instanceof Error ? err.message : err,
    );
    const noted = withUnavailableNote(provider, base);
    return {
      provider,
      status: "unavailable",
      prospects: noted.prospects,
      ms,
    };
  }
}

/** Builds enriched base for Public Web (needs SEC/CMS context). */
async function buildEnrichedBaseForPublicWeb(
  base: SearchResponse,
  plan: SourcePlan,
): Promise<SearchResponse> {
  let prospects = base.prospects;
  const primary = plannedPrimaryProviders(plan);
  for (const p of primary) {
    const r = await runProviderPhase(p, { query: base.query, prospects });
    prospects = mergeProspectLists(prospects, r.prospects);
  }
  return { query: base.query, prospects };
}

/** Runs primary providers in parallel, then secondary (Public Web) sequentially. */
export async function enrichWithLiveProviders(
  base: SearchResponse,
  plan: SourcePlan,
): Promise<SearchResponse> {
  const primary = plannedPrimaryProviders(plan);
  const secondary = plannedSecondaryProviders(plan);

  let prospects = base.prospects;

  if (primary.length > 0) {
    const results = await Promise.all(
      primary.map((p) => runProviderPhase(p, base)),
    );
    for (const r of results) {
      prospects = mergeProspectLists(prospects, r.prospects);
    }
  }

  if (secondary.includes("public-web")) {
    const interim: SearchResponse = { query: base.query, prospects };
    const r = await runProviderPhase("public-web", interim);
    prospects = mergeProspectLists(prospects, r.prospects);
  }

  return { query: base.query, prospects };
}

/** Provider phase for Public Web with primary enrichment on server. */
export async function runPublicWebPhase(
  base: SearchResponse,
  plan: SourcePlan,
): Promise<ProviderPhaseResult> {
  const enriched = await buildEnrichedBaseForPublicWeb(base, plan);
  return runProviderPhase("public-web", enriched);
}
