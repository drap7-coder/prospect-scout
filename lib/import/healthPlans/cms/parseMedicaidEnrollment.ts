import type { CmsMedicaidEnrollmentRow } from "./types";
import { normalizeState, parseCsvText, readCsvFile, slugify, uniqueSorted } from "./parseCsv";

function parseEnrollment(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseCmsMedicaidEnrollmentRows(
  records: Record<string, string>[],
): CmsMedicaidEnrollmentRow[] {
  const rows: CmsMedicaidEnrollmentRow[] = [];
  for (const record of records) {
    const planId = (record.plan_id ?? "").trim();
    const organizationName = (record.organization_name ?? "").trim();
    const state = normalizeState(record.state ?? "");
    const programName = (record.program_name ?? "").trim();
    if (!planId || !organizationName || !state || !programName) continue;

    rows.push({
      planId,
      organizationName,
      parentOrganization: (record.parent_organization ?? organizationName).trim(),
      state,
      programName,
      planType: (record.plan_type ?? "medicaid_managed_care").trim(),
      enrollment: parseEnrollment(record.enrollment),
      reportingPeriod: (record.reporting_period ?? "").trim(),
      naicId: record.naic_id?.trim() || undefined,
      datasetRowId: (record.dataset_row_id ?? planId).trim(),
    });
  }
  return rows;
}

/** Group enrollment rows by plan id (verified key). */
export function aggregateCmsMedicaidEnrollmentPlans(rows: CmsMedicaidEnrollmentRow[]): {
  id: string;
  planId: string;
  organizationName: string;
  parentOrganization: string;
  states: string[];
  programNames: string[];
  planType: string;
  enrollment: number;
  reportingPeriod: string;
  naicId?: string;
  datasetRowIds: string[];
}[] {
  const grouped = new Map<
    string,
    {
      id: string;
      planId: string;
      organizationName: string;
      parentOrganization: string;
      states: string[];
      programNames: string[];
      planType: string;
      enrollment: number;
      reportingPeriod: string;
      naicId?: string;
      datasetRowIds: string[];
    }
  >();

  for (const row of rows) {
    const key = row.planId;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        id: `cms-mco-enroll-${row.planId}`,
        planId: row.planId,
        organizationName: row.organizationName,
        parentOrganization: row.parentOrganization,
        states: [row.state],
        programNames: [row.programName],
        planType: row.planType,
        enrollment: row.enrollment,
        reportingPeriod: row.reportingPeriod,
        naicId: row.naicId,
        datasetRowIds: [row.datasetRowId],
      });
      continue;
    }

    existing.states.push(row.state);
    existing.programNames.push(row.programName);
    existing.datasetRowIds.push(row.datasetRowId);
    existing.states = uniqueSorted(existing.states);
    existing.programNames = uniqueSorted(existing.programNames);
    existing.datasetRowIds = uniqueSorted(existing.datasetRowIds);
    existing.enrollment += row.enrollment;
    if (!existing.naicId && row.naicId) existing.naicId = row.naicId;
    if (row.reportingPeriod && row.reportingPeriod > existing.reportingPeriod) {
      existing.reportingPeriod = row.reportingPeriod;
    }
  }

  return [...grouped.values()];
}

export function parseCmsMedicaidEnrollmentCsvFile(path: string) {
  return aggregateCmsMedicaidEnrollmentPlans(
    parseCmsMedicaidEnrollmentRows(readCsvFile(path)),
  );
}

export function parseCmsMedicaidEnrollmentCsvText(text: string) {
  return aggregateCmsMedicaidEnrollmentPlans(
    parseCmsMedicaidEnrollmentRows(parseCsvText(text)),
  );
}

/** Count orgs in enrollment data whose plan id is not in program-features MCO ids. */
export function countNetNewMedicaidEnrollmentPlans(
  programMcoIds: Set<string>,
  enrollmentPlans: { planId: string }[],
): number {
  let netNew = 0;
  for (const plan of enrollmentPlans) {
    const slugKey = slugify(plan.planId);
    if (!programMcoIds.has(plan.planId) && !programMcoIds.has(slugKey)) {
      netNew += 1;
    }
  }
  return netNew;
}
