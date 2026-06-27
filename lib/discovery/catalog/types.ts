import type { BuyerPackId } from "@/lib/search/types";
import type { Organization } from "../organization";
import type { HealthPlanType } from "../healthPlanType";

/** Source metadata preserved on every catalog record. */
export interface CatalogSourceMetadata {
  sourceName: string;
  sourceUrl: string;
  lastUpdated: string;
  confidence: number;
}

/** Raw catalog record before normalization into Organization. */
export interface CatalogRecord {
  sourceId: string;
  name: string;
  state?: string;
  /** When an org operates in multiple states. */
  states?: string[];
  city?: string;
  website?: string;
  sectorId: string;
  industries: string[];
  organizationType: string;
  ownership?: Organization["ownership"];
  buyerPack?: BuyerPackId;
  aliases?: string[];
  headquarters?: string;
  regions?: string[];
  /** Optional health-plan subtype (only set by sources that know it). */
  healthPlanType?: HealthPlanType;
  metadata: CatalogSourceMetadata;
}

/** Manifest entry written by the ingest script for diagnostics freshness. */
export interface CatalogDatasetManifest {
  connectorId: string;
  label: string;
  sourceName: string;
  sourceUrl: string;
  lastUpdated: string;
  recordCount: number;
  confidence: number;
}

export interface CatalogManifest {
  generatedAt: string;
  datasets: CatalogDatasetManifest[];
}
