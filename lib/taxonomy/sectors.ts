import type { TaxonomySector } from "./types";

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
