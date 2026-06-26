import type { BuyerPack } from "@/lib/search/types";

/**
 * Manufacturers buyer ecosystem.
 *
 * Sellers that target this pack include packaging/banding equipment,
 * automation integrators, industrial IT, commercial insurance, and
 * recruiting firms placing plant/engineering talent.
 */
export const manufacturers: BuyerPack = {
  id: "manufacturers",
  label: "Manufacturers",
  description:
    "Industrial and consumer-goods producers running one or more production sites.",
  buyerExamples: [
    "Food & beverage manufacturers",
    "Medical device makers",
    "Consumer packaged goods",
    "Industrial equipment makers",
  ],
  signals: [
    {
      id: "plant-expansion",
      label: "Plant expansion",
      weight: 0.9,
      type: "operational",
      source: "RSS",
      evidence: "Plant expansion announcement placeholder",
      whyNow: "New capacity is driving equipment and process decisions now",
      suggestedAction: "Engage operations leaders before line specs are locked",
    },
    {
      id: "new-product-launch",
      label: "New product launch",
      weight: 0.8,
      type: "demand",
      source: "Company",
      evidence: "Product launch press release placeholder",
      whyNow: "An upcoming launch is reshaping packaging and supply needs",
      suggestedAction: "Offer launch-ready packaging and changeover support",
    },
    {
      id: "recall-activity",
      label: "Recall activity",
      weight: 0.7,
      type: "regulatory",
      source: "FDA",
      evidence: "Recall / enforcement record placeholder",
      whyNow: "Recent recall activity is exposing quality and process gaps",
      suggestedAction: "Lead with quality safeguards and corrective-action speed",
    },
    {
      id: "sustainability-initiative",
      label: "Sustainability initiative",
      weight: 0.65,
      type: "operational",
      source: "Company",
      evidence: "Sustainability report goal placeholder",
      whyNow: "Public sustainability targets are triggering materials change",
      suggestedAction: "Pitch sustainable materials with measurable waste cuts",
    },
    {
      id: "packaging-engineer-hiring",
      label: "Packaging engineer hiring",
      weight: 0.85,
      type: "demand",
      source: "Careers",
      evidence: "Packaging engineer role posted placeholder",
      whyNow: "Active packaging-engineer hiring signals live line investment",
      suggestedAction: "Reach the hiring manager while specs are being defined",
    },
    {
      id: "automation-investment",
      label: "Automation investment",
      weight: 0.9,
      type: "financial",
      source: "SEC",
      evidence: "Capex / automation commentary placeholder",
      whyNow: "Capital is actively flowing toward automation this cycle",
      suggestedAction: "Quantify automation ROI and payback period",
    },
    {
      id: "multi-site-operations",
      label: "Multi-site operations",
      weight: 0.7,
      type: "operational",
      source: "Company",
      evidence: "Multi-site facility list placeholder",
      whyNow: "Multiple sites multiply standardization and rollout value",
      suggestedAction: "Propose a multi-site standardization pilot",
    },
  ],
  contactRoles: [
    "VP of Operations",
    "Plant Manager",
    "Director of Engineering",
    "Director of Packaging",
    "VP of Supply Chain",
  ],
};
