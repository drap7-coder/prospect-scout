import type { SearchIntent } from "@/lib/discovery/intent";
import type { OrganizationClassification } from "@/lib/organization/model";

export interface ClassificationFilter {
  namespace: string;
  ids: string[];
}

export type ClassificationInferrer = (
  query: string,
  intent: Pick<
    SearchIntent,
    "sectorId" | "industryId" | "organizationTypeId" | "query"
  >,
) => ClassificationFilter | null;

const inferrers: ClassificationInferrer[] = [];

/** Register a connector-specific classification inferrer (Layer 2 → Layer 1 bridge). */
export function registerClassificationInferrer(fn: ClassificationInferrer): void {
  inferrers.push(fn);
}

export function inferClassificationFilter(
  query: string,
  intent: Pick<
    SearchIntent,
    "sectorId" | "industryId" | "organizationTypeId" | "query"
  >,
): ClassificationFilter | null {
  for (const infer of inferrers) {
    const match = infer(query, intent);
    if (match) return match;
  }
  return null;
}

export function classificationFromOrganization(
  org: { classifications?: OrganizationClassification[] },
  namespace: string,
): string[] {
  return (org.classifications ?? [])
    .filter((c) => c.namespace === namespace)
    .map((c) => c.id);
}
