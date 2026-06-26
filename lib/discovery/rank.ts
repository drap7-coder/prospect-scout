import type { Organization } from "./organization";
import type { SearchIntent } from "./intent";
import { ANY_REGION } from "@/lib/search/regions";

const REGION_ALIASES: Record<string, string[]> = {
  midwest: ["midwest", "great-lakes", "upper-midwest"],
  northeast: ["northeast", "mid-atlantic", "new-england"],
  southeast: ["southeast", "south"],
  southwest: ["southwest"],
  west: ["west", "mountain-west"],
  "mid-atlantic": ["mid-atlantic", "northeast"],
};

export interface RankedOrganization extends Organization {
  relevance: number;
  confidence: number;
  matchReasons: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function regionMatches(org: Organization, intentRegion: string): boolean {
  if (intentRegion === ANY_REGION) return true;
  const aliases = REGION_ALIASES[intentRegion] ?? [intentRegion];
  return org.regions.some((r) => aliases.includes(r.toLowerCase()));
}

function stateMatches(org: Organization, state: string): boolean {
  return org.states.includes(state);
}

function industryMatches(org: Organization, industryId: string): boolean {
  if (org.industries.includes(industryId)) return true;
  // Life-sciences ↔ medical-device cross-match (same as resultsFilters).
  if (
    industryId === "life-sciences" &&
    org.industries.includes("medical-device-manufacturing")
  ) {
    return true;
  }
  if (
    industryId === "medical-device-manufacturing" &&
    org.industries.includes("life-sciences")
  ) {
    return true;
  }
  return false;
}

/** Sectors that are clearly unrelated — used for mismatch penalty. */
const SECTOR_INCOMPATIBLE: Record<string, string[]> = {
  manufacturing: ["financial-services", "education", "healthcare", "nonprofit", "public-sector", "retail-consumer", "technology"],
  "financial-services": ["manufacturing", "healthcare", "education", "nonprofit", "public-sector", "retail-consumer"],
  education: ["manufacturing", "financial-services", "healthcare", "retail-consumer", "technology"],
  healthcare: ["manufacturing", "retail-consumer", "financial-services", "education", "technology"],
  "retail-consumer": ["healthcare", "financial-services", "education", "nonprofit", "public-sector"],
  technology: [],
  "public-sector": ["manufacturing", "financial-services", "retail-consumer", "technology"],
  nonprofit: ["financial-services", "manufacturing", "retail-consumer", "technology"],
};

function isSectorMismatch(org: Organization, intent: SearchIntent): boolean {
  if (!intent.sectorId || !org.sectorId) return false;
  if (org.sectorId === intent.sectorId) return false;
  const incompatible = SECTOR_INCOMPATIBLE[intent.sectorId];
  return incompatible?.includes(org.sectorId) ?? false;
}

/**
 * Score a single organization against structured search intent.
 * Strong boosts for industry/geo/orgType; strong penalty for cross-sector mismatch.
 */
export function scoreOrganizationRelevance(
  org: Organization,
  intent: SearchIntent,
): { relevance: number; confidence: number; matchReasons: string[] } {
  let score = 40; // baseline for appearing in catalog
  let confidence = 0.5;
  const reasons: string[] = [];

  if (intent.industryId) {
    if (industryMatches(org, intent.industryId)) {
      score += 30;
      confidence += 0.25;
      reasons.push(`industry:${intent.industryId}`);
    } else if (org.industries.length > 0) {
      score -= 25;
      confidence -= 0.15;
      reasons.push("industry:mismatch");
    }
  }

  if (intent.sectorId) {
    if (org.sectorId === intent.sectorId) {
      score += 15;
      confidence += 0.1;
      reasons.push(`sector:${intent.sectorId}`);
    } else if (isSectorMismatch(org, intent)) {
      score -= 35;
      confidence -= 0.3;
      reasons.push("sector:incompatible");
    }
  }

  if (intent.organizationTypeId) {
    if (org.organizationType === intent.organizationTypeId) {
      score += 20;
      confidence += 0.15;
      reasons.push(`orgType:${intent.organizationTypeId}`);
    }
  }

  if (intent.state) {
    if (stateMatches(org, intent.state)) {
      score += 25;
      confidence += 0.2;
      reasons.push(`state:${intent.state}`);
    } else {
      score -= 15;
      confidence -= 0.1;
      reasons.push("state:mismatch");
    }
  }

  if (intent.region !== ANY_REGION) {
    if (regionMatches(org, intent.region)) {
      score += 15;
      confidence += 0.1;
      reasons.push(`region:${intent.region}`);
    } else if (!intent.state) {
      score -= 10;
      reasons.push("region:mismatch");
    }
  }

  // Keyword overlap on name/aliases (secondary to structured match).
  if (intent.keywords.length > 0) {
    const hay = [org.canonicalName, ...org.aliases]
      .join(" ")
      .toLowerCase();
    const matched = intent.keywords.filter((kw) => hay.includes(kw));
    if (matched.length > 0) {
      score += Math.min(10, matched.length * 3);
      reasons.push(`keywords:${matched.join(",")}`);
    }
  }

  return {
    relevance: clamp(score, 0, 100),
    confidence: clamp(confidence, 0, 1),
    matchReasons: reasons,
  };
}

/** Rank organizations by structured intent match (desc relevance, then name). */
export function rankOrganizations(
  orgs: Organization[],
  intent: SearchIntent,
): RankedOrganization[] {
  const ranked = orgs.map((org) => {
    const { relevance, confidence, matchReasons } = scoreOrganizationRelevance(
      org,
      intent,
    );
    return { ...org, relevance, confidence, matchReasons };
  });

  return ranked.sort(
    (a, b) =>
      b.relevance - a.relevance ||
      b.confidence - a.confidence ||
      a.canonicalName.localeCompare(b.canonicalName),
  );
}

/** Filter out organizations with strong sector/industry mismatch when intent is structured. */
export function filterIncompatibleOrganizations(
  orgs: RankedOrganization[],
  intent: SearchIntent,
): RankedOrganization[] {
  if (!intent.sectorId && !intent.industryId && !intent.organizationTypeId) {
    return orgs;
  }

  return orgs.filter((org) => {
    if (org.matchReasons.includes("sector:incompatible")) return false;

    if (intent.industryId && org.industries.length > 0) {
      const industryOk = industryMatches(org, intent.industryId);
      if (!industryOk && org.relevance < 70) return false;
    }

    if (intent.organizationTypeId && org.organizationType) {
      if (
        org.organizationType !== intent.organizationTypeId &&
        org.relevance < 70
      ) {
        return false;
      }
    }

    if (
      intent.industryId &&
      org.matchReasons.includes("industry:mismatch") &&
      org.relevance < 55
    ) {
      return false;
    }

    // When industry/org-type intent is explicit, drop unrelated sectors that
    // only matched via multi-state footprint (e.g. health plans "in California").
    if (intent.industryId || intent.organizationTypeId) {
      const industryOk =
        !intent.industryId ||
        org.industries.length === 0 ||
        industryMatches(org, intent.industryId);
      const orgTypeOk =
        !intent.organizationTypeId ||
        !org.organizationType ||
        org.organizationType === intent.organizationTypeId;
      if (!industryOk || !orgTypeOk) {
        if (org.relevance < 80) return false;
      }
    }

    return true;
  });
}
