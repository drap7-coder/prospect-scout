import type { RawProspect, SizeTier } from "@/lib/search/types";
import type { OrganizationRecord } from "./types";
import { normalizeDirectoryRecord } from "./types";

function headquartersState(record: OrganizationRecord): string {
  const parts = record.headquarters.split(",").map((s) => s.trim());
  const last = parts.length >= 2 ? parts[parts.length - 1] : "";
  if (/^[A-Z]{2}$/.test(last)) return last;
  return record.statesServed[0] ?? "";
}

function estimateSize(record: OrganizationRecord): SizeTier {
  const members = record.memberEstimate ?? record.employeeEstimate ?? 0;
  if (members >= 10_000_000) return "enterprise";
  if (members >= 2_000_000) return "large";
  if (members >= 500_000) return "mid";
  if (members >= 5_000) return "mid";
  return "small";
}

function deriveFitKeywords(record: OrganizationRecord): string[] {
  const keywords = new Set<string>();
  if (record.medicare) keywords.add("medicare");
  if (record.medicaid) keywords.add("medicaid");
  if (record.commercial) keywords.add("commercial");
  if (record.exchange) keywords.add("exchange");
  if (record.aso) keywords.add("aso");
  if (record.tpa) keywords.add("tpa");
  if (record.tags?.includes("blues")) keywords.add("blue cross");
  if (record.tags?.includes("managed-medicaid")) keywords.add("managed care");
  if (record.industryId) keywords.add(record.industryId.replace(/-/g, " "));
  if (record.sectorId) keywords.add(record.sectorId.replace(/-/g, " "));
  keywords.add("pharmacy");
  keywords.add("pbm consulting");
  return [...keywords];
}

/**
 * Convert a master directory record into a RawProspect for the enrichment pipeline.
 * Directory-sourced prospects appear even when providers return no signals.
 */
export function directoryRecordToRawProspect(record: OrganizationRecord): RawProspect {
  const normalized = normalizeDirectoryRecord(record);
  return {
    id: normalized.id,
    name: normalized.name,
    location: normalized.headquarters,
    region: normalized.regions[0] ?? "national",
    buyerPack: normalized.buyerPack,
    size: estimateSize(normalized),
    signals: [],
    fitKeywords: deriveFitKeywords(normalized),
    directoryId: normalized.id,
    directoryMatch: true,
    sectorId: normalized.sectorId,
    industryId: normalized.industryId,
    organizationTypeId: normalized.organizationTypeId,
    stateCode: headquartersState(normalized),
    stateCodes: normalized.statesServed,
    publicCompany: normalized.publicCompany,
    website: normalized.website,
    // Keep covered lives (payers) distinct from headcount — never conflate them.
    employeeEstimate: normalized.employeeEstimate,
    coveredLives: normalized.memberEstimate,
    sourceRecords: [
      {
        connector: "directory",
        label: "Directory",
        confidence: 0.88,
        evidenceText: "Master organization directory record",
      },
    ],
  };
}

export function directoryRecordsToRawProspects(
  records: OrganizationRecord[],
): RawProspect[] {
  return records.map(directoryRecordToRawProspect);
}

/** Primary state for legacy public-web directory entries. */
export function primaryState(record: OrganizationRecord): string {
  return record.statesServed[0] ?? headquartersState(record);
}

export { estimateSize, deriveFitKeywords, headquartersState };
