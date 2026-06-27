import type { SearchIntent } from "../intent";
import {
  CANONICAL_ORG_TYPES,
  organizationMatchesOrgTypeFilter,
} from "../canonicalOrgType";
import { ANY_REGION } from "@/lib/search/regions";
import {
  intentIndustryIds,
  intentSectorIds,
  orgMatchesAnyIndustry,
} from "../match";
import { getCatalogIndex } from "./catalogIndex";
import type { Organization } from "../organization";
import { TAXONOMY_SECTORS, TAXONOMY_ORGANIZATION_TYPES } from "@/lib/taxonomy";
import { US_STATE_FILTERS } from "@/lib/search/searchState";

const REGION_ALIASES: Record<string, string[]> = {
  midwest: ["midwest", "great-lakes", "upper-midwest"],
  northeast: ["northeast", "mid-atlantic", "new-england"],
  southeast: ["southeast", "south"],
  southwest: ["southwest"],
  west: ["west", "mountain-west"],
  "mid-atlantic": ["mid-atlantic", "northeast"],
};

export type FacetDimension =
  | "sector"
  | "industry"
  | "organizationType"
  | "canonicalOrganizationType"
  | "state"
  | "region";

export interface CatalogFacetCounts {
  /** Total orgs in the indexed catalog (deduplicated). */
  catalogTotal: number;
  /** Orgs matching the current selector scope (all criteria applied). */
  scopeTotal: number;
  sector: Record<string, number>;
  industry: Record<string, number>;
  organizationType: Record<string, number>;
  canonicalOrganizationType: Record<string, number>;
  state: Record<string, number>;
  region: Record<string, number>;
}

function regionMatches(org: Organization, regionId: string): boolean {
  if (regionId === "nationwide") return true;
  const aliases = REGION_ALIASES[regionId] ?? [regionId];
  return org.regions.some((r) => aliases.includes(r.toLowerCase()));
}

function orgMatchesScopedIntent(
  org: Organization,
  intent: SearchIntent,
  exclude?: FacetDimension,
): boolean {
  if (exclude !== "state" && intent.state && org.states.length > 0) {
    if (!org.states.includes(intent.state)) return false;
  }

  if (exclude !== "region" && intent.region !== ANY_REGION && !intent.state) {
    if (org.regions.length > 0 && !regionMatches(org, intent.region)) {
      return false;
    }
  }

  const sectors = intentSectorIds(intent);
  if (exclude !== "sector" && sectors.length > 0 && org.sectorId) {
    if (!sectors.includes(org.sectorId)) return false;
  }

  const industries = intentIndustryIds(intent);
  if (exclude !== "industry" && industries.length > 0 && org.industries.length > 0) {
    if (!orgMatchesAnyIndustry(org, industries)) return false;
  }

  if (
    exclude !== "organizationType" &&
    exclude !== "canonicalOrganizationType" &&
    intent.organizationTypeId &&
    !organizationMatchesOrgTypeFilter(org, intent.organizationTypeId)
  ) {
    return false;
  }

  return true;
}

function countByField(
  orgs: Organization[],
  field: (org: Organization) => string | null | undefined,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const org of orgs) {
    const key = field(org);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Compute facet counts from the full canonical catalog index.
 * Each dimension excludes its own filter (standard faceted search).
 */
export function computeCatalogFacetCounts(intent: SearchIntent): CatalogFacetCounts {
  const index = getCatalogIndex();
  const all = index.orgs;

  const scopeOrgs = all.filter((org) => orgMatchesScopedIntent(org, intent));

  const sectorPool = all.filter((org) => orgMatchesScopedIntent(org, intent, "sector"));
  const industryPool = all.filter((org) =>
    orgMatchesScopedIntent(org, intent, "industry"),
  );
  const orgTypePool = all.filter((org) =>
    orgMatchesScopedIntent(org, intent, "organizationType"),
  );
  const canonicalPool = all.filter((org) =>
    orgMatchesScopedIntent(org, intent, "canonicalOrganizationType"),
  );
  const statePool = all.filter((org) => orgMatchesScopedIntent(org, intent, "state"));
  const regionPool = all.filter((org) => orgMatchesScopedIntent(org, intent, "region"));

  return {
    catalogTotal: all.length,
    scopeTotal: scopeOrgs.length,
    sector: countByField(sectorPool, (o) => o.sectorId),
    industry: countByField(industryPool, (o) => o.industries[0]),
    organizationType: countByField(orgTypePool, (o) => o.organizationType),
    canonicalOrganizationType: countByField(
      canonicalPool,
      (o) => o.canonicalOrganizationType,
    ),
    state: countByField(statePool, (o) => o.states[0]),
    region: countByField(regionPool, (o) => o.regions[0]),
  };
}

/** Count for a single facet value within scoped catalog. */
export function catalogFacetCount(
  intent: SearchIntent,
  dimension: FacetDimension,
  value: string | null,
): number {
  if (!value) {
    return computeCatalogFacetCounts(intent).scopeTotal;
  }
  const facets = computeCatalogFacetCounts(intent);
  switch (dimension) {
    case "sector":
      return facets.sector[value] ?? 0;
    case "industry":
      return facets.industry[value] ?? 0;
    case "organizationType":
      return facets.organizationType[value] ?? 0;
    case "canonicalOrganizationType":
      return facets.canonicalOrganizationType[value] ?? 0;
    case "state":
      return facets.state[value] ?? 0;
    case "region":
      return facets.region[value] ?? 0;
    default:
      return 0;
  }
}

export function emptyFacetCounts(): CatalogFacetCounts {
  const empty: Record<string, number> = {};
  for (const t of CANONICAL_ORG_TYPES) empty[t.id] = 0;
  return {
    catalogTotal: 0,
    scopeTotal: 0,
    sector: {},
    industry: {},
    organizationType: {},
    canonicalOrganizationType: empty,
    state: {},
    region: {},
  };
}

/** Pre-seed zero counts for known taxonomy keys so UI shows full universe. */
export function hydrateFacetCounts(facets: CatalogFacetCounts): CatalogFacetCounts {
  const sector = { ...facets.sector };
  for (const s of TAXONOMY_SECTORS) {
    if (sector[s.id] === undefined) sector[s.id] = 0;
  }

  const industry = { ...facets.industry };
  const state = { ...facets.state };
  for (const st of US_STATE_FILTERS) {
    if (state[st.id] === undefined) state[st.id] = 0;
  }

  const organizationType = { ...facets.organizationType };
  for (const o of TAXONOMY_ORGANIZATION_TYPES) {
    if (organizationType[o.id] === undefined) organizationType[o.id] = 0;
  }

  const canonicalOrganizationType = { ...facets.canonicalOrganizationType };
  for (const t of CANONICAL_ORG_TYPES) {
    if (canonicalOrganizationType[t.id] === undefined) {
      canonicalOrganizationType[t.id] = 0;
    }
  }

  return {
    ...facets,
    sector,
    industry,
    organizationType,
    canonicalOrganizationType,
    state,
  };
}

export function getCatalogIndexMeta(): {
  catalogTotal: number;
  loadedAt: number;
  rawIngested: number;
  mergedCount: number;
} {
  const index = getCatalogIndex();
  return {
    catalogTotal: index.orgs.length,
    loadedAt: index.loadedAt,
    rawIngested: index.rawIngested,
    mergedCount: index.mergedCount,
  };
}
