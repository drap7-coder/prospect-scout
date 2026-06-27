import type { ProPublicaClient } from "./client";
import {
  averageProPublicaLatencyMs,
  getProPublicaClient,
  getProPublicaCacheSize,
  getProPublicaRuntimeStatus,
} from "./client";
import { cacheHitRate } from "./cache";
import {
  ENRICHMENT_CONFIDENCE_THRESHOLD,
  scoreNonprofitMatch,
} from "./confidence";
import {
  einForApiPath,
  normalizeEinDigits,
  normalizeOrganizationEnrichment,
  normalizeSearchCandidate,
} from "./normalize";
import type {
  NonprofitEnrichInput,
  NonprofitEnrichResult,
  ProPublicaConnectorStatus,
} from "./types";

function buildSearchQuery(input: NonprofitEnrichInput): string {
  if (input.name?.trim()) return input.name.trim();
  if (input.ein?.trim()) return normalizeEinDigits(input.ein);
  if (input.city?.trim()) return input.city.trim();
  return "";
}

/**
 * Search and enrich a nonprofit from ProPublica.
 * Used for optional enrichment — never mutates CatalogIndex.
 */
export async function enrichNonprofit(
  input: NonprofitEnrichInput,
  options?: { client?: ProPublicaClient },
): Promise<NonprofitEnrichResult> {
  const client = options?.client ?? getProPublicaClient();
  const base: NonprofitEnrichResult = {
    enrichment: null,
    candidates: [],
    confidence: 0,
    source: "propublica-nonprofit-explorer",
    available: true,
  };

  try {
    if (input.ein?.trim()) {
      const orgResponse = await client.fetchOrganization(input.ein);
      const enrichment = normalizeOrganizationEnrichment(orgResponse);
      const confidence = scoreNonprofitMatch(input, {
        ein: enrichment.ein,
        name: enrichment.legalName,
        city: enrichment.city,
        state: enrichment.state,
      });

      return {
        ...base,
        enrichment: confidence >= ENRICHMENT_CONFIDENCE_THRESHOLD ? enrichment : null,
        candidates: [
          normalizeSearchCandidate(
            {
              ein: Number(einForApiPath(enrichment.ein)),
              strein: enrichment.strein,
              name: enrichment.legalName,
              city: enrichment.city ?? undefined,
              state: enrichment.state ?? undefined,
              ntee_code: enrichment.nteeCode ?? undefined,
            },
            confidence,
          ),
        ],
        confidence,
      };
    }

    const query = buildSearchQuery(input);
    if (!query) {
      return { ...base, available: false, error: "Name, EIN, or city is required." };
    }

    const search = await client.searchOrganizations({
      query,
      state: input.state,
      city: input.city,
    });

    const candidates = (search.organizations ?? []).slice(0, 10).map((org) => {
      const confidence = scoreNonprofitMatch(input, org);
      return normalizeSearchCandidate(org, confidence);
    });

    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0];
    if (!best || best.confidence < ENRICHMENT_CONFIDENCE_THRESHOLD) {
      return {
        ...base,
        candidates,
        confidence: best?.confidence ?? 0,
      };
    }

    const orgResponse = await client.fetchOrganization(best.ein);
    const enrichment = normalizeOrganizationEnrichment(orgResponse);
    const confidence = scoreNonprofitMatch(input, {
      ein: enrichment.ein,
      name: enrichment.legalName,
      city: enrichment.city,
      state: enrichment.state,
    });

    return {
      ...base,
      enrichment: confidence >= ENRICHMENT_CONFIDENCE_THRESHOLD ? enrichment : null,
      candidates,
      confidence,
    };
  } catch (err) {
    return {
      ...base,
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Whether a catalog org is eligible for ProPublica enrichment. */
export function isNonprofitEnrichmentEligible(input: {
  canonicalOrganizationType?: string | null;
  sectorId?: string | null;
  ownership?: string | null;
}): boolean {
  return (
    input.canonicalOrganizationType === "nonprofit" ||
    input.sectorId === "nonprofit" ||
    input.ownership === "nonprofit"
  );
}

export async function getProPublicaConnectorStatus(): Promise<ProPublicaConnectorStatus> {
  const runtime = getProPublicaRuntimeStatus();
  let sampleResult: NonprofitEnrichResult | null = null;

  try {
    sampleResult = await enrichNonprofit({
      name: "Pro Publica",
      state: "NY",
    });
  } catch {
    sampleResult = null;
  }

  return {
    connectorId: "propublica-nonprofit-explorer",
    label: "ProPublica Nonprofit Explorer",
    configured: true,
    lastRequestAt: runtime.lastRequestAt,
    lastError: runtime.lastError,
    cacheEntries: getProPublicaCacheSize(),
    cacheHitRate: cacheHitRate(),
    averageLatencyMs: averageProPublicaLatencyMs(),
    sampleResult,
  };
}
