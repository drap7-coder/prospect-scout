import {
  dedupeOrganizationsCanonical,
  organizationsFromDirectory,
  type Organization,
} from "../organization";
import { catalogRecordToOrganization } from "./normalize";
import {
  NCES_RECORDS,
  SEC_BANK_RECORDS,
  SEC_COMPANY_RECORDS,
  CMS_RECORDS,
  FDA_RECORDS,
  IRS_NONPROFIT_RECORDS,
} from "./loadCatalog";
import type { SearchIntent } from "../intent";
import { ANY_REGION } from "@/lib/search/regions";
import {
  intentIndustryIds,
  intentSectorIds,
  orgIndustryMatches,
  orgMatchesAnyIndustry,
  orgSectorMatches,
  UNIVERSITY_EXCLUSION_RE,
  NON_HOSPITAL_TYPES,
} from "../match";

const REGION_ALIASES: Record<string, string[]> = {
  midwest: ["midwest", "great-lakes", "upper-midwest"],
  northeast: ["northeast", "mid-atlantic", "new-england"],
  southeast: ["southeast", "south"],
  southwest: ["southwest"],
  west: ["west", "mountain-west"],
  "mid-atlantic": ["mid-atlantic", "northeast"],
};

export interface CatalogIndex {
  orgs: Organization[];
  byState: Map<string, number[]>;
  bySector: Map<string, number[]>;
  byIndustry: Map<string, number[]>;
  byOrgType: Map<string, number[]>;
  byConnector: Map<string, number[]>;
  loadedAt: number;
}

let cachedIndex: CatalogIndex | null = null;

function addToIndex(
  map: Map<string, number[]>,
  key: string,
  index: number,
): void {
  const list = map.get(key);
  if (list) list.push(index);
  else map.set(key, [index]);
}

function buildIndex(orgs: Organization[]): CatalogIndex {
  const byState = new Map<string, number[]>();
  const bySector = new Map<string, number[]>();
  const byIndustry = new Map<string, number[]>();
  const byOrgType = new Map<string, number[]>();
  const byConnector = new Map<string, number[]>();

  orgs.forEach((org, i) => {
    for (const state of org.states) addToIndex(byState, state, i);
    if (org.sectorId) addToIndex(bySector, org.sectorId, i);
    for (const industry of org.industries) addToIndex(byIndustry, industry, i);
    if (org.organizationType) addToIndex(byOrgType, org.organizationType, i);
    for (const src of org.sources) addToIndex(byConnector, src.connector, i);
  });

  return {
    orgs,
    byState,
    bySector,
    byIndustry,
    byOrgType,
    byConnector,
    loadedAt: Date.now(),
  };
}

function bulkOrganizations(): Organization[] {
  return [
    ...NCES_RECORDS.map((r) => catalogRecordToOrganization("nces", r)),
    ...SEC_BANK_RECORDS.map((r) => catalogRecordToOrganization("sec", r)),
    ...SEC_COMPANY_RECORDS.map((r) => catalogRecordToOrganization("sec", r)),
    ...CMS_RECORDS.map((r) => catalogRecordToOrganization("cms", r)),
    ...FDA_RECORDS.map((r) => catalogRecordToOrganization("fda", r)),
    ...IRS_NONPROFIT_RECORDS.map((r) =>
      catalogRecordToOrganization("irs-nonprofits", r),
    ),
  ];
}

/** Load and index the full catalog once per process. */
export function getCatalogIndex(): CatalogIndex {
  if (cachedIndex) return cachedIndex;
  const raw = [...organizationsFromDirectory(), ...bulkOrganizations()];
  const orgs = dedupeOrganizationsCanonical(raw);
  cachedIndex = buildIndex(orgs);
  return cachedIndex;
}

export function getCatalogOrganizations(): Organization[] {
  return getCatalogIndex().orgs;
}

export function resetCatalogIndex(): void {
  cachedIndex = null;
}

function intersectSets(a: Set<number> | null, b: Set<number>): Set<number> {
  if (!a) return b;
  const out = new Set<number>();
  for (const v of a) {
    if (b.has(v)) out.add(v);
  }
  return out;
}

function indicesFromMap(map: Map<string, number[]>, key: string): Set<number> {
  return new Set(map.get(key) ?? []);
}

function unionConnectorIndices(
  index: CatalogIndex,
  connectorIds: string[],
): Set<number> | null {
  if (connectorIds.length === 0) return null;
  const out = new Set<number>();
  for (const id of connectorIds) {
    for (const i of index.byConnector.get(id) ?? []) out.add(i);
  }
  return out;
}

