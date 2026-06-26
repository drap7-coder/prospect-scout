import type {
  ProspectSignal,
  RawProspect,
  ScoreBreakdown,
  ScoreFactor,
  SearchQuery,
} from "@/lib/search/types";
import { ANY_REGION, regionLabel } from "./regions";
import { freshnessFactor } from "./signalBuilder";

/**
 * Explainable opportunity scoring with STRUCTURED DISCOVERY first.
 *
 * When the query carries industry / sector / org-type / state intent,
 * those factors dominate (before signals). Cross-sector mismatches
 * are strongly penalized so "manufacturers in Ohio" does not return banks.
 */

const MAX_POINTS = {
  industryMatch: 25,
  sectorMatch: 15,
  orgTypeMatch: 15,
  stateMatch: 20,
  regionMatch: 10,
  buyerMatch: 10,
  problemFit: 15,
  signalStrength: 15,
  signalFreshness: 10,
  outreachUrgency: 10,
} as const;

const STRUCTURE_PENALTY_MAX = 40;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function hasStructuredIntent(query: SearchQuery): boolean {
  const p = query.profile;
  return Boolean(p.industryId || p.sectorId || p.organizationTypeId || p.state);
}

function industryMatches(prospect: RawProspect, industryId: string): boolean {
  if (prospect.industryId === industryId) return true;
  if (
    industryId === "life-sciences" &&
    prospect.industryId === "medical-device-manufacturing"
  ) {
    return true;
  }
  if (
    industryId === "medical-device-manufacturing" &&
    prospect.industryId === "life-sciences"
  ) {
    return true;
  }
  return false;
}

const SECTOR_INCOMPATIBLE: Record<string, string[]> = {
  manufacturing: ["financial-services", "education"],
  "financial-services": ["manufacturing", "healthcare"],
  education: ["manufacturing", "financial-services"],
  healthcare: ["manufacturing", "retail-consumer"],
  "retail-consumer": ["healthcare", "financial-services"],
};

function scoreIndustryMatch(
  prospect: RawProspect,
  query: SearchQuery,
): ScoreFactor {
  const industryId = query.profile.industryId;
  if (!industryId) {
    return {
      key: "industryMatch",
      label: "Industry match",
      points: 0,
      maxPoints: MAX_POINTS.industryMatch,
      detail: "No industry filter",
    };
  }
  const matches = industryMatches(prospect, industryId);
  return {
    key: "industryMatch",
    label: "Industry match",
    points: matches ? MAX_POINTS.industryMatch : 0,
    maxPoints: MAX_POINTS.industryMatch,
    detail: matches
      ? `Matches ${industryId} industry`
      : `Outside ${industryId} industry`,
  };
}

function scoreSectorMatch(
  prospect: RawProspect,
  query: SearchQuery,
): ScoreFactor {
  const sectorId = query.profile.sectorId;
  if (!sectorId) {
    return {
      key: "sectorMatch",
      label: "Sector match",
      points: 0,
      maxPoints: MAX_POINTS.sectorMatch,
      detail: "No sector filter",
    };
  }
  const matches = prospect.sectorId === sectorId;
  return {
    key: "sectorMatch",
    label: "Sector match",
    points: matches ? MAX_POINTS.sectorMatch : 0,
    maxPoints: MAX_POINTS.sectorMatch,
    detail: matches
      ? `In ${sectorId} sector`
      : `Outside ${sectorId} sector`,
  };
}

function scoreOrgTypeMatch(
  prospect: RawProspect,
  query: SearchQuery,
): ScoreFactor {
  const orgTypeId = query.profile.organizationTypeId;
  if (!orgTypeId) {
    return {
      key: "orgTypeMatch",
      label: "Organization type match",
      points: 0,
      maxPoints: MAX_POINTS.orgTypeMatch,
      detail: "No organization type filter",
    };
  }
  const matches = prospect.organizationTypeId === orgTypeId;
  return {
    key: "orgTypeMatch",
    label: "Organization type match",
    points: matches ? MAX_POINTS.orgTypeMatch : 0,
    maxPoints: MAX_POINTS.orgTypeMatch,
    detail: matches
      ? `Matches ${orgTypeId}`
      : `Different organization type`,
  };
}

