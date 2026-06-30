import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { warehouseConnectorManifests } from "@/lib/db/schema";
import type { HealthPlanCatalogImportManifest } from "@/lib/import/healthPlans/catalogManifest";
import {
  getHealthPlanCatalogImportManifest,
  setHealthPlanCatalogImportManifest,
} from "@/lib/import/healthPlans/catalogManifest";
import type { ManufacturerCatalogImportManifest } from "@/lib/import/manufacturers/catalogManifest";
import {
  getManufacturerCatalogImportManifest,
  setManufacturerCatalogImportManifest,
} from "@/lib/import/manufacturers/catalogManifest";
import type { WarehouseConnectorId } from "./types";

async function persistConnectorManifest(
  connectorId: WarehouseConnectorId,
  importedAt: string,
  importMode: string,
  manifest: unknown,
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db
    .insert(warehouseConnectorManifests)
    .values({
      connectorId,
      importedAt: new Date(importedAt),
      importMode,
      manifest,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: warehouseConnectorManifests.connectorId,
      set: {
        importedAt: new Date(importedAt),
        importMode,
        manifest,
        updatedAt: new Date(),
      },
    });
}

export async function persistHealthPlanImportManifest(
  manifest: HealthPlanCatalogImportManifest,
): Promise<void> {
  await persistConnectorManifest(
    "health-plans",
    manifest.importedAt,
    manifest.cmsImportMode,
    manifest,
  );
}

export async function persistManufacturerImportManifest(
  manifest: ManufacturerCatalogImportManifest,
): Promise<void> {
  await persistConnectorManifest(
    "manufacturers",
    manifest.importedAt,
    manifest.importMode,
    manifest,
  );
}

async function loadConnectorManifest<T>(
  connectorId: WarehouseConnectorId,
): Promise<T | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(warehouseConnectorManifests)
    .where(eq(warehouseConnectorManifests.connectorId, connectorId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return row.manifest as T;
}

/** Hydrate in-memory health-plan manifest from Neon (no-op when already loaded). */
export async function hydrateHealthPlanImportManifestFromDb(): Promise<void> {
  if (getHealthPlanCatalogImportManifest()) return;
  const manifest = await loadConnectorManifest<HealthPlanCatalogImportManifest>(
    "health-plans",
  );
  if (manifest) setHealthPlanCatalogImportManifest(manifest);
}

/** Hydrate in-memory manufacturer manifest from Neon (no-op when already loaded). */
export async function hydrateManufacturerImportManifestFromDb(): Promise<void> {
  if (getManufacturerCatalogImportManifest()) return;
  const manifest = await loadConnectorManifest<ManufacturerCatalogImportManifest>(
    "manufacturers",
  );
  if (manifest) setManufacturerCatalogImportManifest(manifest);
}

/** Load both connector manifests into process memory after Neon hydration. */
export async function hydrateWarehouseImportManifestsFromDb(): Promise<void> {
  await Promise.all([
    hydrateHealthPlanImportManifestFromDb(),
    hydrateManufacturerImportManifestFromDb(),
  ]);
}
