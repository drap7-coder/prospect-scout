import { organizationsFromDirectory, directoryRecordToOrganization, mergeOrganizations } from "../organization";
import type { Organization } from "../organization";
import type { SearchIntent } from "../intent";
import type { DiscoveryConnector, ConnectorRecord } from "../connector";
import type { OrganizationRecord } from "@/lib/directories/types";
import { ANY_REGION } from "@/lib/search/regions";
import {
  intentIndustryIds,
  intentSectorIds,
  orgMatchesAnyIndustry,
} from "../match";

const REGION_ALIASES: Record<string, string[]> = {
  midwest: ["midwest", "great-lakes", "upper-midwest"],
  northeast: ["northeast", "mid-atlantic", "new-england"],
  southeast: ["southeast", "south"],
  southwest: ["southwest"],
  west: ["west", "mountain-west"],
  "mid-atlantic": ["mid-atlantic", "northeast"],
};

function passesIntentFilter(org: Organization, intent: SearchIntent): boolean {
  const sectors = intentSectorIds(intent);
  if (sectors.length > 0 && org.sectorId && !sectors.includes(org.sectorId)) {
    return false;
  }

  const industries = intentIndustryIds(intent);
  if (industries.length > 0 && org.industries.length > 0) {
    if (!orgMatchesAnyIndustry(org, industries)) return false;
  }

  if (intent.organizationTypeId && org.organizationType) {
    if (org.organizationType !== intent.organizationTypeId) return false;
  }

  if (intent.state && !org.states.includes(intent.state)) {
    return false;
  }

  if (intent.region !== ANY_REGION) {
    const aliases = REGION_ALIASES[intent.region] ?? [intent.region];
    const regionMatch = org.regions.some((r) => aliases.includes(r.toLowerCase()));
    if (!regionMatch && intent.state) {
      // state filter already applied
    } else if (!regionMatch && !intent.state) {
      return false;
    }
  }

  return true;
}

/** When intent has no structured filters, return full catalog for ranking. */
function hasStructuredFilters(intent: SearchIntent): boolean {
  return Boolean(
    intent.sectorId ||
      intent.industryId ||
      intent.organizationTypeId ||
      intent.state ||
      intent.region !== ANY_REGION,
  );
}

export const directoryConnector: DiscoveryConnector = {
  id: "directory",
  label: "Master Directory",

  discover(intent: SearchIntent): ConnectorRecord[] {
    const all = organizationsFromDirectory();
    if (!hasStructuredFilters(intent)) {
      return all.map((org) => ({ __type: "organization", org }) as ConnectorRecord);
    }
    const filtered = all.filter((org) => passesIntentFilter(org, intent));
    const pool = filtered;
    return pool.map((org) => ({ __type: "organization", org }) as ConnectorRecord);
  },

  normalize(record: ConnectorRecord): Organization {
    if (record.__type === "organization" && record.org) {
      return record.org as Organization;
    }
    if (record.id && record.name) {
      return directoryRecordToOrganization(record as unknown as OrganizationRecord);
    }
    throw new Error("directoryConnector: invalid record");
  },

  merge(existing: Organization, incoming: Organization): Organization {
    return mergeOrganizations(existing, incoming);
  },
};

export function filterDirectoryByIntent(
  intent: SearchIntent,
): Organization[] {
  const records = directoryConnector.discover(intent) as ConnectorRecord[];
  return records.map((r) => directoryConnector.normalize(r));
}
