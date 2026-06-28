import { sourceStamp } from "@/lib/discovery/connector";
import {
  deriveDomain,
  finalizeOrganization,
  type Organization,
} from "@/lib/discovery/organization";
import type { CatalogRecord } from "@/lib/discovery/catalog/types";
import type { OrganizationRecord } from "@/lib/directories/types";
import { catalogRecordToOrganization } from "@/lib/discovery/catalog/normalize";
import {
  applyManufacturerWarehouseFields,
  buildManufacturerOrganizationFields,
} from "./warehouseMapping";
import {
  MANUFACTURERS_BOOTSTRAP_CONNECTOR_ID,
  MANUFACTURERS_BOOTSTRAP_SOURCE_NAME,
  MANUFACTURERS_FDA_CONNECTOR_ID,
  MANUFACTURERS_SEC_CONNECTOR_ID,
} from "./types";
import type { ManufacturerExternalId, ManufacturerImportCandidate } from "./types";

function externalId(
  idType: ManufacturerExternalId["idType"],
  idValue: string,
): ManufacturerExternalId {
  return { idType, idValue };
}

export function externalIdsForManufacturerSeed(
  row: OrganizationRecord,
): ManufacturerExternalId[] {
  const ids: ManufacturerExternalId[] = [];
  if (row.ticker?.trim()) {
    ids.push(externalId("ticker", row.ticker.trim().toUpperCase()));
  }
  const domain = row.website ? deriveDomain(row.website) : null;
  if (domain) ids.push(externalId("domain", domain));
  return ids;
}

function mapCanonicalOrgType(value: string): Organization["canonicalOrganizationType"] {
  if (value === "pharma-manufacturer" || value === "medical-device") return "manufacturer";
  if (value === "food-beverage-company") return "manufacturer";
  if (value === "manufacturer") return "manufacturer";
  return "other";
}

function finalizeManufacturerOrganization(
  base: Organization,
  externalIds: ManufacturerExternalId[],
  fields: Omit<Parameters<typeof buildManufacturerOrganizationFields>[0], "externalIds">,
): ManufacturerImportCandidate {
  const warehouseFields = buildManufacturerOrganizationFields({
    ...fields,
    externalIds,
  });
  const organization = finalizeOrganization(
    applyManufacturerWarehouseFields(base, warehouseFields),
  );
  return { organization, externalIds };
}

export function candidateFromManufacturerSeed(
  row: OrganizationRecord,
  existing?: Organization,
): ManufacturerImportCandidate {
  const externalIds = externalIdsForManufacturerSeed(row);
  const domain = row.website ? deriveDomain(row.website) : null;
  const aliases = new Set([...row.aliases, ...(existing?.aliases ?? [])]);
  if (row.ticker) aliases.add(row.ticker);
  const states = [...new Set([...row.statesServed, ...(existing?.states ?? [])])];
  const regions = row.regions.length ? row.regions : (existing?.regions ?? []);
  const tags = [...new Set([...(existing?.tags ?? []), ...(row.tags ?? [])])];
  const orgType = row.organizationTypeId ?? row.organizationType;

  const base = finalizeOrganization({
    id: existing?.id ?? row.id,
    canonicalName: existing?.canonicalName ?? row.name,
    aliases: [...aliases],
    website: row.website ?? existing?.website ?? null,
    domain: domain ?? existing?.domain ?? null,
    organizationType: orgType,
    industries: row.industryId ? [row.industryId] : [row.industry],
    sectorId: row.sectorId ?? "manufacturing",
    headquarters: row.headquarters ?? existing?.headquarters ?? null,
    locations: row.headquarters ? [row.headquarters] : [],
    states,
    regions,
    ownership: row.publicCompany ? "public" : (existing?.ownership ?? "private"),
    employeeRange: row.employeeEstimate
      ? String(row.employeeEstimate)
      : (existing?.employeeRange ?? null),
    memberEstimate: existing?.memberEstimate ?? null,
    revenueRange: existing?.revenueRange ?? null,
    description:
      existing?.description ??
      (row.parentOrganization ? `Part of ${row.parentOrganization}` : null),
    sources: [
      sourceStamp(MANUFACTURERS_BOOTSTRAP_CONNECTOR_ID, row.id, [
        "Manufacturer bootstrap seed",
        row.parentOrganization ? `Parent: ${row.parentOrganization}` : null,
      ].filter((value): value is string => Boolean(value)), {
        sourceName: MANUFACTURERS_BOOTSTRAP_SOURCE_NAME,
        sourceUrl: "lib/directories/manufacturers.ts",
        lastUpdated: new Date().toISOString().slice(0, 10),
        confidence: 0.92,
      }),
      ...(existing?.sources.filter(
        (s) => s.connector !== MANUFACTURERS_BOOTSTRAP_CONNECTOR_ID,
      ) ?? []),
    ],
    buyerPack: "manufacturers",
    canonicalOrganizationType: mapCanonicalOrgType(orgType),
    tags,
  });

  return finalizeManufacturerOrganization(base, externalIds, {
    parentOrganization: row.parentOrganization,
    states,
    regions,
    headquarters: row.headquarters ?? existing?.headquarters ?? null,
    organizationType: orgType,
    tags,
  });
}

