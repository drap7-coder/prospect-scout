#!/usr/bin/env node
/**
 * Fetch source data for all production organization warehouse connectors.
 * Usage: npm run fetch:warehouse
 */
import { fetchOrganizationWarehouseSources } from "../lib/import/warehouse/import.ts";

const stats = await fetchOrganizationWarehouseSources();
console.log(JSON.stringify(stats, null, 2));
