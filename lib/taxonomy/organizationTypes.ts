import type { TaxonomyOrganizationType } from "./types";

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
  { id: "automotive-manufacturer", label: "Automotive Manufacturer", sectorId: "manufacturing", industryId: "automotive", taxonomyTarget: "manufacturers", keywords: ["automotive manufacturer", "auto plant", "vehicle assembly", "tire manufacturer"] },
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