function scoreStateMatch(
  prospect: RawProspect,
  query: SearchQuery,
): ScoreFactor {
  const state = query.profile.state;
  if (!state) {
    return {
      key: "stateMatch",
      label: "State match",
      points: 0,
      maxPoints: MAX_POINTS.stateMatch,
      detail: "No state filter",
    };
  }
  const matches = prospect.stateCode === state;
  return {
    key: "stateMatch",
    label: "State match",
    points: matches ? MAX_POINTS.stateMatch : 0,
    maxPoints: MAX_POINTS.stateMatch,
    detail: matches
      ? `Located in ${state}`
      : `Outside ${state}`,
  };
}

function scoreStructurePenalty(
  prospect: RawProspect,
  query: SearchQuery,
): ScoreFactor {
  if (!hasStructuredIntent(query)) {
    return {
      key: "structurePenalty",
      label: "Structure penalty",
      points: 0,
      maxPoints: 0,
      detail: "No structured intent",
    };
  }

  let penalty = 0;
  const reasons: string[] = [];

  const sectorId = query.profile.sectorId;
  if (
    sectorId &&
    prospect.sectorId &&
    prospect.sectorId !== sectorId &&
    SECTOR_INCOMPATIBLE[sectorId]?.includes(prospect.sectorId)
  ) {
    penalty += STRUCTURE_PENALTY_MAX;
    reasons.push(`Incompatible sector (${prospect.sectorId})`);
  }

  const industryId = query.profile.industryId;
  if (
    industryId &&
    prospect.industryId &&
    !industryMatches(prospect, industryId)
  ) {
    penalty += 25;
    reasons.push("Wrong industry");
  }

  return {
    key: "structurePenalty",
    label: "Structure penalty",
    points: -penalty,
    maxPoints: 0,
    detail: reasons.length > 0 ? reasons.join("; ") : "No mismatch",
  };
}

function scoreBuyerMatch(
  prospect: RawProspect,
  query: SearchQuery,
): ScoreFactor {
  const matches = prospect.buyerPack === query.profile.targetBuyer;
  const max = hasStructuredIntent(query)
    ? Math.round(MAX_POINTS.buyerMatch * 0.5)
    : MAX_POINTS.buyerMatch;
  return {
    key: "buyerMatch",
    label: "Buyer match",
    points: matches ? max : 0,
    maxPoints: max,
    detail: matches
      ? "In the buyer ecosystem you targeted"
      : "Outside the selected buyer ecosystem",
  };
}

function scoreRegionMatch(
  prospect: RawProspect,
  query: SearchQuery,
): ScoreFactor {
  const noFilter = query.profile.region === ANY_REGION;
  const matches = noFilter || prospect.region === query.profile.region;
  return {
    key: "regionMatch",
    label: "Region match",
    points: matches ? MAX_POINTS.regionMatch : 0,
    maxPoints: MAX_POINTS.regionMatch,
    detail: noFilter
      ? "No region filter applied"
      : matches
        ? `Located in ${regionLabel(query.profile.region)}`
        : `Outside ${regionLabel(query.profile.region)}`,
  };
}

