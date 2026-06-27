import type { RawProspect, SizeTier } from "@/lib/search/types";
import type { Organization } from "./organization";
import type { RankedOrganization } from "./rank";
import { sourceRecordsFromOrgSources } from "@/lib/intelligence/sourceRecords";
import { normalizeEinDigits } from "@/lib/discovery/connectors/propublica/normalize";

function extractEinFromOrgId(id: string): string | undefined {
  const match = id.match(/(?:irs-nonprofits-)(\d+)/i);
  if (match) {
    const digits = normalizeEinDigits(match[1]);
    return digits.length === 9 ? digits : undefined;
  }
  return undefined;
}

function estimateSize(org: Organization): SizeTier {
  const emp = org.employeeRange ? Number(org.employeeRange) : 0;
  if (emp >= 10_000_000) return "enterprise";
  if (emp >= 2_000_000) return "large";
  if (emp >= 500_000) return "mid";
  if (emp >= 5_000) return "mid";
  return "large";
}

function parseEmployeeEstimate(org: Organization): number | undefined {
  if (!org.employeeRange) return undefined;
  const n = Number(org.employeeRange.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function deriveFitKeywords(org: Organization): string[] {
  const keywords = new Set<string>();
  for (const ind of org.industries) {
    keywords.add(ind.replace(/-/g, " "));
  }
  if (org.sectorId) keywords.add(org.sectorId.replace(/-/g, " "));
  if (org.organizationType) keywords.add(org.organizationType.replace(/-/g, " "));
  return [...keywords];
}

/** Convert a canonical Organization into a RawProspect for the scoring pipeline. */
export function organizationToRawProspect(org: Organization): RawProspect {
  return {
    id: org.id,
    name: org.canonicalName,
    location: org.headquarters ?? org.locations[0] ?? "Unknown",
    region: org.regions[0] ?? "any",
    buyerPack: org.buyerPack ?? "employers",
    size: estimateSize(org),
    signals: [],
    fitKeywords: deriveFitKeywords(org),
    directoryId: org.id,
    directoryMatch: true,
    sectorId: org.sectorId ?? undefined,
    industryId: org.industries[0],
    organizationTypeId: org.organizationType ?? undefined,
    canonicalOrganizationTypeId: org.canonicalOrganizationType,
    ein: extractEinFromOrgId(org.id),
    stateCode: org.states[0],
    publicCompany: org.ownership === "public",
    website: org.website ?? undefined,
    description: org.description ?? undefined,
    employeeEstimate: parseEmployeeEstimate(org),
    discoveryConfidence: org.confidence,
    sourceRecords: sourceRecordsFromOrgSources(org.sources),
  };
}

/** Convert ranked discovery results to RawProspects, preserving relevance order. */
export function rankedOrganizationsToRawProspects(
  orgs: RankedOrganization[],
): RawProspect[] {
  return orgs.map((org) => ({
    ...organizationToRawProspect(org),
    discoveryMatchReasons: org.matchReasons,
    discoveryConfidence: org.confidence,
  }));
}
