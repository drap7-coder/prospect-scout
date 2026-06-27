import { normalizeEinDigits } from "./normalize";

function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(inc|incorporated|corp|corporation|llc|ltd|the|of|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token overlap similarity (0–1). */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeNameKey(a);
  const nb = normalizeNameKey(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  const tokensA = new Set(na.split(" ").filter((t) => t.length >= 3));
  const tokensB = new Set(nb.split(" ").filter((t) => t.length >= 3));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  const intersection = [...tokensA].filter((t) => tokensB.has(t));
  const union = new Set([...tokensA, ...tokensB]);
  return intersection.length / union.size;
}

export interface MatchInput {
  name?: string | null;
  ein?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface MatchTarget {
  ein: string | number;
  name: string;
  city?: string | null;
  state?: string | null;
}

/** Confidence that a ProPublica record matches the input org (0–1). */
export function scoreNonprofitMatch(input: MatchInput, target: MatchTarget): number {
  const inputEin = normalizeEinDigits(input.ein);
  const targetEin = normalizeEinDigits(target.ein);

  if (inputEin && targetEin && inputEin === targetEin) {
    return 0.98;
  }

  let score = 0;

  if (input.name && target.name) {
    score += nameSimilarity(input.name, target.name) * 0.65;
  }

  const inputState = input.state?.trim().toUpperCase();
  const targetState = target.state?.trim().toUpperCase();
  if (inputState && targetState && inputState === targetState) {
    score += 0.2;
  }

  const inputCity = input.city?.trim().toLowerCase();
  const targetCity = target.city?.trim().toLowerCase();
  if (inputCity && targetCity && inputCity === targetCity) {
    score += 0.1;
  }

  if (inputEin && targetEin && inputEin.endsWith(targetEin)) {
    score += 0.15;
  }

  return Math.min(Math.round(score * 1000) / 1000, 0.95);
}

/** Minimum confidence to attach enrichment to a catalog org. */
export const ENRICHMENT_CONFIDENCE_THRESHOLD = 0.72;
