import { existsSync, readFileSync } from "node:fs";
import type { CatalogRecord } from "@/lib/discovery/catalog/types";
import { SEC_COMPANY_RECORDS, FDA_RECORDS } from "@/lib/discovery/catalog/loadCatalog";
import {
  defaultManufacturerImportPaths,
  productionManufacturerImportPaths,
} from "../fixtures";
import type { ManufacturerImportPaths } from "../types";

export function manufacturerImportMode(): "production" | "fixture" {
  const paths = resolveManufacturerImportPaths();
  const production = productionManufacturerImportPaths();
  if (
    paths.secJson === production.secJson &&
    paths.fdaJson === production.fdaJson &&
    productionManufacturerDataAvailable()
  ) {
    return "production";
  }
  return "fixture";
}

export function resolveManufacturerImportPaths(): ManufacturerImportPaths {
  if (process.env.USE_MANUFACTURER_FIXTURES === "1") {
    return defaultManufacturerImportPaths();
  }
  const production = productionManufacturerImportPaths();
  if (productionManufacturerDataAvailable(production)) {
    return production;
  }
  return defaultManufacturerImportPaths();
}

export function productionManufacturerDataAvailable(
  paths: ManufacturerImportPaths = productionManufacturerImportPaths(),
): boolean {
  return existsSync(paths.secJson) && existsSync(paths.fdaJson);
}

function readJsonRecords(path: string): CatalogRecord[] | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as CatalogRecord[];
}

/** Load manufacturer source records from production/fixture paths or bundled catalog JSON. */
export function loadManufacturerSourceRecords(paths: ManufacturerImportPaths): {
  sec: CatalogRecord[];
  fda: CatalogRecord[];
} {
  const secFromFile = readJsonRecords(paths.secJson);
  const fdaFromFile = readJsonRecords(paths.fdaJson);

  const sec =
    secFromFile ??
    SEC_COMPANY_RECORDS.filter((record) => record.buyerPack === "manufacturers");
  const fda = fdaFromFile ?? FDA_RECORDS;

  return { sec, fda };
}
