import { parseCsvText } from "../parseCsv";
import { marketplaceForState } from "../stateExchange";

interface ServiceAreaAccumulator {
  hiosIssuerId: string;
  issuerLegalName: string;
  states: Set<string>;
  serviceAreaIds: Set<string>;
  serviceAreaNames: Set<string>;
  marketCoverages: Set<string>;
  coverEntireState: Set<string>;
  datasetRowIds: Set<string>;
}

function isDentalOnly(value: string): boolean {
  return value.trim().toLowerCase() === "yes";
}

/** Derive a display name from service area metadata when legal name is unavailable. */
function issuerNameFromServiceArea(serviceAreaName: string, issuerId: string): string {
  const trimmed = serviceAreaName.trim();
  if (!trimmed) return `HIOS Issuer ${issuerId}`;
  return trimmed
    .replace(/\s*-\s*Individual$/i, "")
    .replace(/\s*SHOP\s*\(Small Group\)$/i, "")
    .replace(/\s*Individual$/i, "")
    .trim();
}

/** Aggregate Service Area PUF rows into issuer×state QHP import records. */
export function serviceAreaPufToQhpRecords(text: string): Record<string, string>[] {
  const rows = parseCsvText(text);
  const issuers = new Map<string, ServiceAreaAccumulator>();

  for (const row of rows) {
    const hiosIssuerId = (row.IssuerId ?? row.hios_issuer_id ?? "").trim();
    const state = (row.StateCode ?? row.state ?? "").trim().toUpperCase();
    if (!hiosIssuerId || !state) continue;
    if (isDentalOnly(row.DentalOnlyPlan ?? "")) continue;

    const serviceAreaId = (row.ServiceAreaId ?? row.service_area_id ?? "").trim();
    const serviceAreaName = (row.ServiceAreaName ?? row.service_area_name ?? "").trim();
    const marketCoverage = (row.MarketCoverage ?? row.market_coverage ?? "").trim();
    const coverEntireState = (row.CoverEntireState ?? row.cover_entire_state ?? "").trim();
    const rowId = `${hiosIssuerId}-${state}-${serviceAreaId || marketCoverage}`;

    const key = hiosIssuerId;
    const existing = issuers.get(key);
    if (!existing) {
      issuers.set(key, {
        hiosIssuerId,
        issuerLegalName: issuerNameFromServiceArea(serviceAreaName, hiosIssuerId),
        states: new Set([state]),
        serviceAreaIds: serviceAreaId ? new Set([serviceAreaId]) : new Set(),
        serviceAreaNames: serviceAreaName ? new Set([serviceAreaName]) : new Set(),
        marketCoverages: marketCoverage ? new Set([marketCoverage]) : new Set(),
        coverEntireState: coverEntireState ? new Set([coverEntireState]) : new Set(),
        datasetRowIds: new Set([rowId]),
      });
      continue;
    }

    existing.states.add(state);
    if (serviceAreaId) existing.serviceAreaIds.add(serviceAreaId);
    if (serviceAreaName) {
      existing.serviceAreaNames.add(serviceAreaName);
      const candidateName = issuerNameFromServiceArea(serviceAreaName, hiosIssuerId);
      if (candidateName.length > existing.issuerLegalName.length) {
        existing.issuerLegalName = candidateName;
      }
    }
    if (marketCoverage) existing.marketCoverages.add(marketCoverage);
    if (coverEntireState) existing.coverEntireState.add(coverEntireState);
    existing.datasetRowIds.add(rowId);
  }

  const records: Record<string, string>[] = [];
  for (const issuer of issuers.values()) {
    for (const state of issuer.states) {
      records.push({
        hios_issuer_id: issuer.hiosIssuerId,
        hios_id: issuer.hiosIssuerId,
        issuer_legal_name: issuer.issuerLegalName,
        state,
        marketplace: marketplaceForState(state),
        naic_id: "",
        website: "",
        parent_organization: "",
        service_area_id: [...issuer.serviceAreaIds].join("|"),
        service_area_name: [...issuer.serviceAreaNames].join("|"),
        market_coverage: [...issuer.marketCoverages].join("|"),
        cover_entire_state: [...issuer.coverEntireState].join("|"),
        source_puf: "service_area",
        dataset_row_id: `${issuer.hiosIssuerId}-${state}-service-area`,
      });
    }
  }

  return records;
}

/** Count distinct HIOS issuer ids in Service Area PUF (non-dental). */
export function countDistinctServiceAreaIssuers(text: string): number {
  const rows = parseCsvText(text);
  const ids = new Set<string>();
  for (const row of rows) {
    if (isDentalOnly(row.DentalOnlyPlan ?? "")) continue;
    const id = (row.IssuerId ?? "").trim();
    if (id) ids.add(id);
  }
  return ids.size;
}
