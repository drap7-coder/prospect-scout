#!/usr/bin/env node
/**
 * Import Form 5500 CSV into Neon + refresh ERISA search index.
 * Usage: npm run import:erisa -- path/to/form5500.csv
 */
import { readFileSync } from "node:fs";
import { importErisaCsv } from "../lib/import/erisa/import.ts";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npm run import:erisa -- <path-to-csv>");
  process.exit(1);
}

const csv = readFileSync(path, "utf8");
const stats = await importErisaCsv(csv);
console.log(JSON.stringify(stats, null, 2));
