import type { Organization } from "./organization";
import type { SearchIntent } from "./intent";
import { ANY_REGION } from "@/lib/search/regions";
import { organizationMatchesOrgTypeFilter } from "./canonicalOrgType";
import {
  orgMatchesAnyIndustry,
  intentIndustryIds,
  UNIVERSITY_EXCLUSION_RE,
  NON_HOSPITAL_TYPES,
} from "./match";

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

function cityMatches(org: Organization, city: string): boolean {
  const needle = city.toLowerCase();
  const hay = [org.headquarters, ...org.locations, org.canonicalName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
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
  const alternates = intent.alternateSectorIds ?? [];
  if (alternates.includes(org.sectorId)) return false;
  const incompatible = SECTOR_INCOMPATIBLE[intent.sectorId];
  return incompatible?.includes(org.sectorId) ?? false;
}

const AUTHORITATIVE_CONNECTORS = new Set([
  "directory",
  "nces",
  "sec",
  "cms",
  "fda",
  "irs-nonprofits",
]);

const ENRICHMENT_CONNECTORS = new Set(["rss", "public-web"]);

function sourceTierAdjustment(org: Organization): {
  scoreDelta: number;
  confidenceDelta: number;
  reason?: string;
} {
  const connectors = new Set(org.sources.map((s) => s.connector));
  const authoritative = [...connectors].some((c) =>
    AUTHORITATIVE_CONNECTORS.has(c),
  );
  const enrichmentOnly =
    [...connectors].some((c) => ENRICHMENT_CONNECTORS.has(c)) &&
    !authoritative;

  if (authoritative && !enrichmentOnly) {
    return { scoreDelta: 15, confidenceDelta: 0.15, reason: "source:authoritative" };
  }
  if (enrichmentOnly) {
    return { scoreDelta: -30, confidenceDelta: -0.25, reason: "source:enrichment-only" };
  }
  return { scoreDelta: 0, confidenceDelta: 0 };
}

/**
 * Score a single organization against structured search intent.
 * Prioritizes org type → industry → state/city → authoritative source → exact name.
 */
export function scoreOrganizationRelevance(
  org: Organization,
  intent: SearchIntent,
): { relevance: number; confidence: number; matchReasons: string[] } {
  let score = 30;
  let confidence = 0.45;
  const reasons: string[] = [];

  if (intent.organizationTypeId) {
    if (organizationMatchesOrgTypeFilter(org, intent.organizationTypeId)) {
      score += 28;
      confidence += 0.2;
      reasons.push(`orgType:${intent.organizationTypeId}`);
    } else if (org.organizationType || org.canonicalOrganizationType) {
      score -= 22;
      confidence -= 0.18;
      reasons.push("orgType:mismatch");
    }
  }

  const industries = intentIndustryIds(intent);
  if (industries.length > 0) {
    if (orgMatchesAnyIndustry(org, industries)) {
      score += 32;
      confidence += 0.22;
      reasons.push(`industry:${intent.industryId ?? industries[0]}`);
    } else if (org.industries.length > 0) {
      score -= 28;
      confidence -= 0.18;
      reasons.push("industry:mismatch");
    }
  }

  if (intent.sectorId) {
    if (org.sectorId === intent.sectorId) {
      score += 18;
      confidence += 0.1;
      reasons.push(`sector:${intent.sectorId}`);
    } else if (
      org.sectorId &&
      (intent.alternateSectorIds ?? []).includes(org.sectorId)
    ) {
      score += 12;
      confidence += 0.08;
      reasons.push(`sector:alternate:${org.sectorId}`);
    } else if (isSectorMismatch(org, intent)) {
      score -= 40;
      confidence -= 0.32;
      reasons.push("sector:incompatible");
    }
  }

  if (intent.state) {
    if (stateMatches(org, intent.state)) {
      score += 26;
      confidence += 0.2;
      reasons.push(`state:${intent.state}`);
    } else if (org.states.length > 0) {
      score -= 18;
      confidence -= 0.12;
      reasons.push("state:mismatch");
    }
  }

  if (intent.city) {
    if (cityMatches(org, intent.city)) {
      score += 22;
      confidence += 0.15;
      reasons.push(`city:${intent.city}`);
    } else if (intent.state && stateMatches(org, intent.state)) {
      score += 6;
      reasons.push(`state-proximity:${intent.state}`);
    }
  }

  if (intent.region !== ANY_REGION) {
    if (regionMatches(org, intent.region)) {
      score += 12;
      confidence += 0.08;
      reasons.push(`region:${intent.region}`);
    } else if (!intent.state) {
      score -= 12;
      reasons.push("region:mismatch");
    }
  }

  const queryLower = intent.query.toLowerCase();
  const nameLower = org.canonicalName.toLowerCase();
  if (queryLower.length >= 4 && nameLower.includes(queryLower)) {
    score += 15;
    confidence += 0.1;
    reasons.push("exact:query-in-name");
  }

  if (intent.keywords.length > 0) {
    const hay = [org.canonicalName, ...org.aliases].join(" ").toLowerCase();
    const matched = intent.keywords.filter((kw) => hay.includes(kw));
    if (matched.length > 0) {
      score += Math.min(8, matched.length * 2);
      reasons.push(`keywords:${matched.join(",")}`);
    }
  }

  const tier = sourceTierAdjustment(org);
  score += tier.scoreDelta;
  confidence += tier.confidenceDelta;
  if (tier.reason) reasons.push(tier.reason);

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

const MIN_RELEVANCE_STRUCTURED = 52;

/** Filter out organizations with strong sector/industry/org-type mismatch. */
export function filterIncompatibleOrganizations(
  orgs: RankedOrganization[],
  intent: SearchIntent,
): RankedOrganization[] {
  const hasStructured = Boolean(
    intent.sectorId ||
      intent.industryId ||
      intent.organizationTypeId ||
      intent.state ||
      intent.city,
  );

  return orgs.filter((org) => {
    if (org.matchReasons.includes("sector:incompatible")) return false;

    if (
      intent.organizationTypeId === "university" &&
      UNIVERSITY_EXCLUSION_RE.test(org.canonicalName)
    ) {
      return false;
    }

    if (
      (intent.organizationTypeId === "hospital" ||
        intent.organizationTypeId === "hospital-health-system") &&
      org.organizationType &&
      NON_HOSPITAL_TYPES.has(org.organizationType)
    ) {
      return false;
    }

    if (intent.organizationTypeId) {
      if (
        !organizationMatchesOrgTypeFilter(org, intent.organizationTypeId) &&
        org.relevance < 75
      ) {
        return false;
      }
    }

    const industries = intentIndustryIds(intent);
    if (industries.length > 0 && org.industries.length > 0) {
      if (!orgMatchesAnyIndustry(org, industries) && org.relevance < 68) {
        return false;
      }
    }

    if (
      org.matchReasons.includes("industry:mismatch") &&
      org.matchReasons.includes("orgType:mismatch") &&
      org.relevance < 60
    ) {
      return false;
    }

    if (intent.state && org.states.length > 0) {
      if (
        !stateMatches(org, intent.state) &&
        org.relevance < 72 &&
        !org.matchReasons.some((r) => r.startsWith("sector:alternate"))
      ) {
        return false;
      }
    }

    if (hasStructured && org.relevance < MIN_RELEVANCE_STRUCTURED) {
      return false;
    }

    return true;
  });
}

/** Cap result set size after ranking. */
export function limitResults(
  orgs: RankedOrganization[],
  max = 500,
): RankedOrganization[] {
  return orgs.slice(0, max);
}
