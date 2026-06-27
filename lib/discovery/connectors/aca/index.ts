import type { CatalogRecord } from "../../catalog/types";
import { ACA_MARKETPLACE_ISSUERS } from "./seed";
import { acaIssuerToCatalogRecord } from "./normalize";

export type { AcaMarketplaceIssuerSeed } from "./seed";
export { ACA_MARKETPLACE_ISSUERS } from "./seed";
export {
  ACA_CONNECTOR_ID,
  ACA_SOURCE_NAME,
  ACA_SOURCE_URL,
  ACA_SOURCE_BADGE,
  normalizeIssuerId,
  acaIssuerToCatalogRecord,
} from "./normalize";

/** Catalog records for all curated ACA Marketplace issuers. */
export function acaMarketplaceCatalogRecords(): CatalogRecord[] {
  return ACA_MARKETPLACE_ISSUERS.map(acaIssuerToCatalogRecord);
}

export interface AcaMarketplaceConnectorStatus {
  /** Always "Seeded only" until the live API / PUF ingestion lands. */
  status: "Seeded only";
  /** Curated subset — not a complete view of the Marketplace. */
  completeness: "partial";
  /** Live Marketplace API is not wired up in this pass. */
  api: "not enabled";
  issuerCount: number;
  stateCount: number;
}

/** Transparent status for the diagnostics page. */
export function getAcaMarketplaceConnectorStatus(): AcaMarketplaceConnectorStatus {
  const states = new Set<string>();
  for (const issuer of ACA_MARKETPLACE_ISSUERS) {
    for (const s of issuer.states) states.add(s);
  }
  return {
    status: "Seeded only",
    completeness: "partial",
    api: "not enabled",
    issuerCount: ACA_MARKETPLACE_ISSUERS.length,
    stateCount: states.size,
  };
}
