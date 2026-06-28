import type { BuyerPackId } from "@/lib/search/types";
import type { Prospect } from "@/lib/search/types";
import type {
  BrowseConnectorRegistration,
  BrowseContext,
  BrowseGroupSpec,
  BrowseLensDefinition,
  BrowseLensId,
} from "../types";
import { classificationKey, prospectClassifications } from "../prospectWarehouse";
import { classificationFilterLabel } from "@/lib/search/classificationFilters";
import { HEALTH_PLANS_BROWSE_CONNECTOR } from "./healthPlans";
import { MANUFACTURERS_BROWSE_CONNECTOR } from "./manufacturers";

const CONNECTORS: BrowseConnectorRegistration[] = [
  HEALTH_PLANS_BROWSE_CONNECTOR,
  MANUFACTURERS_BROWSE_CONNECTOR,
];

export const BROWSE_LENSES: BrowseLensDefinition[] = [
  {
    id: "category",
    label: "Category",
    description: "Business lines and market classifications",
  },
  {
    id: "geography",
    label: "Geography",
    description: "National, regional, and state footprint",
  },
  {
    id: "opportunity",
    label: "Opportunity",
    description: "Intelligence-driven groupings",
  },
  {
    id: "alphabet",
    label: "Alphabet",
    description: "A–Z directory browse",
  },
];

const LIST_TABLE_LENSES = ["list", "table"] as const;

export function resolvePrimaryBuyerPack(prospects: Prospect[]): BuyerPackId | null {
  if (prospects.length === 0) return null;
  const counts = new Map<BuyerPackId, number>();
  for (const p of prospects) {
    counts.set(p.buyerPack, (counts.get(p.buyerPack) ?? 0) + 1);
  }
  let best: BuyerPackId | null = null;
  let max = 0;
  for (const [pack, n] of counts) {
    if (n > max) {
      max = n;
      best = pack;
    }
  }
  return best;
}

export function buildBrowseContext(
  prospects: Prospect[],
  searchState: import("@/lib/search/searchState").SearchState,
): BrowseContext {
  return {
    searchState,
    primaryBuyerPack: resolvePrimaryBuyerPack(prospects),
    sectorId: searchState.sector,
    industryId: searchState.industry,
    organizationTypeId: searchState.organizationType,
  };
}

function connectorForPack(pack: BuyerPackId | null): BrowseConnectorRegistration | null {
  if (!pack) return null;
  return CONNECTORS.find((c) => c.buyerPacks.includes(pack)) ?? null;
}

/** Discover classification groups present on prospects but not in connector registry. */
function discoverClassificationGroups(prospects: Prospect[]): BrowseGroupSpec[] {
  const seen = new Set<string>();
  const specs: BrowseGroupSpec[] = [];
  let order = 900;

  for (const prospect of prospects) {
    for (const c of prospectClassifications(prospect)) {
      const key = classificationKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      const label =
        c.label ?? classificationFilterLabel(c.namespace, c.id) ?? c.id;
      specs.push({
        id: `cls-${key.replace(/:/g, "-")}`,
        title: label,
        description: label,
        order: order++,
        match: (p) =>
          prospectClassifications(p).some(
            (x) => x.namespace === c.namespace && x.id === c.id,
          ),
        viewAll: {
          label: `View all ${label}`,
          filterPatch: {
            classificationNamespace: c.namespace,
            classificationId: c.id,
          },
        },
      });
    }
  }
  return specs;
}

export function categoryGroupSpecs(
  ctx: BrowseContext,
  prospects: Prospect[],
): BrowseGroupSpec[] {
  const connector = connectorForPack(ctx.primaryBuyerPack);
  const registered = connector?.categoryGroups ?? [];
  const registeredKeys = new Set(
    registered.flatMap((g) => {
      const va = g.viewAll?.filterPatch;
      if (va?.classificationNamespace && va.classificationId) {
        return [`${va.classificationNamespace}:${va.classificationId}`];
      }
      return [];
    }),
  );

  const discovered = discoverClassificationGroups(prospects).filter((d) => {
    const va = d.viewAll?.filterPatch;
    if (!va?.classificationNamespace || !va.classificationId) return true;
    return !registeredKeys.has(
      `${va.classificationNamespace}:${va.classificationId}`,
    );
  });

  return [...registered, ...discovered].sort((a, b) => a.order - b.order);
}

export function resolveBrowseLenses(
  ctx: BrowseContext,
  _prospects: Prospect[],
): BrowseLensDefinition[] {
  const connector = connectorForPack(ctx.primaryBuyerPack);
  const lenses = BROWSE_LENSES.map((lens) => {
    const override = connector?.lensLabels?.[lens.id];
    return override ? { ...lens, label: override } : lens;
  });

  // Hide category lens when no groups would apply and no connector
  if (!connector && ctx.primaryBuyerPack !== "health-plans") {
    return lenses.filter((l) => l.id !== "category" || ctx.sectorId === "healthcare");
  }
  return lenses;
}

export function lensLabel(lensId: BrowseLensId, ctx: BrowseContext): string {
  const connector = connectorForPack(ctx.primaryBuyerPack);
  return connector?.lensLabels?.[lensId] ?? BROWSE_LENSES.find((l) => l.id === lensId)?.label ?? lensId;
}

export { LIST_TABLE_LENSES };
