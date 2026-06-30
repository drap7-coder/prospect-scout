import { deriveDomain } from "@/lib/discovery/organization";
import type { Organization } from "@/lib/discovery/organization";
import type { SearchIntent } from "@/lib/discovery/intent";
import { inferStateFromQuery } from "@/lib/directories/search";
import {
  type OrganizationClassification,
  type OrganizationExternalId,
  type OrganizationGeography,
  type SectorAttributes,
  classificationKey,
  EMPTY_GEOGRAPHY,
  geographyFromLegacyFields,
} from "@/lib/organization/model";
import { enrichHealthPlanLobClassifications } from "@/lib/import/healthPlans/warehouseMapping";
import { readGroupCommercialEvidence } from "@/lib/import/healthPlans/groupCommercial/storage";

export type { OrganizationClassification, OrganizationExternalId, OrganizationGeography, SectorAttributes };

/** Normalize legacy + new organization fields into the generic warehouse shape. */
export function normalizeWarehouseOrganization(org: Organization): Organization {
  const geography = geographyFromLegacyFields(org);
  const states = geography.states.length > 0 ? geography.states : (org.states ?? []);
  const regions = geography.regions.length > 0 ? geography.regions : (org.regions ?? []);

  const classifications = org.classifications?.length
    ? dedupeClassifications(
        org.buyerPack === "health-plans"
          ? enrichHealthPlanLobClassifications(
              org.classifications,
              org.tags ?? [],
              readGroupCommercialEvidence(org.sectorAttributes),
            )
          : org.classifications,
      )
    : legacyClassificationsFromHealthPlanType(org);

  const parentDisplayName =
    org.parentDisplayName ??
    parseParentFromDescription(org.description) ??
    null;

  const externalIds = org.externalIds?.length ? dedupeExternalIds(org.externalIds) : [];

  const sectorAttributes: SectorAttributes = { ...(org.sectorAttributes ?? {}) };

  const website = org.website?.trim() || null;
  const domain = org.domain?.trim().toLowerCase() ?? deriveDomain(website);

  return {
    ...org,
    website,
    domain,
    displayName: org.displayName ?? org.canonicalName,
    legalName: org.legalName ?? org.canonicalName,
    parentId: org.parentId ?? null,
    parentDisplayName,
    geography: {
      ...geography,
      states,
      regions,
      headquarters: geography.headquarters ?? org.headquarters ?? null,
    },
    states,
    regions,
    classifications,
    externalIds,
    sectorAttributes,
    healthPlanType: syncLegacyHealthPlanType(classifications, org.healthPlanType),
  };
}

function legacyClassificationsFromHealthPlanType(org: Organization): OrganizationClassification[] {
  if (!org.healthPlanType) return [];
  return [{ namespace: "health-plans", id: org.healthPlanType }];
}

function syncLegacyHealthPlanType(
  classifications: OrganizationClassification[],
  existing?: Organization["healthPlanType"],
): Organization["healthPlanType"] | undefined {
  const hp = classifications.find((c) => c.namespace === "health-plans");
  if (!hp) return existing;
  if (hp.id === "part_d") return "medicare_advantage";
  if (isHealthPlanTypeId(hp.id)) return hp.id;
  return existing;
}

function isHealthPlanTypeId(value: string): value is NonNullable<Organization["healthPlanType"]> {
  return ["commercial", "aca_marketplace", "medicare_advantage", "medicaid_managed_care"].includes(
    value,
  );
}

function parseParentFromDescription(description: string | null | undefined): string | null {
  if (!description?.startsWith("Part of ")) return null;
  return description.slice("Part of ".length).trim() || null;
}

