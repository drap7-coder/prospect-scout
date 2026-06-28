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
import { erisaConnector } from "./connectors/erisaConnector";
import {
  wikipediaConnector,
  stateRegistryConnector,
  businessDirectoryConnector,
} from "./connectors/discoveryV2Connectors";
import {
  runDiscoveryPipelineV2,
  DISCOVERY_V2_CONNECTOR_IDS,
} from "./discoveryPipelineV2";
import { discoverFromCatalogIndex } from "./catalog/catalogIndex";
import { dedupeOrganizations, type Organization } from "./organization";
import { parseSearchIntent, type ParseSearchIntentOptions } from "./intent";
import type { SearchIntent } from "./intent";
import {
  rankOrganizations,
  filterIncompatibleOrganizations,
  limitResults,
  type RankedOrganization,
} from "./rank";
import { ANY_REGION } from "@/lib/search/regions";
import {
  DISCOVERY_THRESHOLD,
  computeCoverageStatus,
  type DiscoveryMetadata,
} from "./coverage";

let initialized = false;

/** @deprecated Use DISCOVERY_V2_CONNECTOR_IDS — kept for backward compatibility. */
export const LISTING_CONNECTOR_IDS = DISCOVERY_V2_CONNECTOR_IDS;

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
  registerConnector(wikipediaConnector);
  registerConnector(stateRegistryConnector);
  registerConnector(businessDirectoryConnector);
  registerConnector(erisaConnector);
  initialized = true;
}

export interface DiscoverOptions extends ParseSearchIntentOptions {
  connectors?: string[];
  maxResults?: number;
}

export interface DiscoverResult {
  intent: ReturnType<typeof parseSearchIntent>;
  organizations: RankedOrganization[];
  totalBeforeDedupe: number;
  totalAfterRank: number;
  totalReturned: number;
  latencyMs: number;
}

function runDiscoveryPipelineV2Wrapped(
  intent: SearchIntent,
  connectorIds: readonly string[],
  maxResults: number,
  skipQualityFilter = false,
): DiscoverResult & { diagnostics: ReturnType<typeof runDiscoveryPipelineV2>["diagnostics"] } {
  const started = performance.now();
  const result = runDiscoveryPipelineV2(intent, {
    connectorIds,
    maxResults,
    skipQualityFilter,
  });
  return {
    intent,
    organizations: result.organizations,
    totalBeforeDedupe: result.totalBeforeDedupe,
    totalAfterRank: result.totalAfterRank,
    totalReturned: result.totalReturned,
    latencyMs: Math.round((performance.now() - started) * 100) / 100,
    diagnostics: result.diagnostics,
  };
}

export async function discoverOrganizations(
  query: string,
  options: DiscoverOptions = {},
): Promise<DiscoverResult> {
  initDiscoveryEngine();
  getConnectors();
  const intent = parseSearchIntent(query, options);
  const connectorIds = options.connectors ?? [...DISCOVERY_V2_CONNECTOR_IDS];
  const maxResults = options.maxResults ?? 500;
  return runDiscoveryPipelineV2Wrapped(intent, connectorIds, maxResults);
}

