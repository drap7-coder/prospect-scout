#!/usr/bin/env node
/** Import manufacturers into the organization warehouse. Usage: npm run import:manufacturers */
import { importNationalManufacturerCatalog } from "../lib/import/manufacturers/importManufacturers.ts";
import { manufacturerImportMode } from "../lib/import/manufacturers/sources/loadSources.ts";
import { resetCatalogIndex } from "../lib/discovery/catalog/catalogIndex.ts";

console.log(`Manufacturer import mode: ${manufacturerImportMode()}`);
const stats = await importNationalManufacturerCatalog();
resetCatalogIndex();

console.log("\nManufacturer import summary:");
console.log(`  Indexed: ${stats.indexSizeAfterImport}`);
console.log(`  SEC records: ${stats.secRecordsParsed}`);
console.log(`  FDA records: ${stats.fdaRecordsParsed}`);
console.log(`  Candidates: ${stats.candidatesBuilt}`);
console.log(`  Merged: ${stats.organizationsMerged}`);
console.log(`  Duplicate org IDs: ${stats.duplicateOrganizationIds}`);
console.log(JSON.stringify(stats, null, 2));
