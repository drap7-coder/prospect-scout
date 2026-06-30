import type { WarehouseConnectorId } from "./types";
import { isOrganizationWarehouseEnabled } from "./featureFlag";
import { healthPlansConnectorApi } from "./connectors/healthPlans";
import { manufacturersConnectorApi } from "./connectors/manufacturers";
import { PRODUCTION_WAREHOUSE_CONNECTOR_IDS } from "./organizations";
import {
  countWarehouseOrganizationsInDb,
  loadWarehouseOrganizationsFromDb,
} from "./dbPersistence";
import { isDatabaseConfigured } from "@/lib/db";
import { indexHealthPlanOrganizations } from "@/lib/import/healthPlans/memoryIndex";
import {
  markHealthPlanIndexLoaded,
  getHealthPlanHydrationState,
  setHealthPlanHydrationError,
  getHealthPlanHydrationError,
} from "@/lib/import/healthPlans/hydrateIndex";
import { indexManufacturerOrganizations } from "@/lib/import/manufacturers/memoryIndex";
import {
  markManufacturerIndexLoaded,
  getManufacturerHydrationState,
  setManufacturerHydrationError,
  getManufacturerHydrationError,
} from "@/lib/import/manufacturers/hydrateIndex";

export interface ConnectorHydrationResult {
  id: WarehouseConnectorId;
  buyerPack: string;
  status: "loaded" | "empty" | "loading" | "failed" | "skipped";
  organizationsLoaded: number;
  organizationsInDb: number;
  error: string | null;
}

export interface WarehouseHydrationResult {
  attemptedAt: string;
  databaseConfigured: boolean;
  connectors: ConnectorHydrationResult[];
  totalLoaded: number;
  error: string | null;
}

let lastHydrationResult: WarehouseHydrationResult | null = null;
let hydrationPromise: Promise<WarehouseHydrationResult> | null = null;

const CONNECTOR_BUYER_PACK: Record<WarehouseConnectorId, string> = {
  "health-plans": "health-plans",
  manufacturers: "manufacturers",
};

