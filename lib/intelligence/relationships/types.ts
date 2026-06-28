import type { IntelligenceProvenance } from "../framework/types";

/** Typed relationship edge between organizations or org ↔ vendor. */
export type OrganizationRelationshipType =
  | "uses"
  | "owns"
  | "partners_with"
  | "supplies"
  | "administers"
  | "audits"
  | "consults";

export interface OrganizationRelationshipEdge {
  id: string;
  fromOrganizationId: string;
  /** Target org id when resolved in catalog; optional for vendor-only edges. */
  toOrganizationId?: string;
  toOrganizationName: string;
  relationship: OrganizationRelationshipType;
  /** Vendor role label, e.g. PBM, TPA, health insurer. */
  role?: string;
  provenance: IntelligenceProvenance;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface OrganizationRelationshipGraph {
  organizationId: string;
  edges: OrganizationRelationshipEdge[];
}
