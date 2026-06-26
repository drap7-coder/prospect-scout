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
 * Explainable, SIGNAL-DRIVEN opportunity scoring.
 *
 * Unlike a static "fit" score, this rewards live evidence: a prospect ranks
 * high when it shows strong, fresh signals that match the problem the user
 * solves — and when the timing is urgent. The total (0–100) is the sum of six
 * transparent factors, each reporting points, max, and a human reason.
 */

const MAX_POINTS = {
  buyerMatch: 20,
  regionMatch: 15,
  problemFit: 20,
  signalStrength: 20,
  signalFreshness: 15,
  outreachUrgency: 10,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function scoreBuyerMatch(
  prospect: RawProspect,
  query: SearchQuery,
): ScoreFactor {
  const matches = prospect.buyerPack === query.profile.targetBuyer;
  return {
    key: "buyerMatch",
    label: "Buyer match",
    points: matches ? MAX_POINTS.buyerMatch : 0,
    maxPoints: MAX_POINTS.buyerMatch,
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

  // Fallback when no capability was inferred: use seller keyword overlap.
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

/** Compute the explainable, signal-driven opportunity score. */
export function scoreProspect(
  prospect: RawProspect,
  signals: ProspectSignal[],
  query: SearchQuery,
): ScoreBreakdown {
  const factors: ScoreFactor[] = [
    scoreBuyerMatch(prospect, query),
    scoreRegionMatch(prospect, query),
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
