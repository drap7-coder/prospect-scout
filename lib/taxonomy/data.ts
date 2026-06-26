import type {
  TaxonomyIndustry,
  TaxonomyOrganizationType,
  TaxonomySector,
} from "./types";

export const TAXONOMY_SECTORS: TaxonomySector[] = [
  { id: "healthcare", label: "Healthcare", keywords: ["health", "healthcare", "medical", "clinical", "hospital", "payer", "medicare", "medicaid"] },
  { id: "manufacturing", label: "Manufacturing", keywords: ["manufactur", "factory", "plant", "industrial", "production", "packaging", "cpg"] },
  { id: "financial-services", label: "Financial Services", keywords: ["bank", "financial", "insurance carrier", "credit union", "fintech", "asset manager"] },
  { id: "public-sector", label: "Public Sector", keywords: ["public sector", "government", "municipal", "state agency", "school district", "transit authority"] },
  { id: "retail-consumer", label: "Retail & Consumer", keywords: ["retail", "consumer", "grocery", "store chain", "ecommerce"] },
  { id: "technology", label: "Technology", keywords: ["technology", "software", "saas", "tech company", "platform"] },
  { id: "education", label: "Education", keywords: ["university", "college", "school", "campus", "higher ed", "k-12"] },
  { id: "real-estate-construction", label: "Real Estate & Construction", keywords: ["real estate", "construction", "developer", "property"] },
  { id: "energy-utilities", label: "Energy & Utilities", keywords: ["energy", "utility", "utilities", "power", "grid"] },
  { id: "transportation-logistics", label: "Transportation & Logistics", keywords: ["transport", "logistics", "shipping", "freight", "airline", "railroad"] },
  { id: "professional-services", label: "Professional Services", keywords: ["consulting firm", "law firm", "accounting firm", "staffing firm", "broker"] },
  { id: "hospitality-leisure", label: "Hospitality & Leisure", keywords: ["hospitality", "hotel", "restaurant", "leisure", "travel"] },
  { id: "nonprofit", label: "Nonprofit", keywords: ["nonprofit", "non-profit", "foundation", "charity", "ngo"] },
];

