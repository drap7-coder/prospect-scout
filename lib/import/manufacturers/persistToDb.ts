import { getManufacturerOrganizations } from "./memoryIndex";
import { persistWarehouseOrganizations } from "@/lib/import/warehouse/dbPersistence";
import { isDatabaseConfigured } from "@/lib/db";

/** Persist the current in-memory manufacturer index to Neon. */
export async function persistManufacturerIndexToDb(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const orgs = getManufacturerOrganizations();
  if (orgs.length === 0) return 0;
  return persistWarehouseOrganizations(orgs);
}
