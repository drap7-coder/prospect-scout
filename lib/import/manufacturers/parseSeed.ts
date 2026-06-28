import { MANUFACTURERS_DIRECTORY } from "@/lib/directories/manufacturers";
import type { OrganizationRecord } from "@/lib/directories/types";

export function parseManufacturerSeed(): OrganizationRecord[] {
  return MANUFACTURERS_DIRECTORY.map((record) => ({ ...record }));
}
