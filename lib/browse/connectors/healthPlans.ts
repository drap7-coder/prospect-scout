import type { BrowseConnectorRegistration, BrowseGroupSpec } from "../types";
import { prospectHasClassification } from "../prospectWarehouse";
import { HEALTH_PLANS_CLASSIFICATION_NAMESPACE } from "@/lib/import/healthPlans/warehouseMapping";
import { HEALTH_PLAN_LOB_FILTERS } from "@/lib/search/classificationFilters";
import type { Prospect } from "@/lib/search/types";

function lobGroup(
  id: string,
  label: string,
  order: number,
): BrowseGroupSpec {
  return {
    id: `hp-${id}`,
    title: label,
    description: label,
    order,
    match: (p) => prospectHasClassification(p, HEALTH_PLANS_CLASSIFICATION_NAMESPACE, id),
    viewAll: {
      label: `View all ${label}`,
      filterPatch: {
        classificationNamespace: HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
        classificationId: id,
      },
    },
  };
}

function nameMatches(prospect: Prospect, pattern: RegExp): boolean {
  return pattern.test(prospect.name);
}

const DERIVED_HEALTH_PLAN_GROUPS: BrowseGroupSpec[] = [
  {
    id: "hp-provider-sponsored",
    title: "Provider Sponsored",
    description: "Health plans affiliated with provider systems",
    order: 50,
    match: (p) =>
      /\b(provider[- ]sponsored|hospital|health system|physician|medical group)\b/i.test(
        `${p.name} ${p.description ?? ""}`,
      ),
    viewAll: {
      label: "View provider-sponsored plans",
      filterPatch: { query: "provider sponsored health plan" },
    },
  },
  {
    id: "hp-blues",
    title: "Blues Plans",
    description: "Blue Cross Blue Shield affiliates",
    order: 51,
    match: (p) =>
      nameMatches(p, /\bblue cross\b|\bblue shield\b|\bbcbs\b/i),
    viewAll: {
      label: "View Blues plans",
      filterPatch: { query: "blue cross blue shield health plan" },
    },
  },
  {
    id: "hp-national",
    title: "National Plans",
    description: "Multi-state or national footprint",
    order: 52,
    match: (p) =>
      p.geographyNational === true ||
      (p.stateCodes?.length ?? 0) >= 15,
    viewAll: {
      label: "View national plans",
      filterPatch: { location: "nationwide" },
    },
  },
  {
    id: "hp-regional",
    title: "Regional Plans",
    description: "Focused state or regional footprint",
    order: 53,
    match: (p) => {
      const n = p.stateCodes?.length ?? 0;
      return n >= 1 && n <= 5 && !p.geographyNational;
    },
    viewAll: {
      label: "View regional plans",
      filterPatch: {},
    },
  },
];

const LOB_GROUPS = HEALTH_PLAN_LOB_FILTERS.map((f, i) =>
  lobGroup(f.id, f.label, i),
);

export const HEALTH_PLANS_BROWSE_CONNECTOR: BrowseConnectorRegistration = {
  buyerPacks: ["health-plans"],
  lensLabels: { category: "Category" },
  categoryGroups: [...LOB_GROUPS, ...DERIVED_HEALTH_PLAN_GROUPS],
};
