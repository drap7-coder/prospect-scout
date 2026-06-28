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
import {
  ensureErisaIndexHydrated,
  kickoffErisaIndexHydration,
} from "@/lib/import/erisa/hydrateIndex";
import {
  ensureHealthPlanIndexHydrated,
  kickoffHealthPlanIndexHydration,
} from "@/lib/import/healthPlans/hydrateIndex";
import { isHealthPlanPersistentSourceEnabled } from "@/lib/import/healthPlans/featureFlag";
import {
  discoverFromOrganizationWarehouse,
  shouldUseOrganizationWarehouse,
  isOrganizationWarehouseEnabled,
  resolveOrganizationWarehouseReadiness,
  type WarehouseReadiness,
} from "@/lib/import/warehouse";
import type { WarehouseDiscoveryInfo } from "./coverage";

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
  kickoffErisaIndexHydration();
  if (isHealthPlanPersistentSourceEnabled()) {
    kickoffHealthPlanIndexHydration();
  }
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
  await ensureErisaIndexHydrated();
  const readiness = await resolveOrganizationWarehouseReadiness();
  if (!readiness.useWarehouse && isHealthPlanPersistentSourceEnabled()) {
    await ensureHealthPlanIndexHydrated();
  }
  getConnectors();
  const intent = parseSearchIntent(query, options);
  const maxResults = options.maxResults ?? 500;

  if (readiness.useWarehouse) {
    const started = performance.now();
    const warehouseMax = options.maxResults ?? 5000;
    const result = discoverFromOrganizationWarehouse(intent, { maxResults: warehouseMax });
    return {
      intent,
      organizations: result.organizations,
      totalBeforeDedupe: result.totalMatching,
      totalAfterRank: result.totalAfterFilter,
      totalReturned: result.totalReturned,
      latencyMs: Math.round((performance.now() - started) * 100) / 100,
    };
  }

  const connectorIds = options.connectors ?? [...DISCOVERY_V2_CONNECTOR_IDS];
  return runDiscoveryPipelineV2Wrapped(intent, connectorIds, maxResults);
}

export function discoverOrganizationsSync(
  query: string,
  options: DiscoverOptions = {},
): DiscoverResult {
  initDiscoveryEngine();
  getConnectors();
  const intent = parseSearchIntent(query, options);
  const maxResults = options.maxResults ?? 500;

  if (shouldUseOrganizationWarehouse()) {
    const started = performance.now();
    const warehouseMax = options.maxResults ?? 5000;
    const result = discoverFromOrganizationWarehouse(intent, { maxResults: warehouseMax });
    return {
      intent,
      organizations: result.organizations,
      totalBeforeDedupe: result.totalMatching,
      totalAfterRank: result.totalAfterFilter,
      totalReturned: result.totalReturned,
      latencyMs: Math.round((performance.now() - started) * 100) / 100,
    };
  }

  const connectorIds = options.connectors ?? [...DISCOVERY_V2_CONNECTOR_IDS];
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

function warehouseDiscoveryInfo(readiness: WarehouseReadiness): WarehouseDiscoveryInfo {
  return {
    status: readiness.status,
    indexSize: readiness.indexSize,
    hydrationAttemptedAt: readiness.hydrationAttemptedAt,
    reason: readiness.reason,
  };
}

function discoverOrganizationsStagedWithReadiness(
  readiness: WarehouseReadiness,
  query: string,
  options: DiscoverOptions = {},
): StagedDiscoverResult {
  initDiscoveryEngine();
  getConnectors();

  const intent = parseSearchIntent(query, options);
  const maxResults = options.maxResults ?? 500;
  const started = performance.now();
  const warehouseMeta = warehouseDiscoveryInfo(readiness);

  if (readiness.useWarehouse) {
    const warehouseMax = options.maxResults ?? 5000;
    const result = discoverFromOrganizationWarehouse(intent, { maxResults: warehouseMax });
    const metadata: DiscoveryMetadata = {
      resultCount: result.totalAfterFilter,
      threshold: DISCOVERY_THRESHOLD,
      coverageStatus: computeCoverageStatus(result.totalAfterFilter),
      stagesRun: ["organization-warehouse"],
      expanded: false,
      fallbackReason: null,
      sourceSummary: summarizeOrganizationSources(result.organizations),
      marketBenchmarkAvailable: marketBenchmarkAvailableForIntent(intent),
      warehouse: warehouseMeta,
    };
    return {
      intent,
      organizations: result.organizations,
      totalBeforeDedupe: result.totalMatching,
      totalAfterRank: result.totalAfterFilter,
      totalReturned: result.totalReturned,
      latencyMs: Math.round((performance.now() - started) * 100) / 100,
      metadata,
    };
  }

  const connectorIds = options.connectors ?? [...DISCOVERY_V2_CONNECTOR_IDS];

  const stagesRun: string[] = readiness.status.startsWith("bootstrap")
    ? ["bootstrap-fallback", "multi-connector-discovery"]
    : ["multi-connector-discovery"];
  let result = runDiscoveryPipelineV2Wrapped(intent, connectorIds, maxResults);
  let expanded = false;
  let fallbackReason: string | null = readiness.reason;

  if (result.totalAfterRank < DISCOVERY_THRESHOLD) {
    const expansionNote = `Initial discovery returned ${result.totalAfterRank} of ${DISCOVERY_THRESHOLD} target results; expanded with relaxed geography and industry filters.`;
    fallbackReason = fallbackReason
      ? `${fallbackReason} ${expansionNote}`
      : expansionNote;
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
    warehouse: warehouseMeta,
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

/**
 * Request-time staged discovery — awaits warehouse hydration before routing.
 */
export async function discoverOrganizationsStagedAsync(
  query: string,
  options: DiscoverOptions = {},
): Promise<StagedDiscoverResult> {
  initDiscoveryEngine();
  await ensureErisaIndexHydrated();
  const readiness = await resolveOrganizationWarehouseReadiness();
  return discoverOrganizationsStagedWithReadiness(readiness, query, options);
}

/**
 * Staged discovery v2: every connector contributes candidates independently,
 * then merge → dedupe → rank. Falls back to relaxed intent when below threshold.
 *
 * Sync path for tests/scripts with a pre-hydrated in-memory index only.
 * Production search must use {@link discoverOrganizationsStagedAsync}.
 */
export function discoverOrganizationsStaged(
  query: string,
  options: DiscoverOptions = {},
): StagedDiscoverResult {
  const readiness: WarehouseReadiness = shouldUseOrganizationWarehouse()
    ? {
        useWarehouse: true,
        status: "warehouse-hydrated",
        indexSize: 0,
        hydrationAttemptedAt: null,
        reason: null,
        hydration: null,
      }
    : {
        useWarehouse: false,
        status: isOrganizationWarehouseEnabled() ? "bootstrap-fallback" : "disabled",
        indexSize: 0,
        hydrationAttemptedAt: null,
        reason: isOrganizationWarehouseEnabled()
          ? "Warehouse index empty in this process (hydration not awaited)"
          : null,
        hydration: null,
      };
  return discoverOrganizationsStagedWithReadiness(readiness, query, options);
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
