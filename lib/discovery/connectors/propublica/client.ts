import {
  cacheKey,
  recordCacheHit,
  recordCacheMiss,
  TtlCache,
} from "./cache";
import type {
  ProPublicaClientOptions,
  ProPublicaOrganizationResponse,
  ProPublicaSearchResponse,
} from "./types";
import { einForApiPath } from "./normalize";

const BASE_URL = "https://projects.propublica.org/nonprofits/api/v2";
const MIN_INTERVAL_MS = 300;
const MAX_RETRIES = 3;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

let lastRequestAt = 0;
const searchCache = new TtlCache<ProPublicaSearchResponse>();
const orgCache = new TtlCache<ProPublicaOrganizationResponse>();

export interface ProPublicaRuntimeStatus {
  lastRequestAt: string | null;
  lastError: string | null;
  requestCount: number;
  totalLatencyMs: number;
}

const runtime: ProPublicaRuntimeStatus = {
  lastRequestAt: null,
  lastError: null,
  requestCount: 0,
  totalLatencyMs: 0,
};

export function getProPublicaRuntimeStatus(): ProPublicaRuntimeStatus {
  return { ...runtime };
}

export function getProPublicaCacheSize(): number {
  return searchCache.size() + orgCache.size();
}

export function resetProPublicaForTests(): void {
  searchCache.clear();
  orgCache.clear();
  runtime.lastRequestAt = null;
  runtime.lastError = null;
  runtime.requestCount = 0;
  runtime.totalLatencyMs = 0;
  lastRequestAt = 0;
}

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

async function fetchJson<T>(
  url: string,
  fetchImpl: typeof fetch,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    await throttle();
    const started = performance.now();
    try {
      const res = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      runtime.requestCount += 1;
      runtime.totalLatencyMs += performance.now() - started;
      runtime.lastRequestAt = new Date().toISOString();

      if (res.ok) {
        runtime.lastError = null;
        return (await res.json()) as T;
      }
      if (!RETRYABLE.has(res.status) || attempt === MAX_RETRIES) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `ProPublica API ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
        );
      }
      await new Promise((r) => setTimeout(r, Math.min(2_000 * 2 ** attempt, 8_000)));
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      runtime.lastError = lastError.message;
      if (attempt === MAX_RETRIES) throw lastError;
      await new Promise((r) => setTimeout(r, Math.min(2_000 * 2 ** attempt, 8_000)));
    }
  }
  throw lastError ?? new Error("ProPublica request failed");
}

export class ProPublicaClient {
  private readonly fetchImpl: typeof fetch;

  constructor(options: ProPublicaClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async searchOrganizations(input: {
    query?: string;
    state?: string | null;
    city?: string | null;
    page?: number;
  }): Promise<ProPublicaSearchResponse> {
    const key = cacheKey({
      type: "search",
      q: input.query ?? "",
      state: input.state ?? "",
      city: input.city ?? "",
      page: String(input.page ?? 0),
    });

    const cached = searchCache.get(key);
    if (cached) {
      recordCacheHit();
      return cached;
    }
    recordCacheMiss();

    const params = new URLSearchParams();
    if (input.query?.trim()) params.set("q", input.query.trim());
    if (input.state?.trim()) params.set("state[id]", input.state.trim().toUpperCase());
    if (input.page != null) params.set("page", String(input.page));

    const url = `${BASE_URL}/search.json?${params.toString()}`;
    const data = await fetchJson<ProPublicaSearchResponse>(url, this.fetchImpl);
    searchCache.set(key, data);
    return data;
  }

  async fetchOrganization(ein: string | number): Promise<ProPublicaOrganizationResponse> {
    const pathEin = einForApiPath(ein);
    const key = cacheKey({ type: "org", ein: pathEin });

    const cached = orgCache.get(key);
    if (cached) {
      recordCacheHit();
      return cached;
    }
    recordCacheMiss();

    const url = `${BASE_URL}/organizations/${pathEin}.json`;
    const data = await fetchJson<ProPublicaOrganizationResponse>(url, this.fetchImpl);
    orgCache.set(key, data);
    return data;
  }
}

let defaultClient: ProPublicaClient | null = null;

export function getProPublicaClient(
  options?: ProPublicaClientOptions,
): ProPublicaClient {
  if (!options) {
    if (!defaultClient) defaultClient = new ProPublicaClient();
    return defaultClient;
  }
  return new ProPublicaClient(options);
}

export function averageProPublicaLatencyMs(): number {
  if (runtime.requestCount === 0) return 0;
  return Math.round(runtime.totalLatencyMs / runtime.requestCount);
}
