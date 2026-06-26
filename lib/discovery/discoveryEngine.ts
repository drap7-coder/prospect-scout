import { registerConnector, getConnectors } from "./connector";
import { directoryConnector } from "./connectors/directoryConnector";
import {
  rssConnector,
  cmsConnector,
  fdaConnector,
  publicWebConnector,
  secConnector,
} from "./connectors/providerAdapters";
import { highValueDirectoryConnectors } from "./connectors/highValueDirectoryConnectors";
import { dedupeOrganizations } from "./organization";
import type { Organization } from "./organization";
import { parseSearchIntent, type ParseSearchIntentOptions } from "./intent";
import {
  rankOrganizations,
  filterIncompatibleOrganizations,
  type RankedOrganization,
} from "./rank";

let initialized = false;

/** Register all discovery connectors (idempotent). */
export function initDiscoveryEngine(): void {
  if (initialized) return;
  registerConnector(directoryConnector);
  registerConnector(rssConnector);
  registerConnector(cmsConnector);
  registerConnector(fdaConnector);
  registerConnector(publicWebConnector);
  registerConnector(secConnector);
  for (const connector of highValueDirectoryConnectors) {
    registerConnector(connector);
  }
  initialized = true;
}

export interface DiscoverOptions extends ParseSearchIntentOptions {
  /** Connector ids to use; default = core directory + first five high-value source directories. */
  connectors?: string[];
}

export interface DiscoverResult {
  intent: ReturnType<typeof parseSearchIntent>;
  organizations: RankedOrganization[];
  totalBeforeDedupe: number;
}

/**
 * Run organization discovery: parse intent → discover from connectors →
 * dedupe → rank → filter incompatible.
 */
export async function discoverOrganizations(
  query: string,
  options: DiscoverOptions = {},
): Promise<DiscoverResult> {
  initDiscoveryEngine();

  const intent = parseSearchIntent(query, options);
  const connectorIds = options.connectors ?? [
    "directory",
    "cms",
    "sec",
    "fda",
    "irs-nonprofits",
    "nces",
  ];
  const connectors = getConnectors().filter((c) => connectorIds.includes(c.id));

  const rawOrgs: Organization[] = [];

  for (const connector of connectors) {
    const records = await connector.discover(intent);
    for (const record of records) {
      try {
        rawOrgs.push(connector.normalize(record));
      } catch {
        // skip invalid records
      }
    }
  }

  const totalBeforeDedupe = rawOrgs.length;
  const deduped = dedupeOrganizations(rawOrgs);
  const ranked = rankOrganizations(deduped, intent);
  const filtered = filterIncompatibleOrganizations(ranked, intent);

  return {
    intent,
    organizations: filtered,
    totalBeforeDedupe,
  };
}

/**
 * Synchronous discovery for the local search pipeline (directory only).
 */
export function discoverOrganizationsSync(
  query: string,
  options: DiscoverOptions = {},
): DiscoverResult {
  initDiscoveryEngine();

  const intent = parseSearchIntent(query, options);
  const connectorIds = options.connectors ?? [
    "directory",
    "cms",
    "sec",
    "fda",
    "irs-nonprofits",
    "nces",
  ];
  const connectors = getConnectors().filter((c) => connectorIds.includes(c.id));

  const rawOrgs: Organization[] = [];

  for (const connector of connectors) {
    const records = connector.discover(intent);
    const list = records instanceof Promise ? [] : records;
    for (const record of list) {
      try {
        rawOrgs.push(connector.normalize(record));
      } catch {
        // skip invalid records
      }
    }
  }

  const totalBeforeDedupe = rawOrgs.length;
  const deduped = dedupeOrganizations(rawOrgs);
  const ranked = rankOrganizations(deduped, intent);
  const filtered = filterIncompatibleOrganizations(ranked, intent);

  return {
    intent,
    organizations: filtered,
    totalBeforeDedupe,
  };
}
