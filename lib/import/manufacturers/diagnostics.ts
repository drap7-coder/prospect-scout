import {
  MANUFACTURERS_BOOTSTRAP_CONNECTOR_ID,
} from "./types";
import { discoverFromCatalogIndex } from "@/lib/discovery/catalog/catalogIndex";
import { parseSearchIntent } from "@/lib/discovery/intent";
import {
  getManufacturerCatalogImportManifest,
  buildManufacturerManifestFields,
} from "./catalogManifest";
import {
  getManufacturerOrganizations,
  getManufacturerIndexSize,
} from "./memoryIndex";
import { manufacturerImportMode } from "./sources/loadSources";
import { shouldUseManufacturerWarehouseCatalog } from "./featureFlag";
import { countDuplicateOrganizationIds } from "./mergeCatalog";
import type { Organization } from "@/lib/discovery/organization";

export interface ManufacturerConnectorDiagnostics {
  importMode: "production" | "fixture";
  runtimeMode: "warehouse" | "bootstrap-seed";
  rawSourceRecords: { sec: number; fda: number; seed: number };
  normalizedCandidates: number;
  canonicalOrganizations: number;
  mergedCount: number;
  duplicateOrganizationIds: number;
  indexedCount: number;
  searchableCount: number;
  byState: Record<string, number>;
  byIndustry: Record<string, number>;
  byOrganizationType: Record<string, number>;
  bySourceConnector: Record<string, number>;
  lastImportAt: string | null;
}

const MANUFACTURER_CONNECTOR_IDS = [
  MANUFACTURERS_BOOTSTRAP_CONNECTOR_ID,
  "warehouse-manufacturers-sec",
  "warehouse-manufacturers-fda",
];

export function computeManufacturerConnectorDiagnostics(
  organizations: Organization[] = getManufacturerOrganizations(),
): ManufacturerConnectorDiagnostics {
  const manifest = getManufacturerCatalogImportManifest();
  const fields = buildManufacturerManifestFields(organizations);
  const searchableCount = discoverFromCatalogIndex(
    parseSearchIntent("manufacturers"),
    MANUFACTURER_CONNECTOR_IDS,
  ).length;

  return {
    importMode: manufacturerImportMode(),
    runtimeMode: shouldUseManufacturerWarehouseCatalog() ? "warehouse" : "bootstrap-seed",
    rawSourceRecords: manifest?.rawRecords ?? { sec: 0, fda: 0, seed: 0 },
    normalizedCandidates: manifest?.pipeline.candidatesBuilt ?? 0,
    canonicalOrganizations: organizations.length,
    mergedCount: manifest?.pipeline.merged ?? 0,
    duplicateOrganizationIds: countDuplicateOrganizationIds(organizations),
    indexedCount: getManufacturerIndexSize(),
    searchableCount,
    byState: fields.byState,
    byIndustry: fields.byIndustry,
    byOrganizationType: fields.byOrganizationType,
    bySourceConnector: fields.bySourceConnector,
    lastImportAt: manifest?.importedAt ?? null,
  };
}
