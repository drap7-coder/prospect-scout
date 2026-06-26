import type { OrganizationRecord } from "./types";

/** Curated health systems — initial seed entries; expand over time. */
export const HEALTH_SYSTEMS_DIRECTORY: OrganizationRecord[] = [
  {
    id: "dir-hs-upmc",
    name: "UPMC",
    aliases: ["upmc health system", "university of pittsburgh medical center"],
    organizationType: "health-system",
    industry: "health-systems",
    website: "https://www.upmc.com",
    headquarters: "Pittsburgh, PA",
    statesServed: ["PA", "NY", "MD"],
    regions: ["mid-atlantic", "northeast"],
    employeeEstimate: 95_000,
    commercial: false,
    medicare: false,
    medicaid: false,
    tags: ["integrated-delivery", "pennsylvania"],
    buyerPack: "health-systems",
  },
  {
    id: "dir-hs-geisinger",
    name: "Geisinger",
    aliases: ["geisinger health system", "geisinger health"],
    organizationType: "health-system",
    industry: "health-systems",
    website: "https://www.geisinger.org",
    headquarters: "Danville, PA",
    statesServed: ["PA", "NJ"],
    regions: ["mid-atlantic", "northeast"],
    employeeEstimate: 24_000,
    tags: ["integrated-delivery", "pennsylvania"],
    buyerPack: "health-systems",
  },
  {
    id: "dir-hs-penn-medicine",
    name: "Penn Medicine",
    aliases: ["university of pennsylvania health system", "penn health"],
    organizationType: "health-system",
    industry: "health-systems",
    website: "https://www.pennmedicine.org",
    headquarters: "Philadelphia, PA",
    statesServed: ["PA", "NJ"],
    regions: ["mid-atlantic", "northeast"],
    employeeEstimate: 44_000,
    tags: ["academic", "pennsylvania"],
    buyerPack: "health-systems",
  },
];

export function getHealthSystemById(id: string): OrganizationRecord | undefined {
  return HEALTH_SYSTEMS_DIRECTORY.find((r) => r.id === id);
}
