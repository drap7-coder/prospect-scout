/**
 * Generic organization warehouse model — sector-agnostic primitives shared by all connectors.
 * Connectors map source-specific fields into these structures; the warehouse never interprets
 * sector-specific classification ids.
 */

/** Canonical geography for search, coverage, and faceting. */
export interface OrganizationGeography {
  /** US state / territory codes where the org operates. */
  states: string[];
  /** Region bucket ids (midwest, northeast, …). */
  regions: string[];
  /** Headquarters locality as free text. */
  headquarters: string | null;
  /**
   * When true the org operates at national scope for the indexed record.
   * State-scoped queries exclude national-only records unless they also list the state.
   */
  national: boolean;
}

/** Sector-scoped classification stored by the warehouse without semantic interpretation. */
export interface OrganizationClassification {
  /** Connector namespace, e.g. "health-plans", "manufacturers", "hospitals". */
  namespace: string;
  /** Stable id within the namespace, e.g. "medicare_advantage", "pharma". */
  id: string;
  label?: string;
  /** Source provenance for this classification assertion. */
  provenance?: {
    sourceConnector: string;
    sourceId?: string;
    sourceName?: string;
    sourceUrl?: string;
    refreshedAt?: string;
    confidence?: number;
  };
}

/** Verified external identifier attached to an organization record. */
export interface OrganizationExternalId {
  idType: string;
  idValue: string;
  source?: string;
}

/** Opaque connector-specific attributes — warehouse stores, connectors interpret. */
export type SectorAttributes = Record<
  string,
  string | number | boolean | string[] | null | undefined
>;

export const EMPTY_GEOGRAPHY: OrganizationGeography = {
  states: [],
  regions: [],
  headquarters: null,
  national: false,
};

export function classificationKey(c: OrganizationClassification): string {
  return `${c.namespace}:${c.id}`;
}

export function geographyFromLegacyFields(org: {
  states?: string[];
  regions?: string[];
  headquarters?: string | null;
  geography?: OrganizationGeography;
}): OrganizationGeography {
  if (org.geography) return org.geography;
  return {
    states: org.states ?? [],
    regions: org.regions ?? [],
    headquarters: org.headquarters ?? null,
    national: false,
  };
}
