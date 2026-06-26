import type { BuyerPack } from "@/lib/search/types";

/**
 * Employers buyer ecosystem.
 *
 * Sellers that target this pack include benefits consulting, commercial
 * insurance, care management, and HR/IT services. Self-insured employers in
 * particular feel benefits cost pressure directly.
 */
export const employers: BuyerPack = {
  id: "employers",
  label: "Employers",
  description:
    "Mid-to-large employers, especially self-insured organizations managing benefits spend.",
  buyerExamples: [
    "Self-insured employers",
    "Multi-state employers",
    "Manufacturers with large workforces",
    "Regional employers",
  ],
  signals: [
    {
      id: "large-employee-base",
      label: "Large employee base",
      weight: 0.8,
      type: "demand",
      source: "Company",
      evidence: "Reported headcount placeholder",
      whyNow: "A large workforce magnifies every dollar of benefits spend",
      suggestedAction: "Quantify per-employee savings at their headcount",
    },
    {
      id: "benefits-cost-pressure",
      label: "Benefits cost pressure",
      weight: 0.9,
      type: "financial",
      source: "RSS",
      evidence: "Benefits cost / earnings coverage placeholder",
      whyNow: "Rising benefits costs are motivating plan redesign now",
      suggestedAction: "Lead with benefits cost containment options",
    },
    {
      id: "union-workforce",
      label: "Union workforce",
      weight: 0.65,
      type: "operational",
      source: "RSS",
      evidence: "Labor / union coverage placeholder",
      whyNow: "Union dynamics are shaping benefits decisions this cycle",
      suggestedAction: "Offer union-aware plan design guidance",
    },
    {
      id: "multi-state-footprint",
      label: "Multi-state footprint",
      weight: 0.7,
      type: "operational",
      source: "SEC",
      evidence: "Multi-state operations disclosure placeholder",
      whyNow: "A multi-state footprint complicates compliance and plans",
      suggestedAction: "Pitch multi-state compliance simplification",
    },
    {
      id: "recent-growth",
      label: "Recent growth",
      weight: 0.75,
      type: "growth",
      source: "SEC",
      evidence: "Revenue / headcount growth placeholder",
      whyNow: "Rapid growth is straining existing HR and benefits programs",
      suggestedAction: "Position scalable HR and benefits infrastructure",
    },
  ],
  contactRoles: [
    "VP of Total Rewards",
    "Director of Benefits",
    "Chief Human Resources Officer",
    "VP of Human Resources",
    "Benefits Manager",
  ],
};
