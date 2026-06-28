import { parseCsvText } from "../parseCsv";

function inferContractType(row: Record<string, string>): string {
  const orgType = (row["Organization Type"] ?? "").toUpperCase();
  const planType = (row["Plan Type"] ?? "").toUpperCase();
  const offersPartD = (row["Offers Part D"] ?? "").toLowerCase();

  if (orgType.includes("PDP") || planType.includes("PRESCRIPTION DRUG")) return "PDP";
  if (offersPartD === "yes" && (row["MAOnly"] ?? "") !== "*") return "MA-PD";
  if (
    orgType.includes("CCP") ||
    orgType.includes("PFFS") ||
    orgType.includes("MSA") ||
    planType.includes("HMO") ||
    planType.includes("PPO") ||
    planType.includes("MEDICARE-MEDICAID")
  ) {
    return "MA";
  }
  return "OTHER";
}

/** Map CMS Monthly Enrollment by Contract CSV to canonical CPSC import rows. */
export function cmsMonthlyReportToCpscRecords(text: string): Record<string, string>[] {
  const rows = parseCsvText(text);
  const records: Record<string, string>[] = [];
  for (const row of rows) {
    const contractId = (row["Contract Number"] ?? row.contract_id ?? "").trim();
    const legalEntityName = (row["Organization Name"] ?? row.legal_entity_name ?? "").trim();
    if (!contractId || !legalEntityName) continue;

    records.push({
      contract_id: contractId,
      legal_entity_name: legalEntityName,
      marketing_name: (
        row["Organization Marketing Name"] ??
        row.marketing_name ??
        legalEntityName
      ).trim(),
      parent_organization: (row["Parent Organization"] ?? row.parent_organization ?? "").trim(),
      contract_type: inferContractType(row),
      state_service: "",
      star_rating: "",
      naic_id: "",
      dataset_row_id: contractId,
    });
  }
  return records;
}
