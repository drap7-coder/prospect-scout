import { getManufacturerIndexSize } from "./memoryIndex";

type HydrationState = "idle" | "ready";

let hydrationState: HydrationState = "idle";

export function isManufacturerIndexHydrated(): boolean {
  return hydrationState === "ready" || getManufacturerIndexSize() > 0;
}

export function markManufacturerIndexLoaded(): void {
  if (getManufacturerIndexSize() > 0) {
    hydrationState = "ready";
  }
}

export function resetManufacturerHydrationCache(): void {
  hydrationState = "idle";
}

export function kickoffManufacturerIndexHydration(): void {
  if (isManufacturerIndexHydrated()) return;
}
