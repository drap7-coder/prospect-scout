import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ManufacturerImportPaths } from "./types";

const moduleDir = dirname(fileURLToPath(import.meta.url));

export function defaultManufacturerImportPaths(): ManufacturerImportPaths {
  const fixtureRoot = join(moduleDir, "../../../fixtures/import/manufacturers");
  return {
    secJson: join(fixtureRoot, "sec-manufacturers.json"),
    fdaJson: join(fixtureRoot, "fda-establishments.json"),
  };
}

export function productionManufacturerDataRoot(): string {
  return join(moduleDir, "../../../data/import/manufacturers/production");
}

export function productionManufacturerImportPaths(): ManufacturerImportPaths {
  const root = productionManufacturerDataRoot();
  return {
    secJson: join(root, "sec-manufacturers.json"),
    fdaJson: join(root, "fda-establishments.json"),
  };
}
