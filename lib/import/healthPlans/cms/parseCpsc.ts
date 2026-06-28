import { normalizeOrganizationName } from "@/lib/providers/cms";
import type { CmsCpscOrganization, CmsCpscRow } from "./types";
import {
  normalizeContractId,
  normalizeState,
  parseCsvText,
  parseOptionalNumber,
  readCsvFile,
  slugify,
  uniqueSorted,
} from "./parseCsv";

function parseContractType(value: string): CmsCpscRow["contractType"] {
  const normalized = value.trim().toUpperCase();
  if (normalized === "MA") return "MA";
  if (normalized === "MA-PD" || normalized === "MAPD") return "MA-PD";
  if (normalized === "PDP" || normalized === "PART D") return "PDP";
  return "OTHER";
}

export function parseCmsCpscRows(records: Record<string, string>[]): CmsCpscRow[] {
  return records.map((record) => ({
    contractId: normalizeContractId(record.contract_id ?? ""),
    legalEntityName: (record.legal_entity_name ?? "").trim(),
    marketingName: (record.marketing_name ?? record.legal_entity_name ?? "").trim(),
    parentOrganization: (record.parent_organization ?? "").trim(),
    contractType: parseContractType(record.contract_type ?? ""),
    state: normalizeState(record.state_service ?? record.state ?? ""),
    starRating: parseOptionalNumber(record.star_rating),
    naicId: record.naic_id?.trim() || undefined,
    datasetRowId: (record.dataset_row_id ?? record.contract_id ?? "").trim(),
  }));
}

function organizationKey(row: CmsCpscRow): string {
  const parent = normalizeOrganizationName(row.parentOrganization || row.marketingName);
  const legal = normalizeOrganizationName(row.legalEntityName || row.marketingName);
  return `${parent}::${legal}`;
}

function buildAliases(org: Omit<CmsCpscOrganization, "aliases" | "tags">): string[] {
  const aliases = new Set<string>();
  if (org.marketingName && org.marketingName !== org.legalEntityName) {
    aliases.add(org.marketingName);
  }
  if (org.parentOrganization && org.parentOrganization !== org.legalEntityName) {
    aliases.add(org.parentOrganization);
  }
  return [...aliases];
}

function buildTags(contractTypes: Set<CmsCpscRow["contractType"]>): string[] {
  const tags = new Set<string>(["medicare"]);
  if (contractTypes.has("MA") || contractTypes.has("MA-PD")) {
    tags.add("medicare-advantage");
  }
  if (contractTypes.has("PDP") || contractTypes.has("MA-PD")) {
    tags.add("part-d");
  }
  return [...tags];
}

/** Group raw CPSC contract rows into organizations. */
export function aggregateCmsCpscOrganizations(rows: CmsCpscRow[]): CmsCpscOrganization[] {
  const grouped = new Map<string, CmsCpscOrganization>();

  for (const row of rows) {
    if (!row.contractId || !row.legalEntityName) continue;
    const key = organizationKey(row);
    const existing = grouped.get(key);
    if (!existing) {
      const contractTypes = new Set<CmsCpscRow["contractType"]>([row.contractType]);
      const base = {
        id: `cms-cpsc-${slugify(row.parentOrganization || row.marketingName)}`,
        legalEntityName: row.legalEntityName,
        marketingName: row.marketingName || row.legalEntityName,
        parentOrganization: row.parentOrganization || row.marketingName,
        contractIds: [row.contractId],
        contractTypes,
        states: row.state ? [row.state] : [],
        starRating: row.starRating,
        naicId: row.naicId,
        datasetRowIds: row.datasetRowId ? [row.datasetRowId] : [],
      };
      grouped.set(key, {
        ...base,
        aliases: buildAliases(base),
        tags: buildTags(contractTypes),
      });
      continue;
    }

    existing.contractIds.push(row.contractId);
    existing.contractTypes.add(row.contractType);
    if (row.state) existing.states.push(row.state);
    if (row.naicId && !existing.naicId) existing.naicId = row.naicId;
    if (row.starRating != null) {
      existing.starRating =
        existing.starRating == null
          ? row.starRating
          : Math.max(existing.starRating, row.starRating);
    }
    if (row.datasetRowId) existing.datasetRowIds.push(row.datasetRowId);
    existing.contractIds = uniqueSorted(existing.contractIds);
    existing.states = uniqueSorted(existing.states);
    existing.datasetRowIds = uniqueSorted(existing.datasetRowIds);
    existing.tags = buildTags(existing.contractTypes);
    existing.aliases = buildAliases(existing);
  }

  return [...grouped.values()];
}

export function parseCmsCpscCsvFile(path: string): CmsCpscOrganization[] {
  const rows = parseCmsCpscRows(readCsvFile(path));
  return aggregateCmsCpscOrganizations(rows);
}

export function parseCmsCpscCsvText(text: string): CmsCpscOrganization[] {
  const rows = parseCmsCpscRows(parseCsvText(text));
  return aggregateCmsCpscOrganizations(rows);
}
