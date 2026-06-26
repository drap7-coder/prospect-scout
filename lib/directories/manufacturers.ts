import type { OrganizationRecord } from "./types";

/** Curated manufacturers — initial seed entries. */
export const MANUFACTURERS_DIRECTORY: OrganizationRecord[] = [
  {
    id: "dir-mfg-pfizer",
    name: "Pfizer",
    aliases: ["pfizer inc", "pfizer pharmaceuticals"],
    organizationType: "manufacturer",
    industry: "manufacturers",
    website: "https://www.pfizer.com",
    headquarters: "New York, NY",
    statesServed: ["NY", "PA", "CA", "MA", "MI"],
    regions: ["northeast", "national"],
    employeeEstimate: 88_000,
    publicCompany: true,
    ticker: "PFE",
    tags: ["pharma", "large-cap"],
    buyerPack: "manufacturers",
  },
  {
    id: "dir-mfg-jnj",
    name: "Johnson & Johnson",
    aliases: ["jnj", "johnson and johnson", "j&j"],
    organizationType: "manufacturer",
    industry: "manufacturers",
    website: "https://www.jnj.com",
    headquarters: "New Brunswick, NJ",
    statesServed: ["NJ", "PA", "CA", "MA"],
    regions: ["northeast", "national"],
    employeeEstimate: 130_000,
    publicCompany: true,
    ticker: "JNJ",
    tags: ["pharma", "medtech", "large-cap"],
    buyerPack: "manufacturers",
  },
  {
    id: "dir-mfg-abbvie",
    name: "AbbVie",
    aliases: ["abbvie inc"],
    organizationType: "manufacturer",
    industry: "manufacturers",
    website: "https://www.abbvie.com",
    headquarters: "North Chicago, IL",
    statesServed: ["IL", "CA", "MA"],
    regions: ["midwest", "national"],
    employeeEstimate: 50_000,
    publicCompany: true,
    ticker: "ABBV",
    tags: ["pharma", "large-cap"],
    buyerPack: "manufacturers",
  },
];

export function getManufacturerById(id: string): OrganizationRecord | undefined {
  return MANUFACTURERS_DIRECTORY.find((r) => r.id === id);
}
