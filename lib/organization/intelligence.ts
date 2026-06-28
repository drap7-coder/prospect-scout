/**
 * Generic organization intelligence layer — sector-agnostic warehouse metadata.
 *
 * Connectors map source-specific fields into these structures. The warehouse core
 * stores and indexes them without interpreting sector semantics beyond namespace/id.
 */

import type { OrganizationClassification, OrganizationGeography } from "./model";

/** Provenance for a classification, metric, or relationship assertion. */
export interface IntelligenceProvenance {
  sourceConnector: string;
  sourceId?: string;
  sourceName?: string;
  sourceUrl?: string;
  refreshedAt?: string;
  confidence?: number;
}

/** Classification with source provenance (stored in warehouse JSONB). */
export interface ClassificationRecord extends OrganizationClassification {
  provenance?: IntelligenceProvenance;
}

/** Quantitative org metric (enrollment, covered lives, revenue band, etc.). */
export interface OrganizationMetric {
  /** Metric id within namespace, e.g. "covered_lives", "enrollment". */
  id: string;
  /** Sector namespace, e.g. "health-plans", "manufacturers". */
  namespace: string;
  value: number;
  unit?: string;
  asOfDate?: string;
  label?: string;
  provenance?: IntelligenceProvenance;
}

/**
 * Relationship / program participation (ACO, parent plan, vendor contract, …).
 * ACO is modeled here — not as a health-plan LOB classification.
 */
export interface OrganizationRelationship {
  /** Relationship type, e.g. "program_participation", "ownership", "vendor_contract". */
  type: string;
  /** Program or entity namespace, e.g. "healthcare.aco", "health-plans.parent". */
  programNamespace: string;
  /** Stable program or target org id when known. */
  targetOrgId?: string;
  /** Display name when target id is unresolved. */
  targetDisplayName?: string;
  /** Role of this org in the relationship, e.g. "participant", "owner", "affiliate". */
  role: string;
  provenance?: IntelligenceProvenance;
}

/** Product / offering line (optional grouping under business lines). */
export interface OrganizationOffering {
  id: string;
  namespace: string;
  label: string;
  classifications?: OrganizationClassification[];
  provenance?: IntelligenceProvenance;
}

export function classificationRecord(
  namespace: string,
  id: string,
  label?: string,
  provenance?: IntelligenceProvenance,
): ClassificationRecord {
  return { namespace, id, label, provenance };
}

export function mergeClassificationRecords(
  ...groups: (ClassificationRecord[] | undefined)[]
): ClassificationRecord[] {
  const seen = new Set<string>();
  const merged: ClassificationRecord[] = [];
  for (const group of groups) {
    for (const record of group ?? []) {
      const key = `${record.namespace}:${record.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(record);
    }
  }
  return merged;
}

export function mergeMetrics(
  ...groups: (OrganizationMetric[] | undefined)[]
): OrganizationMetric[] {
  const byKey = new Map<string, OrganizationMetric>();
  for (const group of groups) {
    for (const metric of group ?? []) {
      const key = `${metric.namespace}:${metric.id}:${metric.asOfDate ?? ""}`;
      const existing = byKey.get(key);
      if (!existing || (metric.provenance?.confidence ?? 0) >= (existing.provenance?.confidence ?? 0)) {
        byKey.set(key, metric);
      }
    }
  }
  return [...byKey.values()];
}

export function mergeRelationships(
  ...groups: (OrganizationRelationship[] | undefined)[]
): OrganizationRelationship[] {
  const seen = new Set<string>();
  const merged: OrganizationRelationship[] = [];
  for (const group of groups) {
    for (const rel of group ?? []) {
      const key = `${rel.type}:${rel.programNamespace}:${rel.targetOrgId ?? rel.targetDisplayName ?? ""}:${rel.role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(rel);
    }
  }
  return merged;
}

/** Strip provenance for legacy OrganizationClassification consumers. */
export function toOrganizationClassifications(
  records: ClassificationRecord[] | undefined,
): OrganizationClassification[] {
  return (records ?? []).map(({ namespace, id, label }) => ({ namespace, id, label }));
}

export type WarehouseIntelligencePayload = {
  geography?: OrganizationGeography | null;
  classifications?: ClassificationRecord[];
  sectorAttributes?: Record<string, unknown>;
  metrics?: OrganizationMetric[];
  relationships?: OrganizationRelationship[];
  offerings?: OrganizationOffering[];
};
