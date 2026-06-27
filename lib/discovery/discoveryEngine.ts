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
import type { Organization } from "./organization";
import type { SearchIntent } from "./intent";
import { ANY_REGION } from "@/lib/search/regions";
import {
  DISCOVERY_THRESHOLD,
  computeCoverageStatus,
  type DiscoveryMetadata,
} from "./coverage";

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

export interface StagedDiscoverResult extends DiscoverResult {
  metadata: DiscoveryMetadata;
}

const BENCHMARK_SECTORS = new Set([
  "healthcare",
  "manufacturing",
  "financial-services",
  "education",
  "public-sector",
  "nonprofit",
  "retail-consumer",
  "technology",
]);
const BENCHMARK_INDUSTRIES = new Set([
  "payers",
  "providers",
  "life-sciences",
  "food-beverage",
  "packaging",
  "chemicals",
  "automotive",
  "banks",
  "fintech",
  "universities",
  "retail",
  "software",
]);

/** Whether a Census market benchmark scope exists for this intent (sync, no network). */
function marketBenchmarkAvailableForIntent(intent: SearchIntent): boolean {
  if (intent.industryId && BENCHMARK_INDUSTRIES.has(intent.industryId)) return true;
  if (intent.sectorId && BENCHMARK_SECTORS.has(intent.sectorId)) return true;
  return /\b(manufactur|factory|plant|hospital|health system|provider|clinic|health plan|payer|insurer|mco|medicare|medicaid|bank|credit union|financial|universit|college|school|retail|store|grocery)\b/.test(
    intent.query.toLowerCase(),
  );
}

/**
 * Progressively relaxed intents for fallback expansion. Geography of a selected
 * state and the organization-type / health-plan-subtype guards are always
 * preserved so the domain stays pure (e.g. a health-plan search never widens to
 * hospitals or PBMs).
 */
function buildRelaxedIntents(intent: SearchIntent): SearchIntent[] {
  const out: SearchIntent[] = [];
  const hasTypeGuard = Boolean(intent.organizationTypeId);

  if (intent.city) {
    out.push({ ...intent, city: null });
  }
  if (intent.industryId || intent.alternateIndustryIds.length > 0) {
    out.push({
      ...intent,
      city: null,
      industryId: null,
      alternateIndustryIds: [],
    });
  }
  // Only drop the sector guard when org type still pins the domain.
  if (hasTypeGuard && (intent.sectorId || intent.industryId)) {
    out.push({
      ...intent,
      city: null,
      industryId: null,
      alternateIndustryIds: [],
      sectorId: null,
      alternateSectorIds: [],
    });
  }
  // Widen geography only when no specific state was requested.
  if (intent.region !== ANY_REGION && !intent.state) {
    const last = out[out.length - 1] ?? intent;
    out.push({ ...last, region: ANY_REGION });
  }

  return out;
}

function uniqueByIdCount(orgs: Organization[]): number {
  return new Set(orgs.map((o) => o.id)).size;
}

/**
 * Staged discovery: catalog first, then domain-safe fallback expansion when the
 * initial pass is below threshold. Never fabricates organizations and never
 * blocks on network calls. Returns coverage metadata for the API/UI.
 */
export function discoverOrganizationsStaged(
  query: string,
  options: DiscoverOptions = {},
): StagedDiscoverResult {
  initDiscoveryEngine();
  getConnectors();

  const intent = parseSearchIntent(query, options);
  const connectorIds = options.connectors ?? [...LISTING_CONNECTOR_IDS];
  const maxResults = options.maxResults ?? 500;
  const started = performance.now();

  const stagesRun: string[] = ["catalog"];
  let pool = discoverFromCatalogIndex(intent, connectorIds);
  const catalogCount = uniqueByIdCount(pool);

  let expanded = false;
  let fallbackReason: string | null = null;

  if (catalogCount < DISCOVERY_THRESHOLD) {
    fallbackReason = `Catalog returned ${catalogCount} of ${DISCOVERY_THRESHOLD} target results; expanded with relaxed geography and industry filters.`;
    for (const relaxed of buildRelaxedIntents(intent)) {
      const more = discoverFromCatalogIndex(relaxed, connectorIds);
      if (more.length > 0) pool = pool.concat(more);
      if (uniqueByIdCount(pool) >= DISCOVERY_THRESHOLD) break;
    }
    expanded = uniqueByIdCount(pool) > catalogCount;
    if (expanded) stagesRun.push("connector-expansion", "merge-rank");
  }

  const deduped = dedupeOrganizations(pool);
  const ranked = rankOrganizations(deduped, intent);
  // Relaxed passes already enforce org-type/state purity; only hard-filter the
  // unexpanded catalog pass to preserve existing single-stage behavior.
  const filtered = expanded
    ? ranked
    : filterIncompatibleOrganizations(ranked, intent);
  const limited = limitResults(filtered, maxResults);

  const marketBenchmarkAvailable = marketBenchmarkAvailableForIntent(intent);
  if (filtered.length === 0 && marketBenchmarkAvailable) {
    stagesRun.push("market-benchmark");
  }

  const metadata: DiscoveryMetadata = {
    resultCount: filtered.length,
    threshold: DISCOVERY_THRESHOLD,
    coverageStatus: computeCoverageStatus(filtered.length),
    stagesRun,
    expanded,
    fallbackReason,
    sourceSummary: summarizeOrganizationSources(limited),
    marketBenchmarkAvailable,
  };

  return {
    intent,
    organizations: limited,
    totalBeforeDedupe: pool.length,
    totalAfterRank: filtered.length,
    totalReturned: limited.length,
    latencyMs: Math.round((performance.now() - started) * 100) / 100,
    metadata,
  };
}

function summarizeOrganizationSources(
  orgs: Organization[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const org of orgs) {
    const seen = new Set<string>();
    for (const src of org.sources) {
      if (seen.has(src.connector)) continue;
      seen.add(src.connector);
      counts[src.connector] = (counts[src.connector] ?? 0) + 1;
    }
  }
  return counts;
}
