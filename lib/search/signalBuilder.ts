import type {
  BuyerPackId,
  ProspectSignal,
  RawProspect,
  RawSignalInstance,
  SignalStrength,
} from "@/lib/search/types";
import { getSignal } from "@/lib/packs";

/**
 * Merges a buyer pack's catalog signal definition with an organization's
 * observed instance (strength + freshness) to produce a fully enriched
 * `ProspectSignal` that downstream scoring, synthesis, and the UI can use.
 */

/** Qualitative strength → numeric score (0–1). */
const STRENGTH_SCORE: Record<SignalStrength, number> = {
  weak: 0.45,
  moderate: 0.7,
  strong: 1,
};

/** Recency factor (0–1): fresh signals matter more; ~180d decays to zero. */
export function freshnessFactor(days: number): number {
  return Math.max(0, Math.min(1, 1 - days / 180));
}

/** Combined urgency (0–1): mostly strength, partly recency. */
export function signalUrgency(strengthScore: number, days: number): number {
  return strengthScore * 0.6 + freshnessFactor(days) * 0.4;
}

function buildSignal(
  packId: BuyerPackId,
  instance: RawSignalInstance,
): ProspectSignal | null {
  const def = getSignal(packId, instance.signalId);
  if (!def) return null;

  const strengthScore = STRENGTH_SCORE[instance.strength];
  return {
    id: def.id,
    label: def.label,
    type: def.type,
    strength: instance.strength,
    strengthScore,
    source: def.source,
    evidenceText: instance.evidenceOverride ?? def.evidence,
    whyNow: def.whyNow,
    suggestedAction: def.suggestedAction,
    freshnessDays: instance.freshnessDays,
    urgency: signalUrgency(strengthScore, instance.freshnessDays),
  };
}

/** Build all signals for a prospect, sorted by urgency (most urgent first). */
export function buildProspectSignals(prospect: RawProspect): ProspectSignal[] {
  return prospect.signals
    .map((instance) => buildSignal(prospect.buyerPack, instance))
    .filter((s): s is ProspectSignal => s !== null)
    .sort((a, b) => b.urgency - a.urgency);
}
