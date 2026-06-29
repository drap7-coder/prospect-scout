import type { EmailPatternConfidenceLabel, EmailPatternId } from "./types";

export function confidenceLabelFromScore(score: number): EmailPatternConfidenceLabel {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

/** Score dominant pattern from classified observation counts. */
export function scorePatternConfidence(input: {
  dominantCount: number;
  totalClassified: number;
  totalObserved: number;
  source: "observed_public_emails" | "inferred" | "unknown";
}): number {
  const { dominantCount, totalClassified, totalObserved, source } = input;
  if (source === "unknown" || totalObserved === 0) return 0.1;
  if (totalClassified === 0) return 0.2;

  let score = 0.25;
  if (dominantCount >= 3) score += 0.45;
  else if (dominantCount === 2) score += 0.3;
  else if (dominantCount === 1) score += 0.15;

  const agreement = totalClassified > 0 ? dominantCount / totalClassified : 0;
  score += agreement * 0.25;

  if (source === "inferred") score *= 0.7;
  return Math.min(1, Math.max(0, score));
}

export function pickDominantPattern(
  votes: Map<EmailPatternId, number>,
): { pattern: EmailPatternId; count: number } {
  let best: EmailPatternId = "unknown";
  let bestCount = 0;
  for (const [pattern, count] of votes) {
    if (pattern === "unknown") continue;
    if (count > bestCount) {
      best = pattern;
      bestCount = count;
    }
  }
  return { pattern: bestCount > 0 ? best : "unknown", count: bestCount };
}
