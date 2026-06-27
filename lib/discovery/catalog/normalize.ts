import { deriveDomain, finalizeOrganization, type Organization, type OrganizationSource } from "../organization";
import type { CatalogRecord } from "./types";

const REGIONS_BY_STATE: Record<string, string> = {
  CT: "northeast", DC: "mid-atlantic", DE: "mid-atlantic", MA: "northeast", MD: "mid-atlantic",
  ME: "northeast", NH: "northeast", NJ: "mid-atlantic", NY: "northeast", PA: "mid-atlantic",
  RI: "northeast", VT: "northeast", IL: "midwest", IN: "midwest", IA: "midwest", KS: "midwest",
  MI: "midwest", MN: "midwest", MO: "midwest", ND: "midwest", NE: "midwest", OH: "midwest",
  SD: "midwest", WI: "midwest", AL: "southeast", AR: "southeast", FL: "southeast",
  GA: "southeast", KY: "southeast", LA: "southeast", MS: "southeast", NC: "southeast",
  SC: "southeast", TN: "southeast", VA: "southeast", WV: "southeast", AZ: "southwest",
  NM: "southwest", OK: "southwest", TX: "southwest", AK: "west", CA: "west", CO: "west",
  HI: "west", ID: "west", MT: "west", NV: "west", OR: "west", UT: "west", WA: "west", WY: "west",
};

export function catalogSourceStamp(
  connectorId: string,
  record: CatalogRecord,
): OrganizationSource {
  return {
    connector: connectorId,
    sourceId: record.sourceId,
    sourceName: record.metadata.sourceName,
    sourceUrl: record.metadata.sourceUrl,
    lastUpdated: record.metadata.lastUpdated,
    confidence: record.metadata.confidence,
    retrievedAt: new Date().toISOString(),
    evidence: [record.metadata.sourceName],
  };
}

/** Normalize a catalog record into the canonical Organization model. */
export function catalogRecordToOrganization(
  connectorId: string,
  record: CatalogRecord,
): Organization {
  const states =
    record.states ?? (record.state ? [record.state] : []);
  const regions =
    record.regions ??
    (record.state ? [REGIONS_BY_STATE[record.state] ?? "national"].filter(Boolean) : []);
  const headquarters =
    record.headquarters ??
    (record.city && record.state
      ? `${record.city}, ${record.state}`
      : record.state ?? null);

  return finalizeOrganization({
    id: `${connectorId}-${record.sourceId}`,
    canonicalName: record.name,
    aliases: record.aliases ?? [],
    website: record.website ?? null,
    domain: deriveDomain(record.website ?? null),
    organizationType: record.organizationType,
    industries: record.industries,
    sectorId: record.sectorId,
    headquarters,
    locations: headquarters ? [headquarters] : [],
    states,
    regions,
    ownership: record.ownership ?? null,
    employeeRange: null,
    revenueRange: null,
    description: null,
    sources: [catalogSourceStamp(connectorId, record)],
    buyerPack: record.buyerPack ?? null,
    canonicalOrganizationType: "other",
    healthPlanType: record.healthPlanType,
  });
}