export function dedupeClassifications(
  items: OrganizationClassification[],
): OrganizationClassification[] {
  const seen = new Set<string>();
  const out: OrganizationClassification[] = [];
  for (const item of items) {
    const key = classificationKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function dedupeExternalIds(items: OrganizationExternalId[]): OrganizationExternalId[] {
  const seen = new Set<string>();
  const out: OrganizationExternalId[] = [];
  for (const item of items) {
    const key = `${item.idType}:${item.idValue.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function mergeGeography(a: OrganizationGeography, b: OrganizationGeography): OrganizationGeography {
  return {
    states: [...new Set([...a.states, ...b.states])],
    regions: [...new Set([...a.regions, ...b.regions])],
    headquarters: a.headquarters ?? b.headquarters,
    national: a.national || b.national,
  };
}

export function organizationGeography(org: Organization): OrganizationGeography {
  return geographyFromLegacyFields(normalizeWarehouseOrganization(org));
}

/** True when a state-scoped query should include this organization. */
export function geographyMatchesState(org: Organization, state: string): boolean {
  const geo = organizationGeography(org);
  return geo.states.includes(state);
}

/**
 * State intent filter: when the query names a state, only orgs listing that state match.
 * National-only records (empty states, national=true) are excluded from state-scoped queries.
 */
export function geographyMatchesIntent(org: Organization, intent: SearchIntent): boolean {
  if (!intent.state) return true;
  return geographyMatchesState(org, intent.state);
}

export function classificationMatchesIntent(
  org: Organization,
  intent: SearchIntent,
): boolean {
  const filter = intent.classificationFilter;
  if (!filter) return true;

  const normalized = normalizeWarehouseOrganization(org);
  const orgClasses = normalized.classifications ?? [];
  if (orgClasses.length === 0) return false;

  return orgClasses.some(
    (c) =>
      c.namespace === filter.namespace &&
      filter.ids.includes(c.id),
  );
}

/** Haystack for parent / hierarchy text search. */
export function hierarchySearchHaystack(org: Organization): string {
  const normalized = normalizeWarehouseOrganization(org);
  return [
    normalized.parentDisplayName ?? "",
    normalized.parentId ?? "",
    normalized.description ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function organizationSearchHaystack(org: Organization): string {
  const normalized = normalizeWarehouseOrganization(org);
  return [
    normalized.displayName ?? normalized.canonicalName,
    normalized.legalName ?? "",
    ...normalized.aliases,
    normalized.description ?? "",
    hierarchySearchHaystack(normalized),
  ]
    .join(" ")
    .toLowerCase();
}

/** Significant query terms excluding generic industry filler when a structured filter is present. */
export function significantQueryTerms(intent: SearchIntent): string[] {
  const raw = intent.keywords.filter((kw) => kw.length >= 3);
  let terms = raw;
  if (intent.organizationTypeId || intent.classificationFilter || intent.state) {
    terms = raw.filter((kw) => !GENERIC_ORG_QUERY_STOP.has(kw));
  }
  if (intent.classificationFilter) {
    terms = terms.filter((kw) => !CLASSIFICATION_QUERY_STOP.has(kw));
  }
  if (intent.state) {
    terms = terms.filter((kw) => !keywordMatchesResolvedState(kw, intent.state!));
  }
  return terms;
}

function keywordMatchesResolvedState(keyword: string, state: string): boolean {
  if (keyword.toUpperCase() === state) return true;
  return inferStateFromQuery(`in ${keyword}`) === state;
}

const GENERIC_ORG_QUERY_STOP = new Set([
  "health",
  "plan",
  "plans",
  "insurer",
  "insurers",
  "payer",
  "payers",
  "medicare",
  "medicaid",
  "mco",
  "manufacturer",
  "manufacturers",
  "hospital",
  "hospitals",
]);

/** Market-segment tokens absorbed by classificationFilter — not required in org text. */
const CLASSIFICATION_QUERY_STOP = new Set([
  "advantage",
  "marketplace",
  "exchange",
  "obamacare",
  "aca",
  "managed",
  "qhp",
  "qhps",
  "part",
]);

export function organizationMatchesSignificantQueryText(
  org: Organization,
  intent: SearchIntent,
): boolean {
  const terms = significantQueryTerms(intent);
  if (terms.length === 0) return true;
  const hay = organizationSearchHaystack(org);
  return terms.every((term) => hay.includes(term.toLowerCase()));
}

export { EMPTY_GEOGRAPHY };
