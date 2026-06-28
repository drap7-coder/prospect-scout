import type { BrowseConnectorRegistration, BrowseGroupSpec } from "../types";
import { prospectHasClassification } from "../prospectWarehouse";
import { MANUFACTURERS_CLASSIFICATION_NAMESPACE } from "@/lib/import/manufacturers/warehouseMapping";

const MANUFACTURER_CATEGORY_LABELS: Record<string, string> = {
  pharma: "Pharmaceuticals",
  device: "Medical Devices",
  biotech: "Biotechnology",
  food_beverage: "Food & Beverage",
  generic: "Contract Manufacturing",
};

function mfgGroup(id: string, order: number): BrowseGroupSpec {
  const label = MANUFACTURER_CATEGORY_LABELS[id] ?? id.replace(/_/g, " ");
  return {
    id: `mfg-${id}`,
    title: label,
    description: label,
    order,
    match: (p) =>
      prospectHasClassification(p, MANUFACTURERS_CLASSIFICATION_NAMESPACE, id),
    viewAll: {
      label: `View all ${label}`,
      filterPatch: {
        classificationNamespace: MANUFACTURERS_CLASSIFICATION_NAMESPACE,
        classificationId: id,
      },
    },
  };
}

export const MANUFACTURERS_BROWSE_CONNECTOR: BrowseConnectorRegistration = {
  buyerPacks: ["manufacturers"],
  lensLabels: {
    category: "Industry",
  },
  categoryGroups: Object.keys(MANUFACTURER_CATEGORY_LABELS).map((id, i) =>
    mfgGroup(id, i),
  ),
};
