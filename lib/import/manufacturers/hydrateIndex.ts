import { getManufacturerIndexSize, indexManufacturerOrganizations } from "./memoryIndex";
import { loadWarehouseOrganizationsFromDb } from "@/lib/import/warehouse/dbPersistence";

type HydrationState = "idle" | "loading" | "ready" | "failed";

let hydrationState: HydrationState = "idle";
let hydrationError: string | null = null;
let hydrationPromise: Promise<number> | null = null;

export function isManufacturerIndexHydrated(): boolean {
  return hydrationState === "ready" || getManufacturerIndexSize() > 0;
}

export function markManufacturerIndexLoaded(): void {
  if (getManufacturerIndexSize() > 0) {
    hydrationState = "ready";
    hydrationError = null;
  }
}

export function resetManufacturerHydrationCache(): void {
  hydrationState = "idle";
  hydrationError = null;
  hydrationPromise = null;
}

export function getManufacturerHydrationState(): HydrationState {
  return hydrationState;
}

export function getManufacturerHydrationError(): string | null {
  return hydrationError;
}

export function setManufacturerHydrationError(message: string | null): void {
  hydrationError = message;
  if (message) hydrationState = "failed";
}

/** Load manufacturers from Neon into the in-memory index. */
export async function ensureManufacturerIndexHydrated(): Promise<number> {
  if (isManufacturerIndexHydrated()) {
    hydrationState = "ready";
    return getManufacturerIndexSize();
  }
  if (hydrationState === "failed" && hydrationError) return 0;

  if (!hydrationPromise) {
    hydrationState = "loading";
    hydrationPromise = (async () => {
      try {
        const loaded = await loadWarehouseOrganizationsFromDb("manufacturers");
        if (loaded.length === 0) {
          hydrationState = "idle";
          hydrationPromise = null;
          return 0;
        }
        indexManufacturerOrganizations(loaded);
        markManufacturerIndexLoaded();
        return loaded.length;
      } catch (error) {
        hydrationError = error instanceof Error ? error.message : String(error);
        hydrationState = "failed";
        hydrationPromise = null;
        console.error("[manufacturers] Neon hydration failed:", error);
        return 0;
      }
    })();
  }

  return hydrationPromise;
}

export function kickoffManufacturerIndexHydration(): void {
  if (isManufacturerIndexHydrated()) return;
  void ensureManufacturerIndexHydrated();
}
