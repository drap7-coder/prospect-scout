import type {
  BuyerPackId,
  RawProspect,
  SourcePlan,
} from "@/lib/search/types";

/**
 * Mock prospect provider.
 *
 * This is the ONLY data source in the MVP. It returns hand-authored,
 * realistic-looking organizations — each carrying observed *signal instances*
 * (a catalog signal id + strength + freshness) so the full pipeline (parse ->
 * plan -> fetch -> build signals -> score -> synthesize -> render) can be
 * exercised end-to-end with zero external dependencies, no API keys, no cost.
 *
 * ---------------------------------------------------------------------------
 * FUTURE FREE DATA PROVIDERS
 * Each of the following can be implemented as its own module that satisfies
 * the `ProspectProvider` contract below and is wired in `sourcePlanner.ts`.
 * The `source` on each catalog signal already names where its evidence would
 * come from. None require payment:
 *   - CMS        (data.cms.gov)        : Medicare/Medicaid plan & enrollment
 *   - SEC EDGAR  (sec.gov/edgar)       : public company filings & events
 *   - Census     (api.census.gov)      : County Business Patterns, firm size
 *   - FDA        (open.fda.gov)        : recalls, enforcement, device events
 *   - NPPES      (npiregistry.cms.gov) : provider/organization registry
 *   - Wikipedia  (wikipedia REST API)  : org descriptions & disambiguation
 *   - News/RSS   (public feeds)        : leadership changes, M&A, expansions
 *   - Company websites                 : careers pages, press releases
 * ---------------------------------------------------------------------------
 */

/**
 * Contract every prospect data source implements. The mock provider, and any
 * future real provider, expose the same shape so the search pipeline never
 * needs to know where prospects came from.
 */
export interface ProspectProvider {
  id: string;
  fetch(plan: SourcePlan): Promise<RawProspect[]> | RawProspect[];
}

