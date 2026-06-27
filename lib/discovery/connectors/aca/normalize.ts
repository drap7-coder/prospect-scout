import type { CatalogRecord, CatalogSourceMetadata } from "../../catalog/types";
import type { AcaMarketplaceIssuerSeed } from "./seed";

export const ACA_CONNECTOR_ID = "aca-marketplace";
export const ACA_SOURCE_NAME = "CMS Marketplace / QHP seed";
export const ACA_SOURCE_URL = "https://www.cms.gov/marketplace";
/** Label shown on the source badge for ACA Marketplace organizations. */
export const ACA_SOURCE_BADGE = "CMS Marketplace";

/** Normalize an issuer id to the 5-digit HIOS form. */
export function normalizeIssuerId(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length >= 5) return digits.slice(-5);
  return digits.padStart(5, "0");
}

function acaSourceMetadata(): CatalogSourceMetadata {
  return {
    sourceName: ACA_SOURCE_NAME,
    sourceUrl: ACA_SOURCE_URL,
    lastUpdated: "2024-01-01",
    confidence: 0.8,
  };
}

/** Map a curated ACA Marketplace issuer seed into a catalog record. */
export function acaIssuerToCatalogRecord(
  issuer: AcaMarketplaceIssuerSeed,
): CatalogRecord {
  const issuerId = normalizeIssuerId(issuer.issuerId);
  return {
    sourceId: issuerId,
    name: issuer.name,
    states: issuer.states,
    website: issuer.website,
    sectorId: "healthcare",
    industries: ["payers"],
    organizationType: "health-plan",
    ownership: issuer.ownership,
    buyerPack: "health-plans",
    aliases: [...(issuer.aliases ?? []), `HIOS ${issuerId}`],
    healthPlanType: "aca_marketplace",
    metadata: acaSourceMetadata(),
  };
}
