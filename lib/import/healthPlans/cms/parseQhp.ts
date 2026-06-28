import type { CmsQhpRow } from "./types";
import { normalizeState, parseCsvText, readCsvFile, slugify } from "./parseCsv";

function parseMarketplace(value: string): CmsQhpRow["marketplace"] {
  return value.trim().toLowerCase().includes("state") ? "State-Based" : "HealthCare.gov";
}

export function parseCmsQhpRows(records: Record<string, string>[]): CmsQhpRow[] {
  const rows: CmsQhpRow[] = [];
  for (const record of records) {
    const hiosId = (record.hios_id ?? "").trim();
    const issuerLegalName = (record.issuer_legal_name ?? "").trim();
    const state = normalizeState(record.state ?? "");
    if (!hiosId || !issuerLegalName || !state) continue;
    rows.push({
      hiosId,
      issuerLegalName,
      state,
      marketplace: parseMarketplace(record.marketplace ?? "HealthCare.gov"),
      naicId: record.naic_id?.trim() || undefined,
      website: record.website?.trim() || undefined,
      parentOrganization: record.parent_organization?.trim() || undefined,
      datasetRowId: (record.dataset_row_id ?? `${hiosId}-${state}`).trim(),
    });
  }
  return rows;
}

/** Group QHP rows by issuer legal name (multi-state issuers become one org). */
export function aggregateCmsQhpIssuers(rows: CmsQhpRow[]): {
  id: string;
  issuerLegalName: string;
  parentOrganization?: string;
  states: string[];
  hiosIds: string[];
  marketplace: CmsQhpRow["marketplace"];
  naicId?: string;
  website?: string;
  datasetRowIds: string[];
}[] {
  const grouped = new Map<
    string,
    {
      id: string;
      issuerLegalName: string;
      parentOrganization?: string;
      states: string[];
      hiosIds: string[];
      marketplace: CmsQhpRow["marketplace"];
      naicId?: string;
      website?: string;
      datasetRowIds: string[];
    }
  >();

  for (const row of rows) {
    const key = row.issuerLegalName.toLowerCase();
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        id: `cms-qhp-${slugify(row.issuerLegalName)}`,
        issuerLegalName: row.issuerLegalName,
        parentOrganization: row.parentOrganization,
        states: [row.state],
        hiosIds: [row.hiosId],
        marketplace: row.marketplace,
        naicId: row.naicId,
        website: row.website,
        datasetRowIds: [row.datasetRowId],
      });
      continue;
    }
    existing.states.push(row.state);
    existing.hiosIds.push(row.hiosId);
    existing.datasetRowIds.push(row.datasetRowId);
    existing.states = [...new Set(existing.states)].sort();
    existing.hiosIds = [...new Set(existing.hiosIds)].sort();
    existing.datasetRowIds = [...new Set(existing.datasetRowIds)].sort();
    if (!existing.naicId && row.naicId) existing.naicId = row.naicId;
    if (!existing.website && row.website) existing.website = row.website;
    if (!existing.parentOrganization && row.parentOrganization) {
      existing.parentOrganization = row.parentOrganization;
    }
  }

  return [...grouped.values()];
}

export function parseCmsQhpCsvFile(path: string) {
  return aggregateCmsQhpIssuers(parseCmsQhpRows(readCsvFile(path)));
}

export function parseCmsQhpCsvText(text: string) {
  return aggregateCmsQhpIssuers(parseCmsQhpRows(parseCsvText(text)));
}
