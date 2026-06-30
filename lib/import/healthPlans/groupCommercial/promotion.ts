import type { GroupCommercialEvidenceRecord } from "./types";

const PROMOTABLE_EVIDENCE_TYPES = new Set([
  "group_commercial",
  "employer_group_commercial",
  "carrier_group_product",
]);

/** Whether stored evidence may promote the Health Plan Commercial LOB classification. */
export function evidencePromotesCommercialLob(
  evidence: GroupCommercialEvidenceRecord[],
): boolean {
  return evidence.some((record) => {
    if (record.evidenceType === "tpa_or_admin_only") return false;
    if (record.confidence === "low") return false;
    if (record.evidenceType === "erisa_employer_plan") {
      return record.confidence === "high";
    }
    return PROMOTABLE_EVIDENCE_TYPES.has(record.evidenceType);
  });
}
