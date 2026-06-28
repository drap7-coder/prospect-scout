#!/usr/bin/env node
/** Fetch manufacturer warehouse source snapshots. Usage: npm run fetch:manufacturers */
import { fetchManufacturerWarehouseData } from "../lib/import/manufacturers/sources/fetch.ts";

const stats = await fetchManufacturerWarehouseData();
console.log(JSON.stringify(stats, null, 2));
