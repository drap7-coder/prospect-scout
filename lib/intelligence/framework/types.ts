/** Canonical intelligence module identifiers. */
export type IntelligenceModuleId =
  | "benefits"
  | "cms"
  | "sec"
  | "fda"
  | "news"
  | "leadership"
  | "financials"
  | "locations"
  | "relationships"
  | "technology";

export interface IntelligenceProvenance {
  sourceId: string;
  sourceLabel: string;
  sourceUrl?: string;
  retrievedAt?: string;
  /** Confidence in this module's data (0–1). */
  confidence: number;
}

export interface IntelligenceMetric {
  id: string;
  /** Short display value, e.g. "248k" or "2024". */
  value: string;
  /** Human label, e.g. "ERISA plan participants" or "Latest filing". */
  label: string;
  provenance: IntelligenceProvenance;
}

/** Optional intelligence module attached to an organization profile. */
export interface OrganizationIntelligenceModule {
  id: IntelligenceModuleId;
  title: string;
  /** Display icon — emoji or icon key for the renderer. */
  icon: string;
  summaryMetrics: IntelligenceMetric[];
  confidence: number;
  provenance: IntelligenceProvenance[];
  /** Module-specific detail payload for the detail panel. */
  detail: unknown;
}

export interface OrganizationIntelligenceProfile {
  organizationId: string;
  modules: OrganizationIntelligenceModule[];
}
