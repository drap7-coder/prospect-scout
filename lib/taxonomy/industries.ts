import type { TaxonomyIndustry } from "./types";

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
  { id: "chemicals", label: "Chemicals", sectorId: "manufacturing", taxonomyTargets: ["manufacturers"], keywords: ["chemical", "specialty chemical", "paint", "coatings"] },
  { id: "pharma-manufacturing", label: "Pharma Manufacturing", sectorId: "manufacturing", taxonomyTargets: ["manufacturers"], keywords: ["pharma manufacturing", "pharmaceutical plant"] },
  { id: "automotive", label: "Automotive", sectorId: "manufacturing", taxonomyTargets: ["manufacturers"], keywords: ["automotive", "auto parts", "vehicle", "tire", "oem"] },
  { id: "medical-device-manufacturing", label: "Medical Device Manufacturing", sectorId: "manufacturing", taxonomyTargets: ["manufacturers"], keywords: ["medical device manufacturer", "medtech manufacturing", "device plant"] },
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
  // Other sectors
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
