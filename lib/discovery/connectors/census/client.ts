import { cacheKey, TtlCache } from "./cache";
import type { CbpApiRow, CbpQueryParams, CensusClientOptions } from "./types";
import { buildCbpUrl, parseCbpResponse } from "./cbp";

const CBP_YEAR = 2023;
const MIN_INTERVAL_MS = 250;
const MAX_RETRIES = 3;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

let lastRequestAt = 0;

const cbpCache = new TtlCache<CbpApiRow[]>();

export interface CensusRuntimeStatus {
  lastQueryAt: string | null;
  lastError: string | null;
}

const runtime: CensusRuntimeStatus = {
  lastQueryAt: null,
  lastError: null,
};

export function getCensusRuntimeStatus(): CensusRuntimeStatus {
  return { ...runtime };
}

export function getCensusCacheSize(): number {
  return cbpCache.size();
}

export function resetCensusCacheForTests(): void {
  cbpCache.clear();
  runtime.lastQueryAt = null;
  runtime.lastError = null;
  lastRequestAt = 0;
}

function readApiKey(explicit?: string): string | null {
  const key = explicit ?? process.env.CENSUS_API_KEY?.trim();
  return key || null;
}

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

async function fetchWithRetry(
  url: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    await throttle();
    try {
      const res = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return res;
      if (!RETRYABLE.has(res.status) || attempt === MAX_RETRIES) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Census API ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
        );
      }
      const backoff = Math.min(2_000 * 2 ** attempt, 8_000);
      await new Promise((r) => setTimeout(r, backoff));
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_RETRIES) throw lastError;
      const backoff = Math.min(2_000 * 2 ** attempt, 8_000);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastError ?? new Error("Census request failed");
}

/** Typed Census Data API client (CBP). */
export class CensusClient {
  private readonly apiKey: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CensusClientOptions = {}) {
    this.apiKey = readApiKey(options.apiKey);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Fetch County Business Patterns rows for a geography + NAICS slice. */
  async fetchCbp(params: CbpQueryParams): Promise<CbpApiRow[]> {
    if (!this.apiKey) {
      throw new Error("CENSUS_API_KEY is not configured");
    }

    const key = cacheKey({
      dataset: "cbp",
      year: String(CBP_YEAR),
      naics: params.naics,
      state: params.stateFips ?? "",
      county: params.countyFips ?? "",
      zip: params.zip ?? "",
    });

    const cached = cbpCache.get(key);
    if (cached) return cached;

    const url = buildCbpUrl({
      year: CBP_YEAR,
      apiKey: this.apiKey,
      params,
    });

    runtime.lastQueryAt = new Date().toISOString();
    try {
      const res = await fetchWithRetry(url, this.fetchImpl);
      const json = (await res.json()) as unknown;
      const rows = parseCbpResponse(json);
      cbpCache.set(key, rows);
      runtime.lastError = null;
      return rows;
    } catch (err) {
      runtime.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }
}

let defaultClient: CensusClient | null = null;

export function getCensusClient(options?: CensusClientOptions): CensusClient {
  if (!options) {
    if (!defaultClient) defaultClient = new CensusClient();
    return defaultClient;
  }
  return new CensusClient(options);
}

export { CBP_YEAR };
