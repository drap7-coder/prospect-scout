import type { CmsQhpRow } from "./types";
import { normalizeState, parseCsvText, readCsvFile, uniqueSorted } from "./parseCsv";
import { marketplaceForState } from "./stateExchange";

function parseMarketplace(
  value: string,
  state: string,
): CmsQhpRow["marketplace"] {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().includes("state")) return "State-Based";
  if (trimmed.toLowerCase().includes("healthcare.gov")) return "HealthCare.gov";
  return marketplaceForState(state);
}

function splitPipe(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return uniqueSorted(value.split("|").map((part) => part.trim()).filter(Boolean));
}

export function parseCmsQhpRows(records: Record<string, string>[]): CmsQhpRow[] {
  const rows: CmsQhpRow[] = [];
  for (const record of records) {
    const hiosIssuerId = (
      record.hios_issuer_id ??
      record.hios_id ??
      ""
    )
      .trim()
      .slice(0, 5);
    const hiosId = (record.hios_id ?? hiosIssuerId).trim().slice(0, 5);
    const issuerLegalName = (record.issuer_legal_name ?? "").trim();
    const state = normalizeState(record.state ?? "");
    if (!hiosIssuerId || !issuerLegalName || !state) continue;

    rows.push({
      hiosIssuerId,
      hiosId,
      issuerLegalName,
      state,
      marketplace: parseMarketplace(record.marketplace ?? "", state),
      naicId: record.naic_id?.trim() || undefined,
      website: record.website?.trim() || undefined,
      parentOrganization: record.parent_organization?.trim() || undefined,
      serviceAreaIds: splitPipe(record.service_area_id),
      serviceAreaNames: splitPipe(record.service_area_name),
      marketCoverages: splitPipe(record.market_coverage),
      coverEntireState: splitPipe(record.cover_entire_state),
      sourcePufs: splitPipe(record.source_puf),
      datasetRowId: (record.dataset_row_id ?? `${hiosIssuerId}-${state}`).trim(),
    });
  }
  return rows;
}

/** Group QHP rows by verified HIOS issuer id (multi-state issuers become one org). */
export function aggregateCmsQhpIssuers(rows: CmsQhpRow[]): {
  id: string;
  hiosIssuerId: string;
  issuerLegalName: string;
  parentOrganization?: string;
  states: string[];
  hiosIds: string[];
  marketplace: CmsQhpRow["marketplace"];
  marketplaces: CmsQhpRow["marketplace"][];
  naicId?: string;
  website?: string;
  serviceAreaIds: string[];
  serviceAreaNames: string[];
  marketCoverages: string[];
  sourcePufs: string[];
  datasetRowIds: string[];
}[] {
  const grouped = new Map<
    string,
    {
      id: string;
      hiosIssuerId: string;
      issuerLegalName: string;
      parentOrganization?: string;
      states: string[];
      hiosIds: string[];
      marketplace: CmsQhpRow["marketplace"];
      marketplaces: Set<CmsQhpRow["marketplace"]>;
      naicId?: string;
      website?: string;
      serviceAreaIds: Set<string>;
      serviceAreaNames: Set<string>;
      marketCoverages: Set<string>;
      sourcePufs: Set<string>;
      datasetRowIds: string[];
    }
  >();

  for (const row of rows) {
    const key = row.hiosIssuerId;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        id: `cms-qhp-${row.hiosIssuerId}`,
        hiosIssuerId: row.hiosIssuerId,
        issuerLegalName: row.issuerLegalName,
        parentOrganization: row.parentOrganization,
        states: [row.state],
        hiosIds: [row.hiosId],
        marketplace: row.marketplace,
        marketplaces: new Set([row.marketplace]),
        naicId: row.naicId,
        website: row.website,
        serviceAreaIds: new Set(row.serviceAreaIds),
        serviceAreaNames: new Set(row.serviceAreaNames),
        marketCoverages: new Set(row.marketCoverages),
        sourcePufs: new Set(row.sourcePufs),
        datasetRowIds: [row.datasetRowId],
      });
      continue;
    }

    existing.states.push(row.state);
    existing.hiosIds.push(row.hiosId);
    existing.datasetRowIds.push(row.datasetRowId);
    existing.states = uniqueSorted(existing.states);
    existing.hiosIds = uniqueSorted(existing.hiosIds);
    existing.datasetRowIds = uniqueSorted(existing.datasetRowIds);
    existing.marketplaces.add(row.marketplace);
    for (const id of row.serviceAreaIds) existing.serviceAreaIds.add(id);
    for (const name of row.serviceAreaNames) existing.serviceAreaNames.add(name);
    for (const coverage of row.marketCoverages) existing.marketCoverages.add(coverage);
    for (const puf of row.sourcePufs) existing.sourcePufs.add(puf);
    if (!existing.naicId && row.naicId) existing.naicId = row.naicId;
    if (!existing.website && row.website) existing.website = row.website;
    if (!existing.parentOrganization && row.parentOrganization) {
      existing.parentOrganization = row.parentOrganization;
    }
    if (row.issuerLegalName.length > existing.issuerLegalName.length) {
      existing.issuerLegalName = row.issuerLegalName;
    }
    if (existing.marketplaces.size === 1) {
      existing.marketplace = [...existing.marketplaces][0]!;
    } else {
      existing.marketplace = "HealthCare.gov";
    }
  }

  return [...grouped.values()].map((entry) => ({
    id: entry.id,
    hiosIssuerId: entry.hiosIssuerId,
    issuerLegalName: entry.issuerLegalName,
    parentOrganization: entry.parentOrganization,
    states: entry.states,
    hiosIds: entry.hiosIds,
    marketplace: entry.marketplace,
    marketplaces: [...entry.marketplaces].sort(),
    naicId: entry.naicId,
    website: entry.website,
    serviceAreaIds: uniqueSorted([...entry.serviceAreaIds]),
    serviceAreaNames: uniqueSorted([...entry.serviceAreaNames]),
    marketCoverages: uniqueSorted([...entry.marketCoverages]),
    sourcePufs: uniqueSorted([...entry.sourcePufs]),
    datasetRowIds: entry.datasetRowIds,
  }));
}

export function parseCmsQhpCsvFile(path: string) {
  return aggregateCmsQhpIssuers(parseCmsQhpRows(readCsvFile(path)));
}

export function parseCmsQhpCsvText(text: string) {
  return aggregateCmsQhpIssuers(parseCmsQhpRows(parseCsvText(text)));
}
