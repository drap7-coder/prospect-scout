import { getConnector, getConnectors, type DiscoveryConnector } from "./connector";
import { discoverFromCatalogIndex, getCatalogIndex, orgMatchesIntent } from "./catalog/catalogIndex";
import type { Organization } from "./organization";
import type { SearchIntent } from "./intent";
import {
  filterOrganizationsByQueryText,
  organizationMatchesQueryText,
} from "./queryDiscovery";
import { ERISA_CONNECTOR_ID } from "@/lib/import/erisa/types";
import { dedupeOrganizationsByMergeKeys } from "./mergeKeys";
import {
  rankOrganizations,
  filterIncompatibleOrganizations,
  limitResults,
  type RankedOrganization,
} from "./rank";

/** All connectors that independently contribute discovery candidates. */
export const DISCOVERY_V2_CONNECTOR_IDS = [
  "directory",
  "sec",
  "fda",
  "cms",
  "aca-marketplace",
  "irs-nonprofits",
  "nces",
  "rss",
  "public-web",
  "wikipedia",
  "state-registry",
  "business-directory",
  "erisa",
] as const;

export type DiscoveryV2ConnectorId = (typeof DISCOVERY_V2_CONNECTOR_IDS)[number];

export interface ConnectorDiscoveryResult {
  connectorId: string;
  label: string;
  candidateCount: number;
  organizations: Organization[];
}

export interface DiscoveryV2Diagnostics {
  /** Candidates returned by each connector before merge. */
  connectorCandidates: Record<string, number>;
  /** Human labels for connectors in diagnostics output. */
  connectorLabels: Record<string, string>;
  mergedUnique: number;
  rankedCount: number;
  displayedCount: number;
}

export interface DiscoveryV2Result {
  organizations: RankedOrganization[];
  diagnostics: DiscoveryV2Diagnostics;
  totalBeforeDedupe: number;
  totalAfterRank: number;
  totalReturned: number;
}

const CONNECTOR_LABELS: Record<string, string> = {
  directory: "Directory",
  sec: "SEC",
  fda: "FDA",
  cms: "CMS",
  "aca-marketplace": "ACA Marketplace",
  "irs-nonprofits": "IRS Nonprofits",
  nces: "NCES",
  rss: "RSS",
  "public-web": "Public Web",
  wikipedia: "Wikipedia",
  "state-registry": "State Registry",
  "business-directory": "Business Directory",
  erisa: "ERISA",
};

function connectorLabel(id: string): string {
  return CONNECTOR_LABELS[id] ?? getConnector(id)?.label ?? id;
}

function normalizeConnectorRecords(
  connector: DiscoveryConnector,
  intent: SearchIntent,
): Organization[] {
  const raw = connector.discover(intent);
  const records = Array.isArray(raw) ? raw : [];
  return records.map((record) => connector.normalize(record));
}

function intentGuard(intent: SearchIntent): boolean {
  return Boolean(
    intent.sectorId ||
      intent.industryId ||
      intent.organizationTypeId ||
      intent.state ||
      intent.city ||
      intent.region !== "any",
  );
}

function filterConnectorResults(
  orgs: Organization[],
  intent: SearchIntent,
): Organization[] {
  if (!intentGuard(intent)) return orgs;
  return orgs.filter(
    (org) =>
      orgMatchesIntent(org, intent) || organizationMatchesQueryText(org, intent),
  );
}

function discoverFromConnectorCatalog(
  intent: SearchIntent,
  connectorId: string,
): Organization[] {
  const structured = discoverFromCatalogIndex(intent, [connectorId]);
  if (structured.length > 0) return structured;

  const index = getCatalogIndex();
  const indices = index.byConnector.get(connectorId) ?? [];
  if (indices.length === 0) return [];

  const pool = indices.map((i) => index.orgs[i]!);
  return filterOrganizationsByQueryText(pool, intent);
}

function discoverFromConnector(
  intent: SearchIntent,
  connectorId: string,
): ConnectorDiscoveryResult {
  const catalogHits = discoverFromConnectorCatalog(intent, connectorId);
  const connector = getConnector(connectorId);
  const registryHits = connector
    ? normalizeConnectorRecords(connector, intent)
    : [];

  const pool = [...catalogHits, ...registryHits];
  const filtered =
    connectorId === ERISA_CONNECTOR_ID
      ? pool
      : filterConnectorResults(pool, intent);
  const combined = dedupeOrganizationsByMergeKeys(filtered);

  return {
    connectorId,
    label: connectorLabel(connectorId),
    candidateCount: combined.length,
    organizations: combined,
  };
}

/**
 * Discovery Engine v2 — every connector independently contributes candidates.
 * Normalize → merge → dedupe → rank. Ranking never suppresses discovery.
 */
export function runDiscoveryPipelineV2(
  intent: SearchIntent,
  options: {
    connectorIds?: readonly string[];
    maxResults?: number;
    skipQualityFilter?: boolean;
  } = {},
): DiscoveryV2Result {
  const connectorIds = options.connectorIds ?? DISCOVERY_V2_CONNECTOR_IDS;
  const maxResults = options.maxResults ?? 500;

  const connectorCandidates: Record<string, number> = {};
  const connectorLabels: Record<string, string> = {};
  let pool: Organization[] = [];

  for (const connectorId of connectorIds) {
    const result = discoverFromConnector(intent, connectorId);
    connectorCandidates[connectorId] = result.candidateCount;
    connectorLabels[connectorId] = result.label;
    pool = pool.concat(result.organizations);
  }

  const totalBeforeDedupe = pool.length;
  const merged = dedupeOrganizationsByMergeKeys(pool);
  const ranked = rankOrganizations(merged, intent);
  const filtered = options.skipQualityFilter
    ? ranked
    : filterIncompatibleOrganizations(ranked, intent);
  const limited = limitResults(filtered, maxResults);

  return {
    organizations: limited,
    diagnostics: {
      connectorCandidates,
      connectorLabels,
      mergedUnique: merged.length,
      rankedCount: filtered.length,
      displayedCount: limited.length,
    },
    totalBeforeDedupe,
    totalAfterRank: filtered.length,
    totalReturned: limited.length,
  };
}

/** Ensure registry connectors are loaded (side-effect init). */
export function ensureDiscoveryConnectorsRegistered(): void {
  getConnectors();
}
