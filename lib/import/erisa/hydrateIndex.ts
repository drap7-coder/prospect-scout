import { isDatabaseConfigured } from "@/lib/db";
import { getErisaIndexSize } from "./memoryIndex";

type HydrationState = "idle" | "loading" | "ready" | "failed";

let hydrationState: HydrationState = "idle";
let hydrationPromise: Promise<void> | null = null;

/** True when the in-memory ERISA index is populated or hydration finished. */
export function isErisaIndexHydrated(): boolean {
  return hydrationState === "ready" || getErisaIndexSize() > 0;
}

/** Mark index as loaded after CSV import or Neon refresh. */
export function markErisaIndexLoaded(): void {
  if (getErisaIndexSize() > 0) {
    hydrationState = "ready";
  }
}

/** Reset hydration cache (tests / explicit index clear). */
export function resetErisaHydrationCache(): void {
  hydrationState = "idle";
  hydrationPromise = null;
}

/**
 * Load ERISA filings from Neon into the in-memory search index once per process.
 * Never throws — search continues with an empty index on failure.
 */
export async function ensureErisaIndexHydrated(): Promise<void> {
  if (isErisaIndexHydrated()) {
    hydrationState = "ready";
    return;
  }
  if (!isDatabaseConfigured()) return;
  if (hydrationState === "failed") return;

  if (!hydrationPromise) {
    hydrationState = "loading";
    hydrationPromise = (async () => {
      try {
        const { refreshErisaIndexFromDb } = await import("./import");
        const count = await refreshErisaIndexFromDb();
        hydrationState =
          count > 0 || getErisaIndexSize() > 0 ? "ready" : "idle";
        if (hydrationState === "idle") {
          hydrationPromise = null;
        }
      } catch (error) {
        console.warn("[erisa] Neon index hydration failed:", error);
        hydrationState = "failed";
        hydrationPromise = null;
      }
    })();
  }

  await hydrationPromise;
}

/** Non-blocking hydration kickoff for sync discovery paths and server startup. */
export function kickoffErisaIndexHydration(): void {
  if (isErisaIndexHydrated() || !isDatabaseConfigured()) return;
  void ensureErisaIndexHydrated();
}
