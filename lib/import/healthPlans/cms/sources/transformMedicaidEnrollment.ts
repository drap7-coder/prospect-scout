import { slugify } from "../parseCsv";

function parseEnrollment(value: string): number {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "--" || cleaned === "-") return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStateName(value: string): string {
  const stateMap: Record<string, string> = {
    ALABAMA: "AL",
    ALASKA: "AK",
    ARIZONA: "AZ",
    ARKANSAS: "AR",
    CALIFORNIA: "CA",
    COLORADO: "CO",
    CONNECTICUT: "CT",
    DELAWARE: "DE",
    "DISTRICT OF COLUMBIA": "DC",
    FLORIDA: "FL",
    GEORGIA: "GA",
    HAWAII: "HI",
    IDAHO: "ID",
    ILLINOIS: "IL",
    INDIANA: "IN",
    IOWA: "IA",
    KANSAS: "KS",
    KENTUCKY: "KY",
    LOUISIANA: "LA",
    MAINE: "ME",
    MARYLAND: "MD",
    MASSACHUSETTS: "MA",
    MICHIGAN: "MI",
    MINNESOTA: "MN",
    MISSISSIPPI: "MS",
    MISSOURI: "MO",
    MONTANA: "MT",
    NEBRASKA: "NE",
    NEVADA: "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    OHIO: "OH",
    OKLAHOMA: "OK",
    OREGON: "OR",
    PENNSYLVANIA: "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    TENNESSEE: "TN",
    TEXAS: "TX",
    UTAH: "UT",
    VERMONT: "VT",
    VIRGINIA: "VA",
    WASHINGTON: "WA",
    "WEST VIRGINIA": "WV",
    WISCONSIN: "WI",
    WYOMING: "WY",
  };

  const upper = value.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return stateMap[upper] ?? "";
}

/** Map Medicaid Managed Care Enrollment Report rows into import records (latest year only). */
export function medicaidEnrollmentToRecords(
  rows: Record<string, string>[],
  options: { preferredYear?: string } = {},
): Record<string, string>[] {
  const years = rows
    .map((row) => (row.year ?? row.Year ?? "").trim())
    .filter(Boolean);
  const preferredYear =
    options.preferredYear ??
    years.sort((a, b) => Number(b) - Number(a))[0] ??
    "2024";

  const filtered = rows.filter(
    (row) => (row.year ?? row.Year ?? "").trim() === preferredYear,
  );

  const records: Record<string, string>[] = [];
  for (const row of filtered) {
    const planName = (row.plan_name ?? row["Plan Name"] ?? "").trim();
    const state = normalizeStateName(row.state ?? row.State ?? "");
    const programName = (row.program_name ?? row["Program Name"] ?? "").trim();
    if (!planName || !state || !programName) continue;

    const enrollment = parseEnrollment(
      row.total_enrollment ?? row["Total Enrollment"] ?? "",
    );
    const parentOrganization = (
      row.parent_organization ??
      row["Parent Organization"] ??
      ""
    ).trim();
    const planId = slugify(`${state}-${programName}-${planName}`).slice(0, 48);

    records.push({
      plan_id: planId,
      organization_name: planName,
      parent_organization: parentOrganization || planName,
      state,
      program_name: programName,
      plan_type: inferPlanType(programName),
      enrollment: String(enrollment),
      reporting_period: preferredYear,
      naic_id: "",
      dataset_row_id: `${preferredYear}-${planId}`,
    });
  }

  return records;
}

function inferPlanType(programName: string): string {
  const lower = programName.toLowerCase();
  if (lower.includes("mltss") || lower.includes("long term")) {
    return "medicaid_mltss";
  }
  if (lower.includes("pccm")) return "medicaid_pccm";
  if (lower.includes("chip")) return "medicaid_chip";
  return "medicaid_managed_care";
}
