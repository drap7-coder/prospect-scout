import { isOrganizationWarehouseEnabled } from "@/lib/import/warehouse/featureFlag";
import { getManufacturerIndexSize } from "./memoryIndex";

/** Manufacturer catalog is active when warehouse mode is on and the index is populated. */
export function shouldUseManufacturerWarehouseCatalog(): boolean {
  return isOrganizationWarehouseEnabled() && getManufacturerIndexSize() > 0;
}

export function shouldUseBootstrapManufacturerSeed(): boolean {
  return !shouldUseManufacturerWarehouseCatalog();
}