function scoreProblemFit(
  signals: ProspectSignal[],
  prospect: RawProspect,
  query: SearchQuery,
): ScoreFactor {
  const ideal = query.profile.idealSignals;

  if (ideal.length > 0) {
    const matched = signals.filter((s) => ideal.includes(s.id));
    const ratio = matched.length / ideal.length;
    const points = clamp(
      Math.round(ratio * MAX_POINTS.problemFit),
      0,
      MAX_POINTS.problemFit,
    );
    return {
      key: "problemFit",
      label: "Problem fit",
      points,
      maxPoints: MAX_POINTS.problemFit,
      detail:
        matched.length > 0
          ? `Matches your focus: ${matched.map((s) => s.label).join(", ")}`
          : "No signals match your stated focus",
    };
  }

  const sells = query.profile.whatTheySell.toLowerCase();
  const sellsTokens = sells.split(/[^a-z0-9]+/).filter(Boolean);
  const matchedKeyword = prospect.fitKeywords.find((kw) => {
    const k = kw.toLowerCase();
    return sells.includes(k) || sellsTokens.some((t) => t.length > 2 && k.includes(t));
  });
  const points = matchedKeyword
    ? Math.round(MAX_POINTS.problemFit * 0.7)
    : Math.round(MAX_POINTS.problemFit * 0.4);
  return {
    key: "problemFit",
    label: "Problem fit",
    points,
    maxPoints: MAX_POINTS.problemFit,
    detail: matchedKeyword
      ? `General fit for "${query.profile.whatTheySell}"`
      : "Baseline ecosystem fit",
  };
}

function scoreSignalStrength(signals: ProspectSignal[]): ScoreFactor {
  const strength = avg(signals.map((s) => s.strengthScore));
  const points = clamp(
    Math.round(strength * MAX_POINTS.signalStrength),
    0,
    MAX_POINTS.signalStrength,
  );
  const strongCount = signals.filter((s) => s.strength === "strong").length;
  return {
    key: "signalStrength",
    label: "Signal strength",
    points,
    maxPoints: MAX_POINTS.signalStrength,
    detail:
      signals.length > 0
        ? `${strongCount} strong of ${signals.length} signal${signals.length > 1 ? "s" : ""}`
        : "No active signals",
  };
}

function scoreSignalFreshness(signals: ProspectSignal[]): ScoreFactor {
  const freshness = avg(signals.map((s) => freshnessFactor(s.freshnessDays)));
  const points = clamp(
    Math.round(freshness * MAX_POINTS.signalFreshness),
    0,
    MAX_POINTS.signalFreshness,
  );
  const freshest =
    signals.length > 0
      ? Math.min(...signals.map((s) => s.freshnessDays))
      : undefined;
  return {
    key: "signalFreshness",
    label: "Signal freshness",
    points,
    maxPoints: MAX_POINTS.signalFreshness,
    detail:
      freshest !== undefined
        ? `Freshest signal ~${freshest}d ago`
        : "No recent activity",
  };
}

function scoreOutreachUrgency(signals: ProspectSignal[]): ScoreFactor {
  const topUrgency = signals.length > 0 ? signals[0].urgency : 0;
  const points = clamp(
    Math.round(topUrgency * MAX_POINTS.outreachUrgency),
    0,
    MAX_POINTS.outreachUrgency,
  );
  return {
    key: "outreachUrgency",
    label: "Outreach urgency",
    points,
    maxPoints: MAX_POINTS.outreachUrgency,
    detail:
      signals.length > 0
        ? `Lead signal: ${signals[0].label}`
        : "No time-sensitive trigger",
  };
}

/** Compute the explainable opportunity score (structured discovery first). */
export function scoreProspect(
  prospect: RawProspect,
  signals: ProspectSignal[],
  query: SearchQuery,
): ScoreBreakdown {
  const factors: ScoreFactor[] = [
    scoreIndustryMatch(prospect, query),
    scoreSectorMatch(prospect, query),
    scoreOrgTypeMatch(prospect, query),
    scoreStateMatch(prospect, query),
    scoreRegionMatch(prospect, query),
    scoreStructurePenalty(prospect, query),
    scoreBuyerMatch(prospect, query),
    scoreProblemFit(signals, prospect, query),
    scoreSignalStrength(signals),
    scoreSignalFreshness(signals),
    scoreOutreachUrgency(signals),
  ];

  const total = clamp(
    factors.reduce((acc, f) => acc + f.points, 0),
    0,
    100,
  );

  return { total, factors };
}
