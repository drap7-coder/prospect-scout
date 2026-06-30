/**
 * Health-plans connector: maps CMS source fields into generic warehouse organization fields.
 * All health-plan semantics live here — not in the warehouse core.
 */

import type { Organization } from "@/lib/discovery/organization";
import type {
  OrganizationClassification,
  OrganizationExternalId,
  OrganizationGeography,
  SectorAttributes,
} from "@/lib/organization/model";
import { mergeClassificationRecords } from "@/lib/organization/intelligence";
import type { HealthPlanExternalId } from "./cms/types";

export const HEALTH_PLANS_CLASSIFICATION_NAMESPACE = "health-plans";

export type HealthPlanMarketSegmentId =
  | "medicare_advantage"
  | "aca_marketplace"
  | "medicaid_managed_care"
  | "commercial"
  | "part_d";

export function healthPlanClassification(
  id: HealthPlanMarketSegmentId,
  label?: string,
): OrganizationClassification {
  return { namespace: HEALTH_PLANS_CLASSIFICATION_NAMESPACE, id, label };
}

export function externalIdsFromHealthPlanImport(
  ids: HealthPlanExternalId[],
): OrganizationExternalId[] {
  return ids.map((id) => ({
    idType: id.idType,
    idValue: id.idValue,
    source: "health-plans",
  }));
}

export interface HealthPlanOrganizationFields {
  parentDisplayName?: string | null;
  geography: OrganizationGeography;
  classifications: OrganizationClassification[];
  sectorAttributes: SectorAttributes;
  externalIds: OrganizationExternalId[];
}

export function buildHealthPlanOrganizationFields(input: {
  parentOrganization?: string | null;
  states: string[];
  regions?: string[];
  headquarters?: string | null;
  marketSegment?: HealthPlanMarketSegmentId;
  marketSegmentLabel?: string;
  classifications?: OrganizationClassification[];
  externalIds?: HealthPlanExternalId[];
  national?: boolean;
  tags?: string[];
}): HealthPlanOrganizationFields {
  const parentDisplayName = input.parentOrganization?.trim() || null;
  const states = [...new Set(input.states)];
  const national = input.national ?? states.length === 0;

  const classifications =
    input.classifications?.length
      ? input.classifications
      : input.marketSegment
        ? [healthPlanClassification(input.marketSegment, input.marketSegmentLabel)]
        : [];

  return {
    parentDisplayName,
    geography: {
      states,
      regions: input.regions ?? [],
      headquarters: input.headquarters ?? null,
      national,
    },
    classifications,
    sectorAttributes: {
      linesOfBusiness: classifications
        .filter((c) => c.namespace === HEALTH_PLANS_CLASSIFICATION_NAMESPACE)
        .map((c) => c.id),
      ...(input.tags?.length ? { sourceTags: input.tags } : {}),
    },
    externalIds: externalIdsFromHealthPlanImport(input.externalIds ?? []),
  };
}

/** Apply connector-specific fields onto a partial Organization before finalize. */
export function applyHealthPlanWarehouseFields(
  org: Organization,
  fields: HealthPlanOrganizationFields,
): Organization {
  const description = fields.parentDisplayName
    ? `Part of ${fields.parentDisplayName}`
    : org.description;

  const healthPlanType = fields.classifications.find(
    (c) => c.namespace === HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
  )?.id as Organization["healthPlanType"] | undefined;

  return {
    ...org,
    description,
    parentDisplayName: fields.parentDisplayName,
    geography: fields.geography,
    states: fields.geography.states,
    regions: fields.geography.regions,
    headquarters: fields.geography.headquarters ?? org.headquarters,
    classifications: enrichHealthPlanLobClassifications(fields.classifications, org.tags ?? []),
    sectorAttributes: { ...(org.sectorAttributes ?? {}), ...fields.sectorAttributes },
    externalIds: fields.externalIds,
    healthPlanType,
  };
}

const GOVERNMENT_MARKET_LOB_IDS = new Set([
  "aca_marketplace",
  "medicaid_managed_care",
  "chip",
]);

/**
 * Whether a `commercial` connector tag should become a Commercial LOB classification.
 * ACA/exchange and Medicaid-only issuers are not group commercial by default.
 */
export function shouldPromoteCommercialFromTag(
  lobIds: Set<string>,
  tags: string[],
): boolean {
  if (!tags.includes("commercial")) return false;

  const hasExchange = tags.includes("exchange");
  const hasAca = lobIds.has("aca_marketplace");
  const hasMedicaid = lobIds.has("medicaid_managed_care");
  const hasMa = lobIds.has("medicare_advantage") || lobIds.has("part_d");
  const onlyGovernmentMarkets =
    lobIds.size > 0 && [...lobIds].every((id) => GOVERNMENT_MARKET_LOB_IDS.has(id));

  if (hasExchange && hasAca && !hasMa) return false;
  if (hasAca && !hasMa && !hasMedicaid) return false;
  if (onlyGovernmentMarkets && hasMedicaid && !hasMa) return false;

  return true;
}

/**
 * Promote connector tags into LOB classifications when CMS rows omit explicit segments.
 * Keeps warehouse filtering aligned with catalog LOB nodes (e.g. commercial-plans).
 */
export function enrichHealthPlanLobClassifications(
  classifications: OrganizationClassification[],
  tags: string[] = [],
): OrganizationClassification[] {
  const records = [...classifications];
  const lobIds = new Set(
    records
      .filter((c) => c.namespace === HEALTH_PLANS_CLASSIFICATION_NAMESPACE)
      .map((c) => c.id),
  );

  if (
    !lobIds.has("commercial") &&
    shouldPromoteCommercialFromTag(lobIds, tags)
  ) {
    records.push(healthPlanClassification("commercial", "Commercial"));
  }

  return mergeClassificationRecords(records);
}

/** Infer health-plans classification filter from natural-language query (connector layer). */
export function inferHealthPlanClassificationFromQuery(
  query: string,
): OrganizationClassification | null {
  const hay = query.toLowerCase();

  if (
    /\baca\b|\bobamacare\b|\bexchange plans?\b|\bmarketplace plans?\b|\bqhps?\b|\bqhp issuers?\b/.test(
      hay,
    )
  ) {
    return healthPlanClassification("aca_marketplace", "ACA Marketplace");
  }
  if (/\bmedicare advantage\b|\bma plans?\b|\bmapd\b/.test(hay)) {
    return healthPlanClassification("medicare_advantage", "Medicare Advantage");
  }
  if (/\bpart d\b|\bpart-d\b|\bpdp\b/.test(hay)) {
    return healthPlanClassification("part_d", "Part D");
  }
  if (/\bmedicaid managed care\b|\bmedicaid mcos?\b|\bmanaged medicaid\b/.test(hay)) {
    return healthPlanClassification("medicaid_managed_care", "Medicaid Managed Care");
  }
  if (/\bmedicaid plans?\b/.test(hay) && !/\bmedicare\b/.test(hay)) {
    return healthPlanClassification("medicaid_managed_care", "Medicaid");
  }

  return null;
}
