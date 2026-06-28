import {
  mergeCatalogByVerifiedIds,
  dedupeCatalogEntriesByOrganizationId,
  countDuplicateOrganizationIds,
  type CatalogEntry,
} from "@/lib/import/warehouse/mergeByVerifiedIds";
import type { ManufacturerImportCandidate } from "./types";

export function mergeManufacturerCatalog(
  existingEntries: CatalogEntry[],
  incoming: ManufacturerImportCandidate[],
): ReturnType<typeof mergeCatalogByVerifiedIds> {
  return mergeCatalogByVerifiedIds(existingEntries, incoming);
}

export { dedupeCatalogEntriesByOrganizationId, countDuplicateOrganizationIds };
