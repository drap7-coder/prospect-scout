/**
 * Reusable warehouse classification filters for search UI and intent parsing.
 * Connectors register namespace/id pairs; the warehouse core matches without interpreting semantics.
 */

import { HEALTH_PLANS_CLASSIFICATION_NAMESPACE } from "@/lib/import/healthPlans/warehouseMapping";

export interface ClassificationFilterOption {
  namespace: string;
  id: string;
  label: string;
  /** When set, filter is only shown for matching buyer packs / org types. */
  sectorHint?: "healthcare";
}

/** Health-plan line-of-business filters backed by CMS warehouse classifications. */
export const HEALTH_PLAN_LOB_FILTERS: ClassificationFilterOption[] = [
  {
    namespace: HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
    id: "medicare_advantage",
    label: "Medicare Advantage",
    sectorHint: "healthcare",
  },
  {
    namespace: HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
    id: "part_d",
    label: "Medicare Part D",
    sectorHint: "healthcare",
  },
  {
    namespace: HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
    id: "medicaid_managed_care",
    label: "Medicaid Managed Care",
    sectorHint: "healthcare",
  },
  {
    namespace: HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
    id: "aca_marketplace",
    label: "ACA Marketplace / QHP",
    sectorHint: "healthcare",
  },
  {
    namespace: HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
    id: "chip",
    label: "CHIP",
    sectorHint: "healthcare",
  },
  {
    namespace: HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
    id: "commercial",
    label: "Commercial",
    sectorHint: "healthcare",
  },
];

export function classificationFilterLabel(
  namespace: string | null | undefined,
  id: string | null | undefined,
): string | null {
  if (!namespace || !id) return null;
  const match = HEALTH_PLAN_LOB_FILTERS.find(
    (f) => f.namespace === namespace && f.id === id,
  );
  return match?.label ?? id.replace(/_/g, " ");
}

export function classificationFilterKey(namespace: string, id: string): string {
  return `${namespace}:${id}`;
}

export function parseClassificationFilterKey(
  key: string | null | undefined,
): { namespace: string; id: string } | null {
  if (!key) return null;
  const sep = key.indexOf(":");
  if (sep <= 0) return null;
  return { namespace: key.slice(0, sep), id: key.slice(sep + 1) };
}
