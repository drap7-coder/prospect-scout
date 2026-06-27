import { registerConnector, getConnectors } from "./connector";
import { directoryConnector } from "./connectors/directoryConnector";
import { ncesConnector } from "./connectors/ncesConnector";
import { secBulkConnector } from "./connectors/secBulkConnector";
import { cmsBulkConnector } from "./connectors/cmsBulkConnector";
import { fdaBulkConnector } from "./connectors/fdaBulkConnector";
import { irsNonprofitConnector } from "./connectors/irsNonprofitConnector";
import {
  rssConnector,
  publicWebConnector,
} from "./connectors/providerAdapters";
import { dedupeOrganizations } from "./organization";
import { parseSearchIntent, type ParseSearchIntentOptions } from "./intent";
import {
  rankOrganizations,
  filterIncompatibleOrganizations,
  limitResults,
  type RankedOrganization,
} from "./rank";
import { discoverFromCatalogIndex } from "./catalog/catalogIndex";

let initialized = false;

/** Authoritative listing connectors — RSS/public-web excluded by default. */
export const LISTING_CONNECTOR_IDS = [
  "directory",
  "cms",
  "aca-marketplace",
  "sec",
  "fda",
  "irs-nonprofits",
  "nces",
] as const;

/** Register all discovery connectors (idempotent). */
export function initDiscoveryEngine(): void {
  if (initialized) return;
  registerConnector(directoryConnector);
  registerConnector(ncesConnector);
  registerConnector(secBulkConnector);
  registerConnector(cmsBulkConnector);
  registerConnector(fdaBulkConnector);
  registerConnector(irsNonprofitConnector);
  registerConnector(rssConnector);
  registerConnector(publicWebConnector);
  initialized = true;
}

export interface DiscoverOptions extends ParseSearchIntentOptions {
  connectors?: string[];
  maxResults?: number;
}

export interface DiscoverResult {
  intent: ReturnType<typeof parseSearchIntent>;
  organizations: RankedOrganization[];
  /** Candidates from catalog index before dedupe. */
  totalBeforeDedupe: number;
  /** After ranking + quality filter, before pagination cap. */
  totalAfterRank: number;
  /** Returned after limitResults (pagination cap). */
  totalReturned: number;
  latencyMs: number;
}

function runDiscoveryPipeline(
  intent: ReturnType<typeof parseSearchIntent>,
  connectorIds: readonly string[],
  maxResults: number,
): DiscoverResult {
  const started = performance.now();

  const candidates = discoverFromCatalogIndex(intent, [...connectorIds]);
  const totalBeforeDedupe = candidates.length;
  const deduped = dedupeOrganizations(candidates);
  const ranked = rankOrganizations(deduped, intent);
  const filtered = filterIncompatibleOrganizations(ranked, intent);
  const limited = limitResults(filtered, maxResults);

  return {
    intent,
    organizations: limited,
    totalBeforeDedupe,
    totalAfterRank: filtered.length,
    totalReturned: limited.length,
    latencyMs: Math.round((performance.now() - started) * 100) / 100,
  };
}

export async function discoverOrganizations(
  query: string,
  options: DiscoverOptions = {},
): Promise<DiscoverResult> {
  initDiscoveryEngine();
  getConnectors();

  const intent = parseSearchIntent(query, options);
  const connectorIds = options.connectors ?? [...LISTING_CONNECTOR_IDS];
  const maxResults = options.maxResults ?? 500;

  return runDiscoveryPipeline(intent, connectorIds, maxResults);
}

export function discoverOrganizationsSync(
  query: string,
  options: DiscoverOptions = {},
): DiscoverResult {
  initDiscoveryEngine();
  getConnectors();

  const intent = parseSearchIntent(query, options);
  const connectorIds = options.connectors ?? [...LISTING_CONNECTOR_IDS];
  const maxResults = options.maxResults ?? 500;

  return runDiscoveryPipeline(intent, connectorIds, maxResults);
}
