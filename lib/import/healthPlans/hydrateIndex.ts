import { isDatabaseConfigured } from "@/lib/db";
import { getHealthPlanIndexSize } from "./memoryIndex";

type HydrationState = "idle" | "loading" | "ready" | "failed";

let hydrationState: HydrationState = "idle";
let hydrationPromise: Promise<void> | null = null;

/** True when the in-memory health plan index is populated or hydration finished. */
export function isHealthPlanIndexHydrated(): boolean {
  return hydrationState === "ready" || getHealthPlanIndexSize() > 0;
}

/** Mark index as loaded after seed import or Neon refresh. */
export function markHealthPlanIndexLoaded(): void {
  if (getHealthPlanIndexSize() > 0) {
    hydrationState = "ready";
  }
}

/** Reset hydration cache (tests / explicit index clear). */
export function resetHealthPlanHydrationCache(): void {
  hydrationState = "idle";
  hydrationPromise = null;
}

/**
 * Load health plan organizations from Neon into the in-memory index once per process.
 * Never throws — callers continue with an empty index on failure.
 */
export async function ensureHealthPlanIndexHydrated(): Promise<void> {
  if (isHealthPlanIndexHydrated()) {
    hydrationState = "ready";
    return;
  }
  if (!isDatabaseConfigured()) return;
  if (hydrationState === "failed") return;

  if (!hydrationPromise) {
    hydrationState = "loading";
    hydrationPromise = (async () => {
      try {
        const { refreshHealthPlanIndexFromDb } = await import("./import");
        const count = await refreshHealthPlanIndexFromDb();
        hydrationState =
          count > 0 || getHealthPlanIndexSize() > 0 ? "ready" : "idle";
        if (hydrationState === "idle") {
          hydrationPromise = null;
        }
      } catch (error) {
        console.warn("[health-plans] Neon index hydration failed:", error);
        hydrationState = "failed";
        hydrationPromise = null;
      }
    })();
  }

  await hydrationPromise;
}

/** Non-blocking hydration kickoff for server startup or import scripts. */
export function kickoffHealthPlanIndexHydration(): void {
  if (isHealthPlanIndexHydrated() || !isDatabaseConfigured()) return;
  void ensureHealthPlanIndexHydrated();
}
