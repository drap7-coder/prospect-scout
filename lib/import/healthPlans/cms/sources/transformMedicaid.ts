import { slugify } from "../parseCsv";

/** Map Medicaid managed care program features into MCO import rows. */
export function medicaidProgramsToMcoRecords(
  rows: Record<string, string>[],
): Record<string, string>[] {
  const records: Record<string, string>[] = [];

  for (const row of rows) {
    const organizationName = (
      row.features ??
      row.organization_name ??
      row.program_name ??
      ""
    ).trim();
    const state = inferStateFromRow(row);
    if (!organizationName || !state) continue;

    const mcoId = slugify(`${state}-${organizationName}`).slice(0, 48);
    records.push({
      mco_id: mcoId,
      organization_name: organizationName,
      parent_organization: organizationName,
      state,
      plan_type: "medicaid_managed_care",
      naic_id: "",
      dataset_row_id: mcoId,
    });
  }

  return records;
}

function inferStateFromRow(row: Record<string, string>): string {
  const direct = (row.state ?? row.State ?? row.state_code ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(direct)) return direct;

  const text = JSON.stringify(row).toUpperCase();
  const match = text.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/);
  return match?.[1] ?? "";
}
