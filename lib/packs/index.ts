import type { BuyerPack, BuyerPackId, Signal } from "@/lib/search/types";
import { healthPlans } from "./healthPlans";
import { manufacturers } from "./manufacturers";
import { healthSystems } from "./healthSystems";
import { employers } from "./employers";
import { publicSector } from "./publicSector";

/**
 * Buyer pack registry.
 *
 * To add a new buyer ecosystem:
 *   1. Create `lib/packs/<yourPack>.ts` exporting a `BuyerPack`.
 *   2. Add its `BuyerPackId` to the union in `lib/search/types.ts`.
 *   3. Register it in the record below.
 *   4. (Optional) add mock orgs for it in `lib/providers/mockProspects.ts`.
 *
 * Nothing else in the search pipeline needs to change.
 */
export const buyerPacks: Record<BuyerPackId, BuyerPack> = {
  "health-plans": healthPlans,
  manufacturers,
  "health-systems": healthSystems,
  employers,
  "public-sector": publicSector,
};

/** Ordered list for rendering selectors. */
export const buyerPackList: BuyerPack[] = [
  healthPlans,
  manufacturers,
  healthSystems,
  employers,
  publicSector,
];

export function getBuyerPack(id: BuyerPackId): BuyerPack {
  return buyerPacks[id];
}

export function isBuyerPackId(value: string): value is BuyerPackId {
  return value in buyerPacks;
}

/** Look up a signal definition within a pack by its id. */
export function getSignal(
  packId: BuyerPackId,
  signalId: string,
): Signal | undefined {
  return buyerPacks[packId].signals.find((s) => s.id === signalId);
}
