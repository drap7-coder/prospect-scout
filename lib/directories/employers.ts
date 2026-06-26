import type { OrganizationRecord } from "./types";

/** Curated employers — initial seed entries. */
export const EMPLOYERS_DIRECTORY: OrganizationRecord[] = [
  {
    id: "dir-emp-comcast",
    name: "Comcast",
    aliases: ["comcast corporation", "comcast nbcuniversal"],
    organizationType: "employer",
    industry: "employers",
    website: "https://www.comcast.com",
    headquarters: "Philadelphia, PA",
    statesServed: ["PA", "CA", "CO", "GA", "IL"],
    regions: ["mid-atlantic", "national"],
    employeeEstimate: 186_000,
    commercial: true,
    aso: false,
    publicCompany: true,
    ticker: "CMCSA",
    tags: ["self-insured", "pennsylvania"],
    buyerPack: "employers",
  },
  {
    id: "dir-emp-pnc",
    name: "PNC Financial Services",
    aliases: ["pnc bank", "pnc financial"],
    organizationType: "employer",
    industry: "employers",
    website: "https://www.pnc.com",
    headquarters: "Pittsburgh, PA",
    statesServed: ["PA", "OH", "NJ", "MD"],
    regions: ["mid-atlantic", "midwest"],
    employeeEstimate: 55_000,
    commercial: true,
    aso: false,
    publicCompany: true,
    ticker: "PNC",
    tags: ["financial-services", "pennsylvania"],
    buyerPack: "employers",
  },
];

export function getEmployerById(id: string): OrganizationRecord | undefined {
  return EMPLOYERS_DIRECTORY.find((r) => r.id === id);
}
