import type { BuyerPackId } from "@/lib/search/types";
import { buyerPacks } from "@/lib/packs";

/**
 * Capability inference.
 *
 * Maps phrases found in a seller's free-text description of what they sell /
 * the problem they solve onto the catalog signal ids that represent that
 * problem. This is what lets a query like "reduce specialty drug spend" line
 * up with prospects showing `specialty-drug-exposure` and `pbm-transition-risk`.
 *
 * Heuristic and intentionally simple for the MVP. An LLM capability extractor
 * could replace `inferIdealSignals` later behind the same signature.
 */
const CAPABILITY_SIGNALS: { match: string[]; signals: string[] }[] = [
  {
    match: ["specialty drug", "specialty"],
    signals: ["specialty-drug-exposure", "specialty-pharmacy-growth"],
  },
  {
    match: ["pbm", "rebate", "formulary"],
    signals: ["pbm-transition-risk", "specialty-drug-exposure"],
  },
  {
    match: ["pharmacy"],
    signals: [
      "pbm-transition-risk",
      "specialty-drug-exposure",
      "specialty-pharmacy-growth",
      "pharmacy-leadership-change",
    ],
  },
  {
    match: ["medicare", "advantage"],
    signals: ["medicare-growth", "star-ratings-pressure"],
  },
  { match: ["star rating", "stars", "quality"], signals: ["star-ratings-pressure"] },
  { match: ["340b"], signals: ["340b-exposure"] },
  {
    match: ["packaging", "banding", "labeling"],
    signals: ["packaging-engineer-hiring", "new-product-launch"],
  },
  {
    match: ["automation", "robotics", "line"],
    signals: ["automation-investment", "packaging-engineer-hiring"],
  },
  { match: ["recall", "compliance", "regulatory"], signals: ["recall-activity", "regulatory-pressure", "regulatory-requirements"] },
  { match: ["sustainab", "recycl"], signals: ["sustainability-initiative"] },
  {
    match: ["benefit", "total rewards"],
    signals: [
      "benefits-cost-pressure",
      "employee-benefits-pressure",
      "large-employee-base",
    ],
  },
  {
    match: ["cost", "spend", "savings", "reduce"],
    signals: ["cost-pressure", "benefits-cost-pressure", "pbm-transition-risk"],
  },
  {
    match: ["merger", "m&a", "integration", "consolidat"],
    signals: ["merger-activity", "recent-acquisition"],
  },
  {
    match: ["recruit", "talent", "hiring", "staffing"],
    signals: ["packaging-engineer-hiring", "new-executive-hire", "pharmacy-leadership-change"],
  },
  {
    match: ["insurance", "risk", "liability"],
    signals: ["benefits-cost-pressure", "multi-state-footprint"],
  },
  {
    match: ["rfp", "procurement", "bid", "proposal"],
    signals: ["rfp-activity", "procurement-timing", "budget-cycle"],
  },
];

/**
 * Infer the catalog signal ids that best match the user's capability text,
 * scoped to the chosen buyer pack so we never suggest an out-of-pack signal.
 */
export function inferIdealSignals(
  capabilityText: string,
  pack: BuyerPackId,
): string[] {
  const text = capabilityText.toLowerCase();
  const packSignalIds = new Set(buyerPacks[pack].signals.map((s) => s.id));
  const found = new Set<string>();

  for (const entry of CAPABILITY_SIGNALS) {
    if (entry.match.some((m) => text.includes(m))) {
      for (const id of entry.signals) {
        if (packSignalIds.has(id)) found.add(id);
      }
    }
  }

  return [...found];
}