export function candidateFromSecManufacturerRecord(
  record: CatalogRecord,
  existing?: Organization,
): ManufacturerImportCandidate {
  const catalogOrg = catalogRecordToOrganization("sec", record);
  const externalIds: ManufacturerExternalId[] = [
    externalId("cik", record.sourceId.padStart(10, "0")),
    externalId("cik", String(Number(record.sourceId))),
  ];
  const ticker = record.aliases?.[0]?.trim().toUpperCase();
  if (ticker) externalIds.push(externalId("ticker", ticker));
  const domain = record.website ? deriveDomain(record.website) : catalogOrg.domain;
  if (domain) externalIds.push(externalId("domain", domain));

  const base = finalizeOrganization({
    ...catalogOrg,
    id: existing?.id ?? catalogOrg.id,
    canonicalName: existing?.canonicalName ?? catalogOrg.canonicalName,
    domain: domain ?? existing?.domain ?? null,
    buyerPack: "manufacturers",
    canonicalOrganizationType: "manufacturer",
    sources: [
      sourceStamp(MANUFACTURERS_SEC_CONNECTOR_ID, record.sourceId, [
        "SEC EDGAR manufacturer import",
        ticker ? `Ticker: ${ticker}` : null,
        `CIK: ${record.sourceId}`,
      ].filter((value): value is string => Boolean(value)), {
        sourceName: record.metadata.sourceName,
        sourceUrl: record.metadata.sourceUrl,
        lastUpdated: record.metadata.lastUpdated,
        confidence: record.metadata.confidence,
      }),
      ...(existing?.sources.filter((s) => s.connector !== MANUFACTURERS_SEC_CONNECTOR_ID) ?? []),
    ],
  });

  return finalizeManufacturerOrganization(base, externalIds, {
    states: base.states,
    regions: base.regions,
    headquarters: base.headquarters,
    organizationType: "pharma-manufacturer",
    tags: base.tags,
  });
}

export function candidateFromFdaManufacturerRecord(
  record: CatalogRecord,
  existing?: Organization,
): ManufacturerImportCandidate {
  const catalogOrg = catalogRecordToOrganization("fda", record);
  const externalIds: ManufacturerExternalId[] = [
    externalId("fda_establishment", record.sourceId),
  ];
  const domain = record.website ? deriveDomain(record.website) : catalogOrg.domain;
  if (domain) externalIds.push(externalId("domain", domain));

  const base = finalizeOrganization({
    ...catalogOrg,
    id: existing?.id ?? catalogOrg.id,
    canonicalName: existing?.canonicalName ?? catalogOrg.canonicalName,
    domain: domain ?? existing?.domain ?? null,
    buyerPack: "manufacturers",
    canonicalOrganizationType: "manufacturer",
    sources: [
      sourceStamp(MANUFACTURERS_FDA_CONNECTOR_ID, record.sourceId, [
        "FDA establishment import",
        `Establishment id: ${record.sourceId}`,
      ], {
        sourceName: record.metadata.sourceName,
        sourceUrl: record.metadata.sourceUrl,
        lastUpdated: record.metadata.lastUpdated,
        confidence: record.metadata.confidence,
      }),
      ...(existing?.sources.filter((s) => s.connector !== MANUFACTURERS_FDA_CONNECTOR_ID) ?? []),
    ],
  });

  return finalizeManufacturerOrganization(base, externalIds, {
    states: base.states,
    regions: base.regions,
    headquarters: base.headquarters,
    organizationType: "medical-device",
    tags: base.tags,
  });
}
