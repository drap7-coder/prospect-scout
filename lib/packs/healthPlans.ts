import type { BuyerPack } from "@/lib/search/types";

/**
 * Health Plans buyer ecosystem.
 *
 * Sellers that target this pack include PBM consulting, actuarial software,
 * care management, pharmacy consulting, and analytics. The ecosystem — not
 * the seller's industry — is the organizing unit.
 */
export const healthPlans: BuyerPack = {
  id: "health-plans",
  label: "Health Plans",
  description:
    "Regional and national payers, Medicare/Medicaid plans, and managed care organizations.",
  buyerExamples: [
    "Regional health plans",
    "Medicare Advantage plans",
    "Medicaid managed care",
    "Provider-sponsored plans",
  ],
  signals: [
    {
      id: "medicare-growth",
      label: "Medicare growth",
      weight: 0.9,
      type: "growth",
      source: "CMS",
      evidence: "Medicare Advantage enrollment up year-over-year placeholder",
      whyNow: "Medicare growth raises pharmacy and clinical stakes this plan year",
      suggestedAction: "Open with Medicare readiness and pharmacy trend benchmarks",
    },
    {
      id: "pharmacy-leadership-change",
      label: "Pharmacy leadership change",
      weight: 0.85,
      type: "leadership",
      source: "RSS",
      evidence: "New pharmacy executive announcement placeholder",
      whyNow: "A new pharmacy leader is reassessing strategy and vendors now",
      suggestedAction: "Reach the new pharmacy leader with a 90-day quick-win plan",
    },
    {
      id: "pbm-transition-risk",
      label: "PBM transition risk",
      weight: 0.95,
      type: "financial",
      source: "RSS",
      evidence: "PBM contract renewal coverage placeholder",
      whyNow: "A PBM contract window creates urgency around cost control",
      suggestedAction: "Offer a PBM transition risk assessment ahead of renewal",
    },
    {
      id: "specialty-drug-exposure",
      label: "Specialty drug exposure",
      weight: 0.8,
      type: "financial",
      source: "CMS",
      evidence: "High specialty drug utilization mix placeholder",
      whyNow: "Specialty trend is pressuring net cost heading into bid season",
      suggestedAction: "Lead with specialty drug spend containment levers",
    },
    {
      id: "star-ratings-pressure",
      label: "Star Ratings pressure",
      weight: 0.7,
      type: "regulatory",
      source: "CMS",
      evidence: "Star Ratings slippage placeholder",
      whyNow: "The Star Ratings cycle is forcing near-term quality investment",
      suggestedAction: "Tie your offering to measurable Star Ratings gains",
    },
    {
      id: "recent-acquisition",
      label: "Recent acquisition",
      weight: 0.75,
      type: "growth",
      source: "SEC",
      evidence: "Acquisition / 8-K filing placeholder",
      whyNow: "Post-acquisition integration is reopening vendor decisions",
      suggestedAction: "Position around integration and consolidation savings",
    },
    {
      id: "regulatory-pressure",
      label: "Regulatory pressure",
      weight: 0.65,
      type: "regulatory",
      source: "RSS",
      evidence: "Regulatory action coverage placeholder",
      whyNow: "New regulatory requirements demand near-term compliance moves",
      suggestedAction: "Frame your solution as a fast path to compliance",
    },
  ],
  contactRoles: [
    "Chief Pharmacy Officer",
    "VP of Pharmacy",
    "Chief Medical Officer",
    "VP of Medicare",
    "Director of Clinical Programs",
  ],
};
