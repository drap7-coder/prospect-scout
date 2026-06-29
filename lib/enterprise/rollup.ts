import type { Organization } from "@/lib/discovery/organization";
import type { RankedOrganization } from "@/lib/discovery/rank";
import type { SectorAttributes } from "@/lib/organization/model";
import { ENTERPRISE_PROFILE_SECTOR_KEY, type EnterpriseProfile } from "./types";
import { resolveEnterpriseKey } from "./resolveKey";
import { buildEnterpriseProfile, enterpriseProfileToClassifications } from "./buildProfile";

export interface RollupOrganizationsOptions {
  /** Minimum child count to treat as multi-org enterprise (default 1). */
  minChildren?: number;
}

export interface RollupRankedResult {
  organizations: RankedOrganization[];
  profiles: EnterpriseProfile[];
  rawOrganizationCount: number;
  enterpriseCount: number;
  suppressedChildCount: number;
  orphanCount: number;
}

/** Group matched warehouse organizations into enterprise-level ranked results. */
export function rollupRankedOrganizations(
  orgs: RankedOrganization[],
  options: RollupOrganizationsOptions = {},
): RollupRankedResult {
  const groups = new Map<string, { key: ReturnType<typeof resolveEnterpriseKey>; children: RankedOrganization[] }>();

  for (const org of orgs) {
    const key = resolveEnterpriseKey(org);
    const bucket = groups.get(key.key) ?? { key, children: [] };
    bucket.children.push(org);
    groups.set(key.key, bucket);
  }

  const profiles: EnterpriseProfile[] = [];
  const enterprises: RankedOrganization[] = [];
  let orphanCount = 0;
  let suppressedChildCount = 0;

  for (const { key, children } of groups.values()) {
    if (children.length === 1 && key.method === "standalone") {
      orphanCount += 1;
      enterprises.push(children[0]!);
      continue;
    }

    suppressedChildCount += Math.max(0, children.length - 1);
    const profile = buildEnterpriseProfile(key, children);
    profiles.push(profile);
    enterprises.push(enterpriseProfileToRankedOrganization(profile, children));
  }

  enterprises.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));

  return {
    organizations: enterprises,
    profiles,
    rawOrganizationCount: orgs.length,
    enterpriseCount: enterprises.length,
    suppressedChildCount,
    orphanCount,
  };
}

/** Convert enterprise profile + source children into a synthetic ranked organization. */
export function enterpriseProfileToRankedOrganization(
  profile: EnterpriseProfile,
  children: RankedOrganization[],
): RankedOrganization {
  const best = children.reduce((a, b) => ((a.relevance ?? 0) >= (b.relevance ?? 0) ? a : b));
  const maxRelevance = Math.max(...children.map((c) => c.relevance ?? 0));
  const maxConfidence = Math.max(...children.map((c) => c.confidence ?? 0));
  const matchReasons = [
    ...new Set(children.flatMap((c) => c.matchReasons ?? [])),
  ].slice(0, 8);

  const hqLabel =
    profile.hqCity && profile.hqState
      ? `${profile.hqCity}, ${profile.hqState}`
      : profile.hqState ?? best.headquarters ?? best.locations[0] ?? "United States";

  return {
    ...best,
    id: `enterprise:${profile.id}`,
    canonicalName: profile.name,
    displayName: profile.name,
    website: profile.website,
    domain: profile.canonicalDomain,
    headquarters: hqLabel,
    states: profile.statesServed,
    regions: best.regions,
    geography: {
      states: profile.statesServed,
      regions: best.geography?.regions ?? best.regions ?? [],
      headquarters: hqLabel,
      national: profile.statesServed.length >= 20,
    },
    memberEstimate: profile.totalCoveredLives,
    ownership: profile.ownershipTypes.includes("public")
      ? "public"
      : best.ownership,
    classifications: enterpriseProfileToClassifications(profile),
    parentDisplayName: null,
    parentId: null,
    description: `${profile.childCount} operating entities · ${profile.statesServed.length} states`,
    tags: [...new Set([...(best.tags ?? []), "enterprise-rollup"])],
    relevance: maxRelevance,
    confidence: maxConfidence,
    matchReasons: [
      `Enterprise rollup (${profile.childCount} source records)`,
      ...matchReasons,
    ],
    sectorAttributes: {
      ...(best.sectorAttributes ?? {}),
      [ENTERPRISE_PROFILE_SECTOR_KEY]: profile as unknown as SectorAttributes[string],
    },
  };
}

/** Roll up all warehouse health-plan organizations (for diagnostics / detail pages). */
export function rollupAllHealthPlanOrganizations(
  orgs: Organization[],
): RollupRankedResult {
  const ranked: RankedOrganization[] = orgs.map((org) => ({
    ...org,
    relevance: org.relevance ?? 0.5,
    confidence: org.confidence ?? 0.5,
    matchReasons: [],
  }));
  return rollupRankedOrganizations(ranked);
}