export const TAXONOMY_INDUSTRIES: TaxonomyIndustry[] = [
  // Healthcare
  { id: "payers", label: "Payers", sectorId: "healthcare", taxonomyTargets: ["health-plans"], keywords: ["health plan", "payer", "insurer", "mco", "medicare advantage"] },
  { id: "providers", label: "Providers", sectorId: "healthcare", taxonomyTargets: ["health-systems"], keywords: ["hospital", "health system", "provider", "idn", "medical center"] },
  { id: "life-sciences", label: "Life Sciences", sectorId: "healthcare", taxonomyTargets: ["manufacturers"], keywords: ["pharma", "biotech", "medical device", "life science", "drug maker"] },
  // Manufacturing
  { id: "food-beverage", label: "Food & Beverage", sectorId: "manufacturing", taxonomyTargets: ["manufacturers"], keywords: ["food", "beverage", "snack", "cpg food"] },
  { id: "industrial-products", label: "Industrial Products", sectorId: "manufacturing", taxonomyTargets: ["manufacturers"], keywords: ["industrial", "machinery", "components"] },
  { id: "packaging", label: "Packaging", sectorId: "manufacturing", taxonomyTargets: ["manufacturers"], keywords: ["packaging", "packager", "co-pack"] },
  { id: "consumer-goods", label: "Consumer Goods", sectorId: "manufacturing", taxonomyTargets: ["manufacturers"], keywords: ["consumer goods", "cpg", "household"] },
  { id: "chemicals", label: "Chemicals", sectorId: "manufacturing", taxonomyTargets: ["manufacturers"], keywords: ["chemical", "specialty chemical"] },
  { id: "pharma-manufacturing", label: "Pharma Manufacturing", sectorId: "manufacturing", taxonomyTargets: ["manufacturers"], keywords: ["pharma manufacturing", "pharmaceutical plant"] },
  // Financial Services
  { id: "banks", label: "Banks", sectorId: "financial-services", taxonomyTargets: ["employers"], keywords: ["bank", "banking", "national bank"] },
  { id: "credit-unions", label: "Credit Unions", sectorId: "financial-services", taxonomyTargets: ["employers"], keywords: ["credit union"] },
  { id: "insurance-carriers", label: "Insurance Carriers", sectorId: "financial-services", taxonomyTargets: ["employers"], keywords: ["insurance carrier", "insurer", "underwriter"] },
  { id: "asset-managers", label: "Asset Managers", sectorId: "financial-services", taxonomyTargets: ["employers"], keywords: ["asset manager", "investment manager", "fund manager"] },
  { id: "fintech", label: "Fintech", sectorId: "financial-services", taxonomyTargets: ["employers"], keywords: ["fintech", "payments", "neobank"] },
  // Public Sector
  { id: "state-agencies", label: "State Agencies", sectorId: "public-sector", taxonomyTargets: ["public-sector"], keywords: ["state agency", "state government", "department of"] },
  { id: "municipalities", label: "Municipalities", sectorId: "public-sector", taxonomyTargets: ["public-sector"], keywords: ["municipal", "municipality", "city of", "county"] },
  { id: "public-employers", label: "Public Employers", sectorId: "public-sector", taxonomyTargets: ["public-sector"], keywords: ["public employer", "government employer"] },
  { id: "transit-authorities", label: "Transit Authorities", sectorId: "public-sector", taxonomyTargets: ["public-sector"], keywords: ["transit authority", "metro", "public transit"] },
  // Education
  { id: "universities", label: "Universities", sectorId: "education", taxonomyTargets: ["employers"], keywords: ["university", "universities", "college", "campus", "higher ed"] },
  { id: "community-colleges", label: "Community Colleges", sectorId: "education", taxonomyTargets: ["employers"], keywords: ["community college"] },
  { id: "school-districts", label: "School Districts", sectorId: "education", taxonomyTargets: ["public-sector"], keywords: ["school district", "k-12", "public schools"] },
  { id: "private-schools", label: "Private Schools", sectorId: "education", taxonomyTargets: ["employers"], keywords: ["private school", "academy"] },
  // Professional Services
  { id: "consulting", label: "Consulting", sectorId: "professional-services", taxonomyTargets: ["employers"], keywords: ["consulting firm", "consultancy", "advisory"] },
  { id: "accounting", label: "Accounting", sectorId: "professional-services", taxonomyTargets: ["employers"], keywords: ["accounting firm", "cpa", "audit firm"] },
  { id: "legal", label: "Legal", sectorId: "professional-services", taxonomyTargets: ["employers"], keywords: ["law firm", "legal services"] },
  { id: "insurance-brokers", label: "Insurance Brokers", sectorId: "professional-services", taxonomyTargets: ["employers"], keywords: ["insurance broker", "benefits broker"] },
  { id: "staffing", label: "Staffing", sectorId: "professional-services", taxonomyTargets: ["employers"], keywords: ["staffing firm", "recruiting firm", "temp agency"] },
  // Other sectors (industry = sector label for simpler mapping)
  { id: "retail", label: "Retail", sectorId: "retail-consumer", taxonomyTargets: ["employers"], keywords: ["retail", "store", "grocery chain"] },
  { id: "technology", label: "Technology", sectorId: "technology", taxonomyTargets: ["employers"], keywords: ["software", "saas", "tech company"] },
  { id: "real-estate", label: "Real Estate", sectorId: "real-estate-construction", taxonomyTargets: ["employers"], keywords: ["real estate", "property developer"] },
  { id: "construction", label: "Construction", sectorId: "real-estate-construction", taxonomyTargets: ["employers"], keywords: ["construction", "general contractor"] },
  { id: "energy", label: "Energy", sectorId: "energy-utilities", taxonomyTargets: ["employers"], keywords: ["energy company", "oil", "gas", "renewable"] },
  { id: "utilities", label: "Utilities", sectorId: "energy-utilities", taxonomyTargets: ["employers"], keywords: ["utility", "electric utility", "water utility"] },
  { id: "transportation", label: "Transportation", sectorId: "transportation-logistics", taxonomyTargets: ["employers"], keywords: ["airline", "railroad", "trucking", "logistics"] },
  { id: "hospitality", label: "Hospitality", sectorId: "hospitality-leisure", taxonomyTargets: ["employers"], keywords: ["hotel", "hospitality", "restaurant group"] },
  { id: "nonprofit", label: "Nonprofit", sectorId: "nonprofit", taxonomyTargets: ["employers"], keywords: ["nonprofit", "foundation", "charity"] },
];

