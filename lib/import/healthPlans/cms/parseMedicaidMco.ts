import type { CmsMedicaidMcoRow } from "./types";
import { normalizeState, parseCsvText, readCsvFile, slugify } from "./parseCsv";

export function parseCmsMedicaidMcoRows(
  records: Record<string, string>[],
): CmsMedicaidMcoRow[] {
  const rows: CmsMedicaidMcoRow[] = [];
  for (const record of records) {
    const mcoId = (record.mco_id ?? "").trim();
    const organizationName = (record.organization_name ?? "").trim();
    const state = normalizeState(record.state ?? "");
    if (!mcoId || !organizationName || !state) continue;
    rows.push({
      mcoId,
      organizationName,
      parentOrganization: (record.parent_organization ?? organizationName).trim(),
      state,
      planType: (record.plan_type ?? "medicaid_managed_care").trim(),
      naicId: record.naic_id?.trim() || undefined,
      datasetRowId: (record.dataset_row_id ?? mcoId).trim(),
    });
  }
  return rows;
}

/** Group Medicaid MCO rows by organization name. */
export function aggregateCmsMedicaidMcos(rows: CmsMedicaidMcoRow[]): {
  id: string;
  organizationName: string;
  parentOrganization: string;
  states: string[];
  mcoIds: string[];
  planType: string;
  naicId?: string;
  datasetRowIds: string[];
}[] {
  const grouped = new Map<
    string,
    {
      id: string;
      organizationName: string;
      parentOrganization: string;
      states: string[];
      mcoIds: string[];
      planType: string;
      naicId?: string;
      datasetRowIds: string[];
    }
  >();

  for (const row of rows) {
    const key = row.organizationName.toLowerCase();
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        id: `cms-mco-${slugify(row.organizationName)}`,
        organizationName: row.organizationName,
        parentOrganization: row.parentOrganization,
        states: [row.state],
        mcoIds: [row.mcoId],
        planType: row.planType,
        naicId: row.naicId,
        datasetRowIds: [row.datasetRowId],
      });
      continue;
    }
    existing.states.push(row.state);
    existing.mcoIds.push(row.mcoId);
    existing.datasetRowIds.push(row.datasetRowId);
    existing.states = [...new Set(existing.states)].sort();
    existing.mcoIds = [...new Set(existing.mcoIds)].sort();
    existing.datasetRowIds = [...new Set(existing.datasetRowIds)].sort();
    if (!existing.naicId && row.naicId) existing.naicId = row.naicId;
  }

  return [...grouped.values()];
}

export function parseCmsMedicaidMcoCsvFile(path: string) {
  return aggregateCmsMedicaidMcos(parseCmsMedicaidMcoRows(readCsvFile(path)));
}

export function parseCmsMedicaidMcoCsvText(text: string) {
  return aggregateCmsMedicaidMcos(parseCmsMedicaidMcoRows(parseCsvText(text)));
}
