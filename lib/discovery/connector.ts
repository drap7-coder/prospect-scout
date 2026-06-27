import type { Organization, OrganizationSource } from "./organization";
import type { SearchIntent } from "./intent";

/** Raw record from a connector before normalization. */
export type ConnectorRecord = Record<string, unknown>;

/**
 * Unified discovery connector interface.
 * Every data source implements discover → normalize → merge → enrich.
 */
export interface DiscoveryConnector {
  id: string;
  label: string;
  /** Find candidate records matching the search intent. */
  discover(intent: SearchIntent): Promise<ConnectorRecord[]> | ConnectorRecord[];
  /** Normalize a raw record into the canonical Organization schema. */
  normalize(record: ConnectorRecord): Organization;
  /** Merge an incoming org into an existing one. */
  merge(existing: Organization, incoming: Organization): Organization;
  /** Optional async enrichment (signals, filings, etc.) — returns same org with more sources. */
  enrich?(org: Organization, intent: SearchIntent): Promise<Organization>;
}

/** Default merge delegates to mergeOrganizations. */
export { mergeOrganizations as defaultMerge } from "./organization";

export function sourceStamp(
  connector: string,
  sourceId: string,
  evidence: string[],
  extras: Partial<
    Pick<
      OrganizationSource,
      "sourceName" | "sourceUrl" | "lastUpdated" | "confidence"
    >
  > = {},
): OrganizationSource {
  return {
    connector,
    sourceId,
    retrievedAt: new Date().toISOString(),
    evidence,
    ...extras,
  };
}

const registry: DiscoveryConnector[] = [];

export function registerConnector(connector: DiscoveryConnector): void {
  const idx = registry.findIndex((c) => c.id === connector.id);
  if (idx >= 0) registry[idx] = connector;
  else registry.push(connector);
}

export function getConnectors(): DiscoveryConnector[] {
  return [...registry];
}

export function getConnector(id: string): DiscoveryConnector | undefined {
  return registry.find((c) => c.id === id);
}
