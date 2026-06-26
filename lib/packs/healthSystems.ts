import type { BuyerPack } from "@/lib/search/types";

/**
 * Health Systems / Hospitals buyer ecosystem.
 *
 * Sellers that target this pack include specialty pharmacy services, 340B
 * consulting, revenue-cycle analytics, care management, and IT consulting.
 */
export const healthSystems: BuyerPack = {
  id: "health-systems",
  label: "Health Systems / Hospitals",
  description:
    "Integrated delivery networks, hospitals, and academic medical centers.",
  buyerExamples: [
    "Regional health systems",
    "Academic medical centers",
    "Community hospitals",
    "Integrated delivery networks",
  ],
  signals: [
    {
      id: "merger-activity",
      label: "Merger activity",
      weight: 0.9,
      type: "growth",
      source: "RSS",
      evidence: "Merger / affiliation announcement placeholder",
      whyNow: "Merger activity is forcing consolidation of systems and vendors",
      suggestedAction: "Position around post-merger consolidation savings",
    },
    {
      id: "specialty-pharmacy-growth",
      label: "Specialty pharmacy growth",
      weight: 0.85,
      type: "financial",
      source: "RSS",
      evidence: "Specialty pharmacy expansion placeholder",
      whyNow: "Specialty pharmacy growth is raising margin and risk stakes",
      suggestedAction: "Lead with specialty pharmacy economics and capture",
    },
    {
      id: "340b-exposure",
      label: "340B exposure",
      weight: 0.8,
      type: "regulatory",
      source: "CMS",
      evidence: "340B covered-entity status placeholder",
      whyNow: "340B program scrutiny makes optimization high-value now",
      suggestedAction: "Offer a 340B program integrity and savings review",
    },
    {
      id: "cost-pressure",
      label: "Cost pressure",
      weight: 0.7,
      type: "financial",
      source: "SEC",
      evidence: "Operating margin pressure in filings placeholder",
      whyNow: "Operating margin pressure is sharpening appetite for savings",
      suggestedAction: "Lead with cost-to-serve reduction and quick wins",
    },
    {
      id: "new-executive-hire",
      label: "New executive hire",
      weight: 0.75,
      type: "leadership",
      source: "RSS",
      evidence: "Executive appointment announcement placeholder",
      whyNow: "A new executive is re-evaluating partners and priorities",
      suggestedAction: "Engage the new executive with a strategic briefing",
    },
    {
      id: "service-line-expansion",
      label: "Service line expansion",
      weight: 0.7,
      type: "growth",
      source: "Company",
      evidence: "New service line announcement placeholder",
      whyNow: "Service-line expansion is opening fresh capability gaps",
      suggestedAction: "Map your offering to the new service line's needs",
    },
  ],
  contactRoles: [
    "Chief Pharmacy Officer",
    "VP of Pharmacy Services",
    "Chief Financial Officer",
    "VP of Strategy",
    "Director of 340B Program",
  ],
};
