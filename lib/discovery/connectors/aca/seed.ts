import type { Organization } from "../../organization";

/**
 * Curated ACA Marketplace issuer seed.
 *
 * This is a small, transparent, hand-maintained list of well-known Marketplace
 * (QHP) issuers — NOT a complete picture of the ACA Marketplace. The full set of
 * issuers, plans, metal levels, counties, and quality ratings will come later
 * from the CMS Marketplace API / QHP Public Use Files in a separate pull request.
 *
 * Each issuer is modeled as one organization with the states where it is known
 * to offer on-exchange coverage.
 */
export interface AcaMarketplaceIssuerSeed {
  /** HIOS-style issuer id (representative; seed-level, not authoritative). */
  issuerId: string;
  name: string;
  /** States with known on-exchange (Marketplace) participation. */
  states: string[];
  ownership: Organization["ownership"];
  website?: string;
  aliases?: string[];
  /** Marketplace the issuer participates in. */
  marketplace: "HealthCare.gov" | "State-Based";
}

export const ACA_MARKETPLACE_ISSUERS: AcaMarketplaceIssuerSeed[] = [
  {
    issuerId: "33653",
    name: "Community Health Options",
    states: ["ME", "NH"],
    ownership: "nonprofit",
    website: "https://www.healthoptions.org",
    aliases: ["Maine Community Health Options", "CHO"],
    marketplace: "State-Based",
  },
  {
    issuerId: "96667",
    name: "Harvard Pilgrim Health Care",
    states: ["ME", "NH", "MA", "CT"],
    ownership: "nonprofit",
    website: "https://www.harvardpilgrim.org",
    aliases: ["Harvard Pilgrim", "Point32Health"],
    marketplace: "State-Based",
  },
  {
    issuerId: "38344",
    name: "Taro Health",
    states: ["ME"],
    ownership: "private",
    website: "https://www.tarohealth.com",
    aliases: ["Taro"],
    marketplace: "State-Based",
  },
  {
    issuerId: "11534",
    name: "Oscar Health",
    states: ["FL", "TX", "GA", "AZ", "TN", "OH", "NC", "VA"],
    ownership: "public",
    website: "https://www.hioscar.com",
    aliases: ["Oscar Insurance"],
    marketplace: "HealthCare.gov",
  },
  {
    issuerId: "68398",
    name: "Ambetter (Centene)",
    states: ["FL", "TX", "GA", "OH", "IN", "MO", "NC", "SC", "AZ", "MS"],
    ownership: "public",
    website: "https://www.ambetterhealth.com",
    aliases: ["Ambetter", "Centene", "Centene Corporation"],
    marketplace: "HealthCare.gov",
  },
  {
    issuerId: "16842",
    name: "Molina Healthcare",
    states: ["CA", "TX", "FL", "OH", "MI", "WA", "NM", "WI", "UT"],
    ownership: "public",
    website: "https://www.molinahealthcare.com",
    aliases: ["Molina"],
    marketplace: "HealthCare.gov",
  },
  {
    issuerId: "45636",
    name: "CareSource",
    states: ["OH", "IN", "GA", "WV", "KY"],
    ownership: "nonprofit",
    website: "https://www.caresource.com",
    aliases: ["Care Source"],
    marketplace: "HealthCare.gov",
  },
  {
    issuerId: "33709",
    name: "Florida Blue (Blue Cross Blue Shield of Florida)",
    states: ["FL"],
    ownership: "nonprofit",
    website: "https://www.floridablue.com",
    aliases: ["Florida Blue", "BCBS Florida", "Blue Cross Blue Shield of Florida"],
    marketplace: "HealthCare.gov",
  },
  {
    issuerId: "70285",
    name: "Anthem Blue Cross Blue Shield",
    states: ["OH", "IN", "GA", "KY", "VA", "CO", "NV", "ME"],
    ownership: "public",
    website: "https://www.anthem.com",
    aliases: ["Anthem", "BCBS", "Blue Cross Blue Shield"],
    marketplace: "HealthCare.gov",
  },
  {
    issuerId: "40513",
    name: "Kaiser Permanente",
    states: ["CA", "CO", "GA", "OR", "WA", "VA", "MD"],
    ownership: "nonprofit",
    website: "https://healthy.kaiserpermanente.org",
    aliases: ["Kaiser", "Kaiser Foundation Health Plan"],
    marketplace: "HealthCare.gov",
  },
];
