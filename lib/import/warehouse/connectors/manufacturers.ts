import {
  importNationalManufacturerCatalog,
  importNationalManufacturerCatalogToDb,
  importManufacturerFullCatalog,
  fetchManufacturerWarehouseData,
  getManufacturerOrganizations,
  getManufacturerIndexSize,
  computeManufacturerCoverageReport,
  getManufacturerCatalogImportManifest,
  kickoffManufacturerIndexHydration,
  ensureManufacturerIndexHydrated,
  manufacturerImportMode,
} from "@/lib/import/manufacturers";
import { setManufacturerIndex } from "@/lib/import/manufacturers/memoryIndex";
import type { WarehouseConnectorDefinition, WarehouseConnectorSummary } from "../types";

export const MANUFACTURERS_CONNECTOR: WarehouseConnectorDefinition = {
  id: "manufacturers",
  label: "Manufacturers",
  description:
    "SEC EDGAR public manufacturers, FDA establishment registrations, and curated bootstrap seeds.",
  status: "production",
  buyerPack: "manufacturers",
};

export function summarizeManufacturersConnector(): WarehouseConnectorSummary {
  const manifest = getManufacturerCatalogImportManifest();
  return {
    id: MANUFACTURERS_CONNECTOR.id,
    label: MANUFACTURERS_CONNECTOR.label,
    status: MANUFACTURERS_CONNECTOR.status,
    organizationsIndexed: getManufacturerIndexSize(),
    lastImportAt: manifest?.importedAt ?? null,
    importMode: manifest?.importMode ?? manufacturerImportMode(),
  };
}

export const manufacturersConnectorApi = {
  definition: MANUFACTURERS_CONNECTOR,
  getOrganizations: getManufacturerOrganizations,
  getIndexSize: getManufacturerIndexSize,
  summarize: summarizeManufacturersConnector,
  importNational: importNationalManufacturerCatalog,
  importNationalToDb: importNationalManufacturerCatalogToDb,
  importFull: importManufacturerFullCatalog,
  fetch: fetchManufacturerWarehouseData,
  computeCoverageReport: computeManufacturerCoverageReport,
  kickoffHydration: kickoffManufacturerIndexHydration,
  ensureHydrated: ensureManufacturerIndexHydrated,
  restoreIndex: setManufacturerIndex,
};
