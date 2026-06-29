import type { Organization } from "@/lib/discovery/organization";
import type { OrganizationExternalId } from "@/lib/organization/model";
import {
  confidenceLabelFromScore,
  normalizeOrganizationName,
  normalizePrimaryDomain,
  normalizeWebsiteUrl,
  websiteFromDomain,
} from "./normalize";
import { buildDomainRegistry, type DirectoryDomainRecord } from "./registry";
import type { DomainLookupResult } from "./types";
import { DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD } from "./types";

function orgStates(org: Organization): string[] {
  const states = new Set<string>();
  for (const s of org.geography?.states ?? []) states.add(s.toUpperCase());
  for (const s of org.states ?? []) states.add(s.toUpperCase());
  const hq = org.headquarters ?? org.geography?.headquarters;
  if (hq) {
    const match = hq.match(/\b([A-Z]{2})\b/);
    if (match) states.add(match[1]!);
  }
  return [...states];
}

function disambiguateByState(
  candidates: DirectoryDomainRecord[],
  org: Organization,
): DirectoryDomainRecord | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;
  const states = orgStates(org);
  if (states.length === 0) return null;
  const filtered = candidates.filter((c) =>
    c.states.some((s) => states.includes(s.toUpperCase())),
  );
  if (filtered.length === 1) return filtered[0]!;
  return null;
}

function lookupResult(
  rec: DirectoryDomainRecord,
  matchMethod: string,
  confidence: number,
): DomainLookupResult {
  return {
    website: rec.website,
    domain: rec.domain,
    source: "directory_match",
    confidence,
    confidenceLabel: confidenceLabelFromScore(confidence),
    matchMethod,
  };
}

function lookupExternalIds(
  externalIds: OrganizationExternalId[] | undefined,
  registry: ReturnType<typeof buildDomainRegistry>,
): DomainLookupResult | null {
  if (!externalIds?.length) return null;

  for (const ext of externalIds) {
    if (ext.idType === "cms_contract") {
      const rec = registry.byCmsContract.get(ext.idValue.toUpperCase());
      if (rec) return lookupResult(rec, "cms_contract", 0.98);
    }
    if (ext.idType === "hios") {
      const normalized = ext.idValue.trim().toUpperCase();
      const rec =
        registry.byHios.get(normalized.slice(0, 5)) ??
        registry.byCmsContract.get(normalized);
      if (rec) return lookupResult(rec, "hios", 0.96);
    }
    if (ext.idType === "naic") {
      const rec = registry.byNaic.get(ext.idValue.trim());
      if (rec) return lookupResult(rec, "naic", 0.97);
    }
    if (ext.idType === "ticker") {
      const rec = registry.byTicker.get(ext.idValue.trim().toUpperCase());
      if (rec) return lookupResult(rec, "ticker", 0.95);
    }
  }
  return null;
}

function lookupByName(
  org: Organization,
  registry: ReturnType<typeof buildDomainRegistry>,
): DomainLookupResult | null {
  const key = normalizeOrganizationName(org.canonicalName);
  const byName = disambiguateByState(registry.byName.get(key) ?? [], org);
  if (byName) return lookupResult(byName, "name_exact", 0.92);

  for (const alias of org.aliases) {
    const byAlias = disambiguateByState(
      registry.byAlias.get(normalizeOrganizationName(alias)) ?? [],
      org,
    );
    if (byAlias) return lookupResult(byAlias, "alias_exact", 0.9);
  }

  if (org.parentDisplayName) {
    const byParent = disambiguateByState(
      registry.byParentName.get(normalizeOrganizationName(org.parentDisplayName)) ?? [],
      org,
    );
    if (byParent) return lookupResult(byParent, "parent_organization", 0.88);
  }

  return null;
}

/**
 * Resolve website/domain for an organization using high-confidence sources only.
 * Returns null when confidence is below threshold.
 */
export function resolveHighConfidenceDomain(input: {
  organization: Organization;
  externalIds?: OrganizationExternalId[];
}): DomainLookupResult | null {
  const { organization, externalIds } = input;
  const registry = buildDomainRegistry();

  const existingWebsite = normalizeWebsiteUrl(organization.website);
  const existingDomain = normalizePrimaryDomain({
    website: existingWebsite,
    domain: organization.domain,
  });
  if (existingWebsite && existingDomain) {
    return {
      website: existingWebsite,
      domain: existingDomain,
      source: "source_data",
      confidence: 1,
      confidenceLabel: "high",
      matchMethod: "source_data",
    };
  }

  if (existingWebsite && !existingDomain) {
    const domain = normalizePrimaryDomain({ website: existingWebsite })!;
    return {
      website: existingWebsite,
      domain,
      source: "derived",
      confidence: 0.99,
      confidenceLabel: "high",
      matchMethod: "derive_from_website",
    };
  }

  const fromIds = lookupExternalIds(externalIds ?? organization.externalIds, registry);
  if (fromIds && fromIds.confidence >= DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD) {
    return fromIds;
  }

  const fromName = lookupByName(organization, registry);
  if (fromName && fromName.confidence >= DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD) {
    return fromName;
  }

  return null;
}

export function domainLookupFromPropagatedDomain(domain: string): DomainLookupResult {
  const normalized = normalizePrimaryDomain({ domain })!;
  return {
    website: websiteFromDomain(normalized),
    domain: normalized,
    source: "identity_propagation",
    confidence: 0.95,
    confidenceLabel: "high",
    matchMethod: "shared_external_id",
  };
}
