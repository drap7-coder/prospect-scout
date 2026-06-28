import { readFileSync, writeFileSync } from "node:fs";

/** Minimal RFC4180-style CSV parser for CMS fixture files. */
export function parseCsvText(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  if (nonEmpty.length === 0) return [];

  const headers = parseCsvLine(nonEmpty[0]!);
  const rows: Record<string, string>[] = [];
  for (const line of nonEmpty.slice(1)) {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

export function readCsvFile(path: string): Record<string, string>[] {
  return parseCsvText(readFileSync(path, "utf8"));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function normalizeContractId(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeState(value: string): string {
  return value.trim().toUpperCase();
}

export function parseOptionalNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Write normalized CMS import CSV (header row + data rows). */
export function writeCsvFile(
  path: string,
  headers: string[],
  records: Record<string, string>[],
): void {
  const lines = [
    headers.join(","),
    ...records.map((record) =>
      headers.map((header) => escapeCsvField(record[header] ?? "")).join(","),
    ),
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}