export const TAXONOMY_ORGANIZATION_TYPES: TaxonomyOrganizationType[] = [
  // Healthcare — Payers
  { id: "health-plan", label: "Health Plan", sectorId: "healthcare", industryId: "payers", taxonomyTarget: "health-plans", keywords: ["health plan", "payer", "insurer", "mco", "medicare advantage", "medicaid plan"] },
  { id: "pbm", label: "PBM", sectorId: "healthcare", industryId: "payers", taxonomyTarget: "health-plans", keywords: ["pbm", "pharmacy benefit"] },
  { id: "tpa", label: "TPA", sectorId: "healthcare", industryId: "payers", taxonomyTarget: "health-plans", keywords: ["tpa", "third party admin", "third-party admin"] },
  // Healthcare — Providers
  { id: "hospital", label: "Hospital", sectorId: "healthcare", industryId: "providers", taxonomyTarget: "health-systems", keywords: ["hospital", "medical center"] },
  { id: "health-system", label: "Health System", sectorId: "healthcare", industryId: "providers", taxonomyTarget: "health-systems", keywords: ["health system", "idn", "integrated delivery"] },
  { id: "physician-group", label: "Physician Group", sectorId: "healthcare", industryId: "providers", taxonomyTarget: "health-systems", keywords: ["physician group", "medical group", "clinic network"] },
  // Healthcare — Life Sciences
  { id: "pharma-manufacturer", label: "Pharma Manufacturer", sectorId: "healthcare", industryId: "life-sciences", taxonomyTarget: "manufacturers", keywords: ["pharma", "pharmaceutical", "drug maker", "biotech"] },
  { id: "medical-device", label: "Medical Device Company", sectorId: "healthcare", industryId: "life-sciences", taxonomyTarget: "manufacturers", keywords: ["medical device", "device maker", "medtech"] },
  // Manufacturing
  { id: "manufacturer", label: "Manufacturer", sectorId: "manufacturing", industryId: "industrial-products", taxonomyTarget: "manufacturers", keywords: ["manufacturer", "manufacturing", "plant", "factory"] },
  { id: "food-beverage-company", label: "Food & Beverage Company", sectorId: "manufacturing", industryId: "food-beverage", taxonomyTarget: "manufacturers", keywords: ["food manufacturer", "food company", "beverage company", "pepsi", "pepsico"] },
  { id: "packaging-company", label: "Packaging Company", sectorId: "manufacturing", industryId: "packaging", taxonomyTarget: "manufacturers", keywords: ["packaging company", "packager", "contract packaging"] },
  { id: "consumer-goods-company", label: "Consumer Goods Company", sectorId: "manufacturing", industryId: "consumer-goods", taxonomyTarget: "manufacturers", keywords: ["consumer goods", "cpg brand"] },
  { id: "chemical-company", label: "Chemical Company", sectorId: "manufacturing", industryId: "chemicals", taxonomyTarget: "manufacturers", keywords: ["chemical company", "specialty chemical"] },
  // Financial Services
  { id: "bank", label: "Bank", sectorId: "financial-services", industryId: "banks", taxonomyTarget: "employers", keywords: ["bank", "banking", "national bank", "regional bank"] },
  { id: "credit-union", label: "Credit Union", sectorId: "financial-services", industryId: "credit-unions", taxonomyTarget: "employers", keywords: ["credit union"] },
  { id: "insurance-carrier", label: "Insurance Carrier", sectorId: "financial-services", industryId: "insurance-carriers", taxonomyTarget: "employers", keywords: ["insurance carrier", "property casualty insurer"] },
  { id: "asset-manager", label: "Asset Manager", sectorId: "financial-services", industryId: "asset-managers", taxonomyTarget: "employers", keywords: ["asset manager", "investment manager"] },
  { id: "fintech-company", label: "Fintech Company", sectorId: "financial-services", industryId: "fintech", taxonomyTarget: "employers", keywords: ["fintech", "payments company"] },
  // Public Sector
  { id: "state-agency", label: "State Agency", sectorId: "public-sector", industryId: "state-agencies", taxonomyTarget: "public-sector", keywords: ["state agency", "state department"] },
  { id: "municipality", label: "Municipality", sectorId: "public-sector", industryId: "municipalities", taxonomyTarget: "public-sector", keywords: ["municipality", "municipal", "city of", "county government"] },
  { id: "public-employer", label: "Public Employer", sectorId: "public-sector", industryId: "public-employers", taxonomyTarget: "public-sector", keywords: ["public employer", "government employer"] },
  { id: "transit-authority", label: "Transit Authority", sectorId: "public-sector", industryId: "transit-authorities", taxonomyTarget: "public-sector", keywords: ["transit authority", "metro system"] },
  { id: "school-district", label: "School District", sectorId: "education", industryId: "school-districts", taxonomyTarget: "public-sector", keywords: ["school district", "public schools"] },
  // Education
  { id: "university", label: "University", sectorId: "education", industryId: "universities", taxonomyTarget: "employers", keywords: ["university", "universities", "college", "campus"] },
  { id: "community-college", label: "Community College", sectorId: "education", industryId: "community-colleges", taxonomyTarget: "employers", keywords: ["community college"] },
  { id: "private-school", label: "Private School", sectorId: "education", industryId: "private-schools", taxonomyTarget: "employers", keywords: ["private school", "academy"] },
  // Professional Services
  { id: "consulting-firm", label: "Consulting Firm", sectorId: "professional-services", industryId: "consulting", taxonomyTarget: "employers", keywords: ["consulting firm", "consultancy"] },
  { id: "accounting-firm", label: "Accounting Firm", sectorId: "professional-services", industryId: "accounting", taxonomyTarget: "employers", keywords: ["accounting firm", "cpa firm"] },
  { id: "law-firm", label: "Law Firm", sectorId: "professional-services", industryId: "legal", taxonomyTarget: "employers", keywords: ["law firm", "legal practice"] },
  { id: "insurance-broker", label: "Insurance Broker", sectorId: "professional-services", industryId: "insurance-brokers", taxonomyTarget: "employers", keywords: ["insurance broker", "benefits broker"] },
  { id: "staffing-firm", label: "Staffing Firm", sectorId: "professional-services", industryId: "staffing", taxonomyTarget: "employers", keywords: ["staffing firm", "recruiting firm"] },
  // General employer (fallback)
  { id: "employer", label: "Employer", sectorId: "technology", industryId: "technology", taxonomyTarget: "employers", keywords: ["employer", "company", "corporation", "self-insured", "benefits"] },
];

/** Display label for pipeline target — used instead of legacy buyer-pack names. */
export const TAXONOMY_TARGET_LABELS: Record<string, string> = {
  "health-plans": "Health Plan",
  "health-systems": "Health System",
  manufacturers: "Manufacturer",
  employers: "Organization",
  "public-sector": "Public Agency",
};

export const FRESHNESS_FILTERS = [
  { id: "any", label: "Any time" },
  { id: "30d", label: "Last 30 days", maxDays: 30 },
  { id: "90d", label: "Last 90 days", maxDays: 90 },
  { id: "12mo", label: "Last 12 months", maxDays: 365 },
] as const;

export const EXAMPLE_SEARCHES = [
  "Regional health plans in Pennsylvania",
  "Humana Medicare Advantage",
  "PepsiCo",
  "Food manufacturers in Ohio",
  "Hospitals with merger activity",
  "Municipalities in the Mid-Atlantic",
  "Universities with workforce growth",
  "Banks in the Northeast",
] as const;
