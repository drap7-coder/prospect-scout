import type { SectorAttributes } from "@/lib/organization/model";
import {
  GROUP_COMMERCIAL_EVIDENCE_SECTOR_KEY,
  type GroupCommercialEvidenceRecord,
} from "./types";

export function readGroupCommercialEvidence(
  attrs: SectorAttributes | undefined | null,
): GroupCommercialEvidenceRecord[] {
  if (!attrs) return [];
  const raw = attrs[GROUP_COMMERCIAL_EVIDENCE_SECTOR_KEY];
  if (!raw || !Array.isArray(raw)) return [];
  return raw as unknown as GroupCommercialEvidenceRecord[];
}

export function writeGroupCommercialEvidence(
  attrs: SectorAttributes | undefined | null,
  evidence: GroupCommercialEvidenceRecord[],
): SectorAttributes {
  return {
    ...(attrs ?? {}),
    [GROUP_COMMERCIAL_EVIDENCE_SECTOR_KEY]: evidence as unknown as string[],
  };
}

export function mergeGroupCommercialEvidence(
  existing: GroupCommercialEvidenceRecord[],
  incoming: GroupCommercialEvidenceRecord[],
): GroupCommercialEvidenceRecord[] {
  const seen = new Set<string>();
  const merged: GroupCommercialEvidenceRecord[] = [];
  for (const record of [...existing, ...incoming]) {
    const key = [
      record.organizationName,
      record.evidenceType,
      record.source,
      record.parentOrganization ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(record);
  }
  return merged;
}
