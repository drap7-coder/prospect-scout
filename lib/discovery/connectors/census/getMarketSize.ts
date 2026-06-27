import { aggregateCbpRows, cbpQueryParamsFromMarketQuery, geographyFromQuery } from "./cbp";
import { cacheKey, TtlCache } from "./cache";
import { CBP_YEAR, getCensusClient, getCensusRuntimeStatus } from "./client";
import { normalizeNaicsCode } from "./naics";
import type {
  CensusConnectorStatus,
  MarketSizeQuery,
  MarketSizeResult,
} from "./types";

const resultCache = new TtlCache<MarketSizeResult>();

export function computeMarketCoveragePercent(
  indexedOrganizations: number,
  estimatedEstablishments: number | null,
): number | null {
  if (estimatedEstablishments == null || estimatedEstablishments <= 0) return null;
  const pct = (indexedOrganizations / estimatedEstablishments) * 100;
  return Math.round(Math.min(pct, 100) * 10) / 10;
}

/**
 * Fetch County Business Patterns market sizing for a geography + NAICS slice.
 * Census establishments are used for analytics only — never ingested as orgs.
 */
export async function getMarketSize(
  query: MarketSizeQuery,
): Promise<MarketSizeResult> {
  const naics = normalizeNaicsCode(query.naics);
  const key = cacheKey({
    fn: "getMarketSize",
    naics,
    state: query.state ?? "",
    county: query.county ?? "",
    zip: query.zip ?? "",
  });

  const cached = resultCache.get(key);
  if (cached) return { ...cached, cached: true };

  const client = getCensusClient();
  const geography = geographyFromQuery(query);

  if (!client.isConfigured()) {
    return {
      estimatedEstablishments: null,
      employment: null,
      annualPayroll: null,
      naicsDescription: null,
      geography,
      naics,
      year: CBP_YEAR,
      source: "census-cbp",
      cached: false,
      available: false,
      error: "CENSUS_API_KEY is not configured",
    };
  }

  try {
    const rows = await client.fetchCbp(cbpQueryParamsFromMarketQuery({ ...query, naics }));
    const agg = aggregateCbpRows(rows);
    const result: MarketSizeResult = {
      estimatedEstablishments: agg.estimatedEstablishments,
      employment: agg.employment,
      annualPayroll: agg.annualPayroll,
      naicsDescription: agg.naicsDescription,
      geography: geographyFromQuery({ ...query, name: agg.name }),
      naics,
      year: CBP_YEAR,
      source: "census-cbp",
      cached: false,
      available: true,
    };
    resultCache.set(key, result);
    return result;
  } catch (err) {
    return {
      estimatedEstablishments: null,
      employment: null,
      annualPayroll: null,
      naicsDescription: null,
      geography,
      naics,
      year: CBP_YEAR,
      source: "census-cbp",
      cached: false,
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Diagnostics snapshot for the Census CBP analytics connector. */
export async function getCensusConnectorStatus(): Promise<CensusConnectorStatus> {
  const client = getCensusClient();
  const runtime = getCensusRuntimeStatus();
  let sampleMarketSize: MarketSizeResult | null = null;

  if (client.isConfigured()) {
    sampleMarketSize = await getMarketSize({ state: "OH", naics: "31" });
  }

  return {
    connectorId: "census-cbp",
    label: "Census County Business Patterns",
    configured: client.isConfigured(),
    lastQueryAt: runtime.lastQueryAt,
    lastError: runtime.lastError,
    cacheEntries: resultCache.size(),
    sampleMarketSize,
  };
}

export function resetMarketSizeCacheForTests(): void {
  resultCache.clear();
}
