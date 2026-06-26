import type { BuyerPack } from "@/lib/search/types";

/**
 * Municipalities / Public Sector buyer ecosystem.
 *
 * Sellers that target this pack include benefits consulting, legal services,
 * accounting/advisory, IT consulting, and insurance. Procurement timing and
 * RFP cycles dominate opportunity in this ecosystem.
 */
export const publicSector: BuyerPack = {
  id: "public-sector",
  label: "Municipalities / Public Sector",
  description:
    "Cities, counties, school districts, and state agencies bound by procurement cycles.",
  buyerExamples: [
    "City & county governments",
    "School districts",
    "State agencies",
    "Public authorities",
  ],
  signals: [
    {
      id: "rfp-activity",
      label: "RFP activity",
      weight: 0.95,
      type: "procurement",
      source: "RSS",
      evidence: "Public RFP / bid posting placeholder",
      whyNow: "An active RFP defines a time-boxed buying window right now",
      suggestedAction: "Map your response directly to the RFP scoring criteria",
    },
    {
      id: "budget-cycle",
      label: "Budget cycle",
      weight: 0.8,
      type: "procurement",
      source: "Company",
      evidence: "Published budget calendar placeholder",
      whyNow: "Budget-cycle timing aligns with new funding decisions",
      suggestedAction: "Engage before budget allocations are finalized",
    },
    {
      id: "employee-benefits-pressure",
      label: "Employee benefits pressure",
      weight: 0.85,
      type: "financial",
      source: "RSS",
      evidence: "Public benefits cost coverage placeholder",
      whyNow: "Public benefits cost pressure is pushing procurement to act",
      suggestedAction: "Lead with benefits relief within budget limits",
    },
    {
      id: "procurement-timing",
      label: "Procurement timing",
      weight: 0.9,
      type: "procurement",
      source: "Company",
      evidence: "Procurement schedule placeholder",
      whyNow: "Procurement timing favors early, informed engagement",
      suggestedAction: "Get pre-positioned ahead of the solicitation",
    },
    {
      id: "regulatory-requirements",
      label: "Regulatory requirements",
      weight: 0.7,
      type: "regulatory",
      source: "RSS",
      evidence: "Mandate / regulation coverage placeholder",
      whyNow: "New mandates require compliant solutions on a deadline",
      suggestedAction: "Frame compliance with the new requirement",
    },
  ],
  contactRoles: [
    "Procurement Director",
    "Chief Financial Officer",
    "Director of Human Resources",
    "City/County Administrator",
    "Director of Risk Management",
  ],
};
