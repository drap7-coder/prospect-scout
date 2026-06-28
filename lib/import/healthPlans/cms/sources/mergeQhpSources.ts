import { uniqueSorted } from "../parseCsv";
import { marketplaceForState } from "../stateExchange";

export interface QhpImportRecord {
  hios_issuer_id: string;
  hios_id: string;
  issuer_legal_name: string;
  state: string;
  marketplace: string;
  naic_id: string;
  website: string;
  parent_organization: string;
  service_area_id: string;
  service_area_name: string;
  market_coverage: string;
  cover_entire_state: string;
  source_puf: string;
  dataset_row_id: string;
}

function emptyRecord(hiosIssuerId: string, state: string): QhpImportRecord {
  return {
    hios_issuer_id: hiosIssuerId,
    hios_id: hiosIssuerId,
    issuer_legal_name: "",
    state,
    marketplace: marketplaceForState(state),
    naic_id: "",
    website: "",
    parent_organization: "",
    service_area_id: "",
    service_area_name: "",
    market_coverage: "",
    cover_entire_state: "",
    source_puf: "",
    dataset_row_id: `${hiosIssuerId}-${state}`,
  };
}

function mergeField(current: string, incoming: string): string {
  if (!incoming.trim()) return current;
  if (!current.trim()) return incoming.trim();
  const parts = uniqueSorted([...current.split("|"), ...incoming.split("|")]);
  return parts.join("|");
}

/** Merge Plan Attributes and Service Area PUF records by HIOS issuer id + state. */
export function mergeQhpSourceRecords(
  planAttributes: Record<string, string>[],
  serviceArea: Record<string, string>[],
): QhpImportRecord[] {
  const byKey = new Map<string, QhpImportRecord>();

  for (const row of planAttributes) {
    const hiosIssuerId = (row.hios_issuer_id ?? row.hios_id ?? "").trim().slice(0, 5);
    const state = (row.state ?? "").trim().toUpperCase();
    if (!hiosIssuerId || !state) continue;

    const key = `${hiosIssuerId}::${state}`;
    byKey.set(key, {
      hios_issuer_id: hiosIssuerId,
      hios_id: hiosIssuerId,
      issuer_legal_name: (row.issuer_legal_name ?? "").trim(),
      state,
      marketplace: (row.marketplace ?? marketplaceForState(state)).trim(),
      naic_id: (row.naic_id ?? "").trim(),
      website: (row.website ?? "").trim(),
      parent_organization: (row.parent_organization ?? "").trim(),
      service_area_id: (row.service_area_id ?? "").trim(),
      service_area_name: (row.service_area_name ?? "").trim(),
      market_coverage: (row.market_coverage ?? "").trim(),
      cover_entire_state: (row.cover_entire_state ?? "").trim(),
      source_puf: mergeField("", row.source_puf ?? "plan_attributes"),
      dataset_row_id: (row.dataset_row_id ?? key).trim(),
    });
  }

  for (const row of serviceArea) {
    const hiosIssuerId = (row.hios_issuer_id ?? row.hios_id ?? "").trim().slice(0, 5);
    const state = (row.state ?? "").trim().toUpperCase();
    if (!hiosIssuerId || !state) continue;

    const key = `${hiosIssuerId}::${state}`;
    const existing = byKey.get(key) ?? emptyRecord(hiosIssuerId, state);

    byKey.set(key, {
      ...existing,
      issuer_legal_name:
        existing.issuer_legal_name ||
        (row.issuer_legal_name ?? "").trim() ||
        `HIOS Issuer ${hiosIssuerId}`,
      marketplace:
        existing.marketplace || (row.marketplace ?? marketplaceForState(state)),
      service_area_id: mergeField(existing.service_area_id, row.service_area_id ?? ""),
      service_area_name: mergeField(existing.service_area_name, row.service_area_name ?? ""),
      market_coverage: mergeField(existing.market_coverage, row.market_coverage ?? ""),
      cover_entire_state: mergeField(
        existing.cover_entire_state,
        row.cover_entire_state ?? "",
      ),
      source_puf: mergeField(existing.source_puf, row.source_puf ?? "service_area"),
      dataset_row_id: mergeField(existing.dataset_row_id, row.dataset_row_id ?? key),
    });
  }

  return [...byKey.values()];
}

/** Distinct HIOS issuer ids present only in Service Area (net-new vs plan attributes). */
export function countNetNewServiceAreaIssuers(
  planAttributes: Record<string, string>[],
  serviceArea: Record<string, string>[],
): number {
  const planIds = new Set(
    planAttributes
      .map((row) => (row.hios_issuer_id ?? row.hios_id ?? "").trim().slice(0, 5))
      .filter(Boolean),
  );
  const serviceIds = new Set(
    serviceArea
      .map((row) => (row.hios_issuer_id ?? row.hios_id ?? "").trim().slice(0, 5))
      .filter(Boolean),
  );
  let netNew = 0;
  for (const id of serviceIds) {
    if (!planIds.has(id)) netNew += 1;
  }
  return netNew;
}
