/**
 * Manufacturers connector: maps source fields into generic warehouse organization fields.
 */

import type { Organization } from "@/lib/discovery/organization";
import type {
  OrganizationClassification,
  OrganizationExternalId,
  OrganizationGeography,
  SectorAttributes,
} from "@/lib/organization/model";
import type { ManufacturerExternalId } from "./types";

export const MANUFACTURERS_CLASSIFICATION_NAMESPACE = "manufacturers";

export type ManufacturerMarketSegmentId =
  | "pharma"
  | "device"
  | "biotech"
  | "generic"
  | "food_beverage";

export function manufacturerClassification(
  id: ManufacturerMarketSegmentId,
  label?: string,
): OrganizationClassification {
  return { namespace: MANUFACTURERS_CLASSIFICATION_NAMESPACE, id, label };
}

export function externalIdsFromManufacturerImport(
  ids: ManufacturerExternalId[],
): OrganizationExternalId[] {
  return ids.map((id) => ({
    idType: id.idType,
    idValue: id.idValue,
    source: "manufacturers",
  }));
}

export interface ManufacturerOrganizationFields {
  parentDisplayName?: string | null;
  geography: OrganizationGeography;
  classifications: OrganizationClassification[];
  sectorAttributes: SectorAttributes;
  externalIds: OrganizationExternalId[];
}

function segmentFromOrgType(orgType: string): ManufacturerMarketSegmentId {
  if (orgType === "medical-device") return "device";
  if (orgType === "food-beverage-company") return "food_beverage";
  if (orgType === "pharma-manufacturer") return "pharma";
  return "pharma";
}

export function buildManufacturerOrganizationFields(input: {
  parentOrganization?: string | null;
  states: string[];
  regions?: string[];
  headquarters?: string | null;
  organizationType?: string;
  marketSegment?: ManufacturerMarketSegmentId;
  marketSegmentLabel?: string;
  externalIds?: ManufacturerExternalId[];
  national?: boolean;
  tags?: string[];
}): ManufacturerOrganizationFields {
  const parentDisplayName = input.parentOrganization?.trim() || null;
  const states = [...new Set(input.states)];
  const national = input.national ?? states.length === 0;
  const marketSegment =
    input.marketSegment ?? segmentFromOrgType(input.organizationType ?? "pharma-manufacturer");

  return {
    parentDisplayName,
    geography: {
      states,
      regions: input.regions ?? [],
      headquarters: input.headquarters ?? null,
      national,
    },
    classifications: [
      manufacturerClassification(marketSegment, input.marketSegmentLabel),
    ],
    sectorAttributes: {
      marketSegment,
      ...(input.tags?.length ? { sourceTags: input.tags } : {}),
    },
    externalIds: externalIdsFromManufacturerImport(input.externalIds ?? []),
  };
}

export function applyManufacturerWarehouseFields(
  org: Organization,
  fields: ManufacturerOrganizationFields,
): Organization {
  const description = fields.parentDisplayName
    ? `Part of ${fields.parentDisplayName}`
    : org.description;

  return {
    ...org,
    description,
    parentDisplayName: fields.parentDisplayName,
    geography: fields.geography,
    states: fields.geography.states,
    regions: fields.geography.regions,
    headquarters: fields.geography.headquarters ?? org.headquarters,
    classifications: fields.classifications,
    sectorAttributes: { ...(org.sectorAttributes ?? {}), ...fields.sectorAttributes },
    externalIds: fields.externalIds,
  };
}