const MOCK_DATA: RawProspect[] = [
  // ---------------------------- Health Plans ----------------------------
  {
    id: "hp-keystone",
    name: "Keystone Regional Health Plan",
    location: "Pennsylvania",
    region: "mid-atlantic",
    buyerPack: "health-plans",
    size: "large",
    signals: [
      { signalId: "pbm-transition-risk", strength: "strong", freshnessDays: 6 },
      { signalId: "specialty-drug-exposure", strength: "strong", freshnessDays: 18 },
      { signalId: "medicare-growth", strength: "moderate", freshnessDays: 24 },
    ],
    fitKeywords: [
      "pbm consulting",
      "pharmacy consulting",
      "actuarial",
      "specialty drug",
      "analytics",
      "care management",
    ],
  },
  {
    id: "hp-bay-state",
    name: "Bay State Community Health Plan",
    location: "Massachusetts",
    region: "northeast",
    buyerPack: "health-plans",
    size: "mid",
    signals: [
      { signalId: "pharmacy-leadership-change", strength: "strong", freshnessDays: 9 },
      { signalId: "star-ratings-pressure", strength: "moderate", freshnessDays: 40 },
    ],
    fitKeywords: ["pbm consulting", "care management", "analytics", "quality"],
  },
  {
    id: "hp-gulf-coast",
    name: "Gulf Coast Health Partners",
    location: "Florida",
    region: "southeast",
    buyerPack: "health-plans",
    size: "large",
    signals: [
      { signalId: "recent-acquisition", strength: "strong", freshnessDays: 14 },
      { signalId: "medicare-growth", strength: "moderate", freshnessDays: 30 },
      { signalId: "regulatory-pressure", strength: "weak", freshnessDays: 65 },
    ],
    fitKeywords: ["pbm consulting", "actuarial", "analytics", "compliance"],
  },
  {
    id: "hp-great-lakes",
    name: "Great Lakes Mutual Health",
    location: "Michigan",
    region: "midwest",
    buyerPack: "health-plans",
    size: "mid",
    signals: [
      { signalId: "pbm-transition-risk", strength: "moderate", freshnessDays: 38 },
      { signalId: "specialty-drug-exposure", strength: "moderate", freshnessDays: 52 },
    ],
    fitKeywords: ["pbm consulting", "pharmacy consulting", "specialty drug"],
  },
  {
    id: "hp-sierra",
    name: "Sierra Valley Health Plan",
    location: "California",
    region: "west",
    buyerPack: "health-plans",
    size: "enterprise",
    signals: [
      { signalId: "specialty-drug-exposure", strength: "strong", freshnessDays: 11 },
      { signalId: "medicare-growth", strength: "strong", freshnessDays: 21 },
      { signalId: "star-ratings-pressure", strength: "moderate", freshnessDays: 70 },
    ],
    fitKeywords: ["analytics", "care management", "actuarial", "pbm consulting"],
  },

  // ---------------------------- Manufacturers ----------------------------
  {
    id: "mf-allegheny",
    name: "Allegheny Precision Packaging",
    location: "Pennsylvania",
    region: "mid-atlantic",
    buyerPack: "manufacturers",
    size: "mid",
    signals: [
      { signalId: "packaging-engineer-hiring", strength: "strong", freshnessDays: 5 },
      { signalId: "automation-investment", strength: "strong", freshnessDays: 16 },
      { signalId: "plant-expansion", strength: "moderate", freshnessDays: 33 },
    ],
    fitKeywords: [
      "packaging",
      "banding equipment",
      "automation",
      "it consulting",
      "commercial insurance",
    ],
  },
  {
    id: "mf-northstar",
    name: "Northstar Food Group",
    location: "Minnesota",
    region: "midwest",
    buyerPack: "manufacturers",
    size: "large",
    signals: [
      { signalId: "new-product-launch", strength: "strong", freshnessDays: 10 },
      { signalId: "automation-investment", strength: "moderate", freshnessDays: 28 },
      { signalId: "sustainability-initiative", strength: "moderate", freshnessDays: 44 },
    ],
    fitKeywords: ["packaging", "banding equipment", "marketing", "recruiting"],
  },
  {
    id: "mf-lone-star",
    name: "Lone Star Medical Devices",
    location: "Texas",
    region: "southwest",
    buyerPack: "manufacturers",
    size: "mid",
    signals: [
      { signalId: "recall-activity", strength: "strong", freshnessDays: 8 },
      { signalId: "packaging-engineer-hiring", strength: "moderate", freshnessDays: 35 },
    ],
    fitKeywords: ["packaging", "legal services", "it consulting", "recruiting"],
  },
  {
    id: "mf-cascade",
    name: "Cascade Consumer Brands",
    location: "Oregon",
    region: "west",
    buyerPack: "manufacturers",
    size: "large",
    signals: [
      { signalId: "automation-investment", strength: "strong", freshnessDays: 19 },
      { signalId: "new-product-launch", strength: "moderate", freshnessDays: 47 },
    ],
    fitKeywords: ["packaging", "banding equipment", "automation", "marketing"],
  },

  // ------------------------- Health Systems --------------------------
  {
    id: "hs-chesapeake",
    name: "Chesapeake Regional Health System",
    location: "Maryland",
    region: "mid-atlantic",
    buyerPack: "health-systems",
    size: "large",
    signals: [
      { signalId: "specialty-pharmacy-growth", strength: "strong", freshnessDays: 12 },
      { signalId: "340b-exposure", strength: "strong", freshnessDays: 26 },
      { signalId: "new-executive-hire", strength: "moderate", freshnessDays: 31 },
    ],
    fitKeywords: [
      "pharmacy consulting",
      "340b",
      "specialty pharmacy",
      "analytics",
      "it consulting",
    ],
  },
  {
    id: "hs-summit",
    name: "Summit Health Network",
    location: "Colorado",
    region: "west",
    buyerPack: "health-systems",
    size: "enterprise",
    signals: [
      { signalId: "merger-activity", strength: "strong", freshnessDays: 7 },
      { signalId: "cost-pressure", strength: "moderate", freshnessDays: 41 },
      { signalId: "service-line-expansion", strength: "moderate", freshnessDays: 58 },
    ],
    fitKeywords: ["analytics", "advisory", "it consulting", "accounting"],
  },
  {
    id: "hs-piedmont",
    name: "Piedmont Care Alliance",
    location: "North Carolina",
    region: "southeast",
    buyerPack: "health-systems",
    size: "large",
    signals: [
      { signalId: "340b-exposure", strength: "moderate", freshnessDays: 36 },
      { signalId: "specialty-pharmacy-growth", strength: "moderate", freshnessDays: 49 },
    ],
    fitKeywords: ["pharmacy consulting", "340b", "specialty pharmacy"],
  },
  {
    id: "hs-lakeshore",
    name: "Lakeshore Academic Medical Center",
    location: "Illinois",
    region: "midwest",
    buyerPack: "health-systems",
    size: "enterprise",
    signals: [
      { signalId: "new-executive-hire", strength: "strong", freshnessDays: 13 },
      { signalId: "cost-pressure", strength: "moderate", freshnessDays: 45 },
    ],
    fitKeywords: ["advisory", "analytics", "it consulting", "legal services"],
  },

  // ----------------------------- Employers -----------------------------
  {
    id: "emp-keystone-mfg",
    name: "Keystone Manufacturing Co.",
    location: "Pennsylvania",
    region: "mid-atlantic",
    buyerPack: "employers",
    size: "large",
    signals: [
      { signalId: "benefits-cost-pressure", strength: "strong", freshnessDays: 17 },
      { signalId: "large-employee-base", strength: "moderate", freshnessDays: 60 },
      { signalId: "union-workforce", strength: "moderate", freshnessDays: 72 },
    ],
    fitKeywords: [
      "benefits",
      "commercial insurance",
      "care management",
      "advisory",
    ],
  },
  {
    id: "emp-sunbelt",
    name: "Sunbelt Logistics Group",
    location: "Georgia",
    region: "southeast",
    buyerPack: "employers",
    size: "enterprise",
    signals: [
      { signalId: "recent-growth", strength: "strong", freshnessDays: 9 },
      { signalId: "multi-state-footprint", strength: "strong", freshnessDays: 22 },
      { signalId: "benefits-cost-pressure", strength: "moderate", freshnessDays: 39 },
    ],
    fitKeywords: ["benefits", "commercial insurance", "it consulting", "recruiting"],
  },
  {
    id: "emp-harbor",
    name: "Harbor Retail Holdings",
    location: "New Jersey",
    region: "mid-atlantic",
    buyerPack: "employers",
    size: "large",
    signals: [
      { signalId: "recent-growth", strength: "moderate", freshnessDays: 27 },
      { signalId: "large-employee-base", strength: "moderate", freshnessDays: 55 },
    ],
    fitKeywords: ["benefits", "marketing", "advisory", "commercial insurance"],
  },
  {
    id: "emp-front-range",
    name: "Front Range Technologies",
    location: "Colorado",
    region: "west",
    buyerPack: "employers",
    size: "mid",
    signals: [
      { signalId: "benefits-cost-pressure", strength: "moderate", freshnessDays: 34 },
      { signalId: "recent-growth", strength: "moderate", freshnessDays: 50 },
    ],
    fitKeywords: ["benefits", "recruiting", "it consulting", "advisory"],
  },

  // --------------------------- Public Sector ---------------------------
  {
    id: "ps-allentown",
    name: "City of Allentown",
    location: "Pennsylvania",
    region: "mid-atlantic",
    buyerPack: "public-sector",
    size: "mid",
    signals: [
      { signalId: "rfp-activity", strength: "strong", freshnessDays: 4 },
      { signalId: "procurement-timing", strength: "strong", freshnessDays: 15 },
      { signalId: "budget-cycle", strength: "moderate", freshnessDays: 29 },
    ],
    fitKeywords: [
      "benefits",
      "legal services",
      "accounting",
      "advisory",
      "it consulting",
    ],
  },
  {
    id: "ps-mecklenburg",
    name: "Mecklenburg County",
    location: "North Carolina",
    region: "southeast",
    buyerPack: "public-sector",
    size: "large",
    signals: [
      { signalId: "employee-benefits-pressure", strength: "strong", freshnessDays: 20 },
      { signalId: "budget-cycle", strength: "moderate", freshnessDays: 42 },
      { signalId: "regulatory-requirements", strength: "weak", freshnessDays: 68 },
    ],
    fitKeywords: ["benefits", "advisory", "accounting", "commercial insurance"],
  },
  {
    id: "ps-maricopa-schools",
    name: "Maricopa Unified School District",
    location: "Arizona",
    region: "southwest",
    buyerPack: "public-sector",
    size: "large",
    signals: [
      { signalId: "rfp-activity", strength: "strong", freshnessDays: 6 },
      { signalId: "procurement-timing", strength: "moderate", freshnessDays: 37 },
    ],
    fitKeywords: ["benefits", "legal services", "it consulting", "marketing"],
  },
  {
    id: "ps-dane",
    name: "Dane County Government",
    location: "Wisconsin",
    region: "midwest",
    buyerPack: "public-sector",
    size: "mid",
    signals: [
      { signalId: "budget-cycle", strength: "moderate", freshnessDays: 33 },
      { signalId: "employee-benefits-pressure", strength: "moderate", freshnessDays: 48 },
      { signalId: "regulatory-requirements", strength: "weak", freshnessDays: 75 },
    ],
    fitKeywords: ["benefits", "accounting", "advisory", "legal services"],
  },
];

/** Mock provider instance satisfying the shared `ProspectProvider` contract. */
export const mockProspectProvider: ProspectProvider = {
  id: "mock",
  fetch(plan: SourcePlan): RawProspect[] {
    const packs = new Set<BuyerPackId>(plan.buyerPacks);
    return MOCK_DATA.filter((p) => packs.has(p.buyerPack));
  },
};

/** Convenience wrapper mirroring the planner-driven call site. */
export function getMockProspects(plan: SourcePlan): RawProspect[] {
  return mockProspectProvider.fetch(plan) as RawProspect[];
}