function locationMatches(org: Organization, intent: SearchIntent): boolean {
  if (!intent.city) return true;
  const city = intent.city.toLowerCase();
  const hay = [org.headquarters, ...org.locations, org.canonicalName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (hay.includes(city)) return true;
  if (intent.state && org.states.includes(intent.state)) return true;
  return false;
}

function passesQualityFilters(org: Organization, intent: SearchIntent): boolean {
  if (
    intent.organizationTypeId === "university" &&
    UNIVERSITY_EXCLUSION_RE.test(org.canonicalName)
  ) {
    return false;
  }
  if (
    intent.organizationTypeId === "hospital" &&
    org.organizationType &&
    NON_HOSPITAL_TYPES.has(org.organizationType)
  ) {
    return false;
  }
  return true;
}

function orgMatchesIntent(org: Organization, intent: SearchIntent): boolean {
  if (!passesQualityFilters(org, intent)) return false;

  const sectors = intentSectorIds(intent);
  if (sectors.length > 0 && org.sectorId && !sectors.includes(org.sectorId)) {
    return false;
  }

  const industries = intentIndustryIds(intent);
  if (industries.length > 0 && org.industries.length > 0) {
    if (!orgMatchesAnyIndustry(org, industries)) return false;
  }

  if (
    intent.organizationTypeId &&
    org.organizationType &&
    org.organizationType !== intent.organizationTypeId
  ) {
    return false;
  }

  if (intent.state && org.states.length > 0 && !org.states.includes(intent.state)) {
    return false;
  }

  if (intent.region !== ANY_REGION && !intent.state) {
    const aliases = REGION_ALIASES[intent.region] ?? [intent.region];
    if (
      org.regions.length > 0 &&
      !org.regions.some((r) => aliases.includes(r.toLowerCase()))
    ) {
      return false;
    }
  }

  if (!locationMatches(org, intent)) return false;

  return true;
}

/**
 * Fast indexed candidate lookup for listing discovery.
 * Returns all matching orgs for the intent within selected connectors.
 */
export function discoverFromCatalogIndex(
  intent: SearchIntent,
  connectorIds: string[],
): Organization[] {
  const index = getCatalogIndex();
  const hasStructured = Boolean(
    intent.sectorId ||
      intent.industryId ||
      intent.organizationTypeId ||
      intent.state ||
      intent.city ||
      intent.region !== ANY_REGION,
  );

  let candidates: Set<number> | null = unionConnectorIndices(index, connectorIds);

  if (intent.state) {
    candidates = intersectSets(candidates, indicesFromMap(index.byState, intent.state));
  }

  const sectors = intentSectorIds(intent);
  if (sectors.length === 1) {
    candidates = intersectSets(
      candidates,
      indicesFromMap(index.bySector, sectors[0]!),
    );
  } else if (sectors.length > 1) {
    const sectorUnion = new Set<number>();
    for (const s of sectors) {
      for (const i of index.bySector.get(s) ?? []) sectorUnion.add(i);
    }
    candidates = intersectSets(candidates, sectorUnion);
  }

  const industries = intentIndustryIds(intent);
  if (industries.length === 1) {
    candidates = intersectSets(
      candidates,
      indicesFromMap(index.byIndustry, industries[0]!),
    );
  } else if (industries.length > 1) {
    const industryUnion = new Set<number>();
    for (const id of industries) {
      for (const i of index.byIndustry.get(id) ?? []) industryUnion.add(i);
    }
    candidates = intersectSets(candidates, industryUnion);
  }

  if (intent.organizationTypeId) {
    candidates = intersectSets(
      candidates,
      indicesFromMap(index.byOrgType, intent.organizationTypeId),
    );
  }

  const pool =
    candidates && candidates.size > 0
      ? [...candidates].map((i) => index.orgs[i]!)
      : hasStructured
        ? []
        : connectorIds.flatMap((id) =>
            (index.byConnector.get(id) ?? []).map((i) => index.orgs[i]!),
          );

  const filtered = pool.filter((org) => orgMatchesIntent(org, intent));

  if (filtered.length > 0) return filtered;
  if (hasStructured) return [];
  return pool;
}

/** Check whether an org matches intent (for tests and diagnostics). */
export { orgMatchesIntent, orgIndustryMatches, orgSectorMatches };