export function discoverOrganizationsSync(
  query: string,
  options: DiscoverOptions = {},
): DiscoverResult {
  initDiscoveryEngine();
  getConnectors();
  const intent = parseSearchIntent(query, options);
  const connectorIds = options.connectors ?? [...DISCOVERY_V2_CONNECTOR_IDS];
  const maxResults = options.maxResults ?? 500;
  return runDiscoveryPipelineV2Wrapped(intent, connectorIds, maxResults);
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

function marketBenchmarkAvailableForIntent(intent: SearchIntent): boolean {
  if (intent.industryId && BENCHMARK_INDUSTRIES.has(intent.industryId)) return true;
  if (intent.sectorId && BENCHMARK_SECTORS.has(intent.sectorId)) return true;
  return /\b(manufactur|factory|plant|hospital|health system|provider|clinic|health plan|payer|insurer|mco|medicare|medicaid|bank|credit union|financial|universit|college|school|retail|store|grocery)\b/.test(
    intent.query.toLowerCase(),
  );
}

function buildRelaxedIntents(intent: SearchIntent): SearchIntent[] {
  const out: SearchIntent[] = [];
  const hasTypeGuard = Boolean(intent.organizationTypeId);

  if (intent.city) out.push({ ...intent, city: null });
  if (intent.industryId || intent.alternateIndustryIds.length > 0) {
    out.push({
      ...intent,
      city: null,
      industryId: null,
      alternateIndustryIds: [],
    });
  }
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
  if (intent.region !== ANY_REGION && !intent.state) {
    const last = out[out.length - 1] ?? intent;
    out.push({ ...last, region: ANY_REGION });
  }
  return out;
}

/**
 * Staged discovery v2: every connector contributes candidates independently,
 * then merge → dedupe → rank. Falls back to relaxed intent when below threshold.
 */
export function discoverOrganizationsStaged(
  query: string,
  options: DiscoverOptions = {},
): StagedDiscoverResult {
  initDiscoveryEngine();
  getConnectors();

  const intent = parseSearchIntent(query, options);
  const connectorIds = options.connectors ?? [...DISCOVERY_V2_CONNECTOR_IDS];
  const maxResults = options.maxResults ?? 500;
  const started = performance.now();

  const stagesRun: string[] = ["multi-connector-discovery"];
  let result = runDiscoveryPipelineV2Wrapped(intent, connectorIds, maxResults);
  let expanded = false;
  let fallbackReason: string | null = null;

  if (result.totalAfterRank < DISCOVERY_THRESHOLD) {
    fallbackReason = `Initial discovery returned ${result.totalAfterRank} of ${DISCOVERY_THRESHOLD} target results; expanded with relaxed geography and industry filters.`;
    for (const relaxed of buildRelaxedIntents(intent)) {
      const relaxedResult = runDiscoveryPipelineV2Wrapped(
        relaxed,
        connectorIds,
        maxResults,
        true,
      );
      if (relaxedResult.totalAfterRank > result.totalAfterRank) {
        result = relaxedResult;
        expanded = true;
        stagesRun.push("relaxed-intent", "merge-rank");
      }
      if (result.totalAfterRank >= DISCOVERY_THRESHOLD) break;
    }
  }

  const marketBenchmarkAvailable = marketBenchmarkAvailableForIntent(intent);
  if (result.totalAfterRank === 0 && marketBenchmarkAvailable) {
    stagesRun.push("market-benchmark");
  }

  const metadata: DiscoveryMetadata = {
    resultCount: result.totalAfterRank,
    threshold: DISCOVERY_THRESHOLD,
    coverageStatus: computeCoverageStatus(result.totalAfterRank),
    stagesRun,
    expanded,
    fallbackReason,
    sourceSummary: summarizeOrganizationSources(result.organizations),
    connectorCandidates: result.diagnostics.connectorCandidates,
    mergedUnique: result.diagnostics.mergedUnique,
    marketBenchmarkAvailable,
  };

  return {
    intent: result.intent,
    organizations: result.organizations,
    totalBeforeDedupe: result.totalBeforeDedupe,
    totalAfterRank: result.totalAfterRank,
    totalReturned: result.totalReturned,
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

/** Legacy catalog-only pipeline (tests / diagnostics). */
export function discoverFromCatalogOnly(
  intent: SearchIntent,
  connectorIds: readonly string[],
  maxResults: number,
): DiscoverResult {
  const started = performance.now();
  const candidates = discoverFromCatalogIndex(intent, [...connectorIds]);
  const deduped = dedupeOrganizations(candidates);
  const ranked = rankOrganizations(deduped, intent);
  const filtered = filterIncompatibleOrganizations(ranked, intent);
  const limited = limitResults(filtered, maxResults);
  return {
    intent,
    organizations: limited,
    totalBeforeDedupe: candidates.length,
    totalAfterRank: filtered.length,
    totalReturned: limited.length,
    latencyMs: Math.round((performance.now() - started) * 100) / 100,
  };
}