async function hydrateConnectorFromDb(
  id: WarehouseConnectorId,
): Promise<ConnectorHydrationResult> {
  const buyerPack = CONNECTOR_BUYER_PACK[id];
  const organizationsInDb = await countWarehouseOrganizationsInDb(buyerPack);

  if (!isDatabaseConfigured()) {
    return {
      id,
      buyerPack,
      status: "skipped",
      organizationsLoaded: 0,
      organizationsInDb: 0,
      error: "DATABASE_URL is not configured",
    };
  }

  if (organizationsInDb === 0) {
    const message = `No ${buyerPack} organizations found in Neon`;
    if (id === "health-plans") setHealthPlanHydrationError(message);
    if (id === "manufacturers") setManufacturerHydrationError(message);
    return {
      id,
      buyerPack,
      status: "empty",
      organizationsLoaded: 0,
      organizationsInDb: 0,
      error: message,
    };
  }

  try {
    const loaded = await loadWarehouseOrganizationsFromDb(buyerPack);
    if (id === "health-plans") {
      indexHealthPlanOrganizations(loaded);
      markHealthPlanIndexLoaded();
      setHealthPlanHydrationError(null);
    } else {
      indexManufacturerOrganizations(loaded);
      markManufacturerIndexLoaded();
      setManufacturerHydrationError(null);
    }

    const { hydrateWarehouseImportManifestsFromDb } = await import(
      "./manifestPersistence"
    );
    await hydrateWarehouseImportManifestsFromDb();

    return {
      id,
      buyerPack,
      status: loaded.length > 0 ? "loaded" : "empty",
      organizationsLoaded: loaded.length,
      organizationsInDb,
      error: loaded.length > 0 ? null : `Neon returned 0 ${buyerPack} rows`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (id === "health-plans") setHealthPlanHydrationError(message);
    if (id === "manufacturers") setManufacturerHydrationError(message);
    console.error(`[warehouse] ${id} hydration failed:`, error);
    return {
      id,
      buyerPack,
      status: "failed",
      organizationsLoaded: 0,
      organizationsInDb,
      error: message,
    };
  }
}

/** Load all warehouse connectors from Neon (idempotent per process). */
export async function ensureOrganizationWarehouseHydrated(): Promise<WarehouseHydrationResult> {
  if (!isOrganizationWarehouseEnabled()) {
    return {
      attemptedAt: new Date().toISOString(),
      databaseConfigured: isDatabaseConfigured(),
      connectors: [],
      totalLoaded: 0,
      error: "Organization warehouse is disabled",
    };
  }

  const hpSize = healthPlansConnectorApi.getIndexSize();
  const mfgSize = manufacturersConnectorApi.getIndexSize();
  if (hpSize > 0 && mfgSize > 0 && lastHydrationResult) {
    return lastHydrationResult;
  }

  if (hydrationPromise) {
    return hydrationPromise;
  }

  hydrationPromise = (async () => {
    const attemptedAt = new Date().toISOString();
    console.info("[warehouse] Starting Neon hydration for production connectors");

    const connectors: ConnectorHydrationResult[] = [];
    for (const id of PRODUCTION_WAREHOUSE_CONNECTOR_IDS) {
      const currentSize =
        id === "health-plans"
          ? healthPlansConnectorApi.getIndexSize()
          : manufacturersConnectorApi.getIndexSize();
      if (currentSize > 0) {
        connectors.push({
          id,
          buyerPack: CONNECTOR_BUYER_PACK[id],
          status: "loaded",
          organizationsLoaded: currentSize,
          organizationsInDb: await countWarehouseOrganizationsInDb(CONNECTOR_BUYER_PACK[id]),
          error: null,
        });
        continue;
      }
      connectors.push(await hydrateConnectorFromDb(id));
    }

    const totalLoaded = connectors.reduce(
      (sum, connector) => sum + connector.organizationsLoaded,
      0,
    );
    const failures = connectors.filter(
      (connector) => connector.status === "failed" || connector.status === "empty",
    );
    const error =
      failures.length > 0
        ? failures
            .map((connector) => `${connector.id}: ${connector.error ?? connector.status}`)
            .join("; ")
        : null;

    if (error) {
      console.error(`[warehouse] Hydration incomplete — ${error}`);
    } else {
      console.info(`[warehouse] Hydration complete — ${totalLoaded} organizations loaded`);
    }

    const result: WarehouseHydrationResult = {
      attemptedAt,
      databaseConfigured: isDatabaseConfigured(),
      connectors,
      totalLoaded,
      error,
    };
    lastHydrationResult = result;
    hydrationPromise = null;
    return result;
  })();

  return hydrationPromise;
}

export function getLastWarehouseHydrationResult(): WarehouseHydrationResult | null {
  return lastHydrationResult;
}

export function getWarehouseHydrationSnapshot(): {
  healthPlansState: ReturnType<typeof getHealthPlanHydrationState>;
  manufacturersState: ReturnType<typeof getManufacturerHydrationState>;
  healthPlansError: string | null;
  manufacturersError: string | null;
  lastResult: WarehouseHydrationResult | null;
} {
  return {
    healthPlansState: getHealthPlanHydrationState(),
    manufacturersState: getManufacturerHydrationState(),
    healthPlansError: getHealthPlanHydrationError(),
    manufacturersError: getManufacturerHydrationError(),
    lastResult: lastHydrationResult,
  };
}

/** Non-blocking hydration kickoff for server startup. */
export function kickoffOrganizationWarehouseHydration(): void {
  if (!isOrganizationWarehouseEnabled()) return;
  void ensureOrganizationWarehouseHydrated();
}

/** Reset hydration cache (tests only — simulates a cold serverless instance). */
export function resetWarehouseHydrationStateForTests(): void {
  lastHydrationResult = null;
  hydrationPromise = null;
}
