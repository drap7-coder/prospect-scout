import type { Organization } from "@/lib/discovery/organization";
import type { OrganizationExternalId } from "@/lib/organization/model";
import type { SectorAttributes } from "@/lib/organization/model";
import {
  normalizePrimaryDomain,
  normalizeWebsiteUrl,
} from "./normalize";
import {
  resolveHighConfidenceDomain,
  domainLookupFromPropagatedDomain,
} from "./resolveDomain";
import type {
  DomainLookupResult,
  OrganizationDomainIntelligence,
} from "./types";
import { DOMAIN_INTELLIGENCE_SECTOR_KEY } from "./types";

export function readDomainIntelligence(
  attrs: SectorAttributes | undefined | null,
): OrganizationDomainIntelligence | null {
  if (!attrs) return null;
  const raw = attrs[DOMAIN_INTELLIGENCE_SECTOR_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as unknown as OrganizationDomainIntelligence;
}

function toDomainIntelligence(
  lookup: DomainLookupResult,
  lastEnrichedAt: string,
): OrganizationDomainIntelligence {
  return {
    website: lookup.website,
    domain: lookup.domain,
    source: lookup.source,
    confidence: lookup.confidence,
    confidenceLabel: lookup.confidenceLabel,
    matchMethod: lookup.matchMethod,
    lastEnrichedAt,
  };
}

function syncDomainExternalId(
  externalIds: OrganizationExternalId[],
  domain: string,
): OrganizationExternalId[] {
  const out = [...externalIds];
  const exists = out.some(
    (ext) => ext.idType === "domain" && ext.idValue.toLowerCase() === domain.toLowerCase(),
  );
  if (!exists) out.push({ idType: "domain", idValue: domain });
  return out;
}

/** Apply high-confidence domain lookup to a single organization. */
export function enrichOrganizationDomain(
  org: Organization,
  externalIds?: OrganizationExternalId[],
  opts: { force?: boolean } = {},
): { organization: Organization; applied: boolean; lookup: DomainLookupResult | null } {
  const lastEnrichedAt = new Date().toISOString();
  const existing = readDomainIntelligence(org.sectorAttributes);

  if (
    !opts.force &&
    org.domain &&
    org.website &&
    existing?.confidenceLabel === "high"
  ) {
    return { organization: org, applied: false, lookup: null };
  }

  const lookup = resolveHighConfidenceDomain({
    organization: org,
    externalIds: externalIds ?? org.externalIds,
  });

  if (!lookup) {
    const website = normalizeWebsiteUrl(org.website);
    const domain = normalizePrimaryDomain({ website, domain: org.domain });
    if (!website && !domain) return { organization: org, applied: false, lookup: null };
    return {
      organization: {
        ...org,
        website: website ?? org.website,
        domain: domain ?? org.domain,
      },
      applied: Boolean(website || domain),
      lookup: null,
    };
  }

  const intelligence = toDomainIntelligence(lookup, lastEnrichedAt);
  const mergedExternalIds = syncDomainExternalId(org.externalIds ?? [], lookup.domain);

  return {
    organization: {
      ...org,
      website: lookup.website,
      domain: lookup.domain,
      externalIds: mergedExternalIds,
      sectorAttributes: {
        ...(org.sectorAttributes ?? {}),
        [DOMAIN_INTELLIGENCE_SECTOR_KEY]: intelligence as unknown as SectorAttributes[string],
      },
    },
    applied: true,
    lookup,
  };
}

export { domainLookupFromPropagatedDomain };
