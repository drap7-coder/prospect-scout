import type { RawProspect, SizeTier } from "@/lib/search/types";
import type { OrganizationRecord } from "./types";

function headquartersState(record: OrganizationRecord): string {
  const parts = record.headquarters.split(",").map((s) => s.trim());
  return parts.length >= 2 ? parts[parts.length - 1] : record.statesServed[0] ?? "";
}

function estimateSize(record: OrganizationRecord): SizeTier {
  const members = record.memberEstimate ?? record.employeeEstimate ?? 0;
  if (members >= 10_000_000) return "enterprise";
  if (members >= 2_000_000) return "large";
  if (members >= 500_000) return "mid";
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
  keywords.add("pharmacy");
  keywords.add("pbm consulting");
  return [...keywords];
}

/**
 * Convert a master directory record into a RawProspect for the enrichment pipeline.
 * Directory-sourced prospects appear even when providers return no signals.
 */
export function directoryRecordToRawProspect(record: OrganizationRecord): RawProspect {
  return {
    id: record.id,
    name: record.name,
    location: record.headquarters,
    region: record.regions[0] ?? "national",
    buyerPack: record.buyerPack,
    size: estimateSize(record),
    signals: [],
    fitKeywords: deriveFitKeywords(record),
    directoryId: record.id,
    directoryMatch: true,
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
