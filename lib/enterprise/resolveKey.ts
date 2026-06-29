import type { Organization } from "@/lib/discovery/organization";
import { readDomainIntelligence } from "@/lib/domainIntelligence/enrichOrganization";
import { DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD } from "@/lib/domainIntelligence/types";
import { normalizeBrandPhrase } from "@/lib/domainIntelligence/normalize";
import { buildEnterpriseRegistry } from "./registry";
import type { EnterpriseRegistryEntry } from "./types";
import {
  canonicalEnterpriseId,
  registryEntryForDomain,
  registryEntryForParentName,
} from "./canonicalId";
import type { ResolvedEnterpriseKey } from "./types";

const DISTINCTIVE_BRAND_TOKENS = new Set([
  "uhc",
  "aetna",
  "cigna",
  "humana",
  "centene",
  "wellcare",
  "molina",
  "kaiser",
  "anthem",
  "elevance",
  "optum",
]);

function slugId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function orgStates(org: Organization): string[] {
  const states = new Set<string>();
  for (const s of org.geography?.states ?? []) states.add(s.toUpperCase());
  for (const s of org.states ?? []) states.add(s.toUpperCase());
  return [...states];
}

function collectTexts(org: Organization): string {
  return [
    org.canonicalName,
    org.legalName,
    org.displayName,
    org.parentDisplayName,
    ...org.aliases,
  ]
    .filter(Boolean)
    .map((v) => normalizeBrandPhrase(v!))
    .join(" ");
}

function tokenMatches(haystack: string, token: string): boolean {
  if (DISTINCTIVE_BRAND_TOKENS.has(token)) return haystack.includes(token);
  if (token.length < 8) return false;
  return haystack.includes(token);
}

function matchRegistryByParentName(name: string): EnterpriseRegistryEntry | null {
  return registryEntryForParentName(name);
}

function matchRegistryByEntity(org: Organization): EnterpriseRegistryEntry | null {
  const haystack = collectTexts(org);
  const states = orgStates(org);
  const candidates: EnterpriseRegistryEntry[] = [];

  for (const entry of buildEnterpriseRegistry()) {
    if (entry.entityTokens.some((token) => tokenMatches(haystack, token))) {
      if (entry.states?.length && states.length > 0) {
        if (!states.some((s) => entry.states!.includes(s))) continue;
      }
      candidates.push(entry);
    }
  }

  if (candidates.length === 0) return null;
  const domains = new Set(candidates.map((c) => c.canonicalDomain));
  if (domains.size > 1) return null;
  return candidates[0]!;
}

function isSelfParent(org: Organization, parent: string): boolean {
  const p = normalizeBrandPhrase(parent);
  const self = normalizeBrandPhrase(org.canonicalName);
  return p === self || p.startsWith(self) || self.startsWith(p);
}

/** Resolve the enterprise rollup key for a warehouse organization. */
export function resolveEnterpriseKey(org: Organization): ResolvedEnterpriseKey {
  const parent = org.parentDisplayName?.trim();
  const domainIntel = readDomainIntelligence(org.sectorAttributes);
  const orgDomain =
    org.domain ??
    (domainIntel?.domain && domainIntel.confidence >= DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD
      ? domainIntel.domain
      : null);

  if (orgDomain) {
    const fromDomain = registryEntryForDomain(orgDomain);
    if (fromDomain) {
      const id = canonicalEnterpriseId(fromDomain.id);
      return {
        key: id,
        enterpriseId: id,
        displayName: fromDomain.name,
        method: "canonical_domain",
        registryEntry: fromDomain,
      };
    }
  }

  if (parent && !isSelfParent(org, parent)) {
    const registry = matchRegistryByParentName(parent);
    if (registry) {
      const id = canonicalEnterpriseId(registry.id);
      return {
        key: id,
        enterpriseId: id,
        displayName: registry.name,
        method: "parent_display_name",
        registryEntry: registry,
      };
    }
    const slug = canonicalEnterpriseId(
      parent
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 64),
    );
    return {
      key: slug,
      enterpriseId: slug,
      displayName: parent,
      method: "parent_display_name",
    };
  }

  if (
    domainIntel?.parentOrg &&
    domainIntel.confidence >= DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD
  ) {
    const registry = matchRegistryByParentName(domainIntel.parentOrg);
    if (registry) {
      const id = canonicalEnterpriseId(registry.id);
      return {
        key: id,
        enterpriseId: id,
        displayName: registry.name,
        method: "domain_intelligence_parent",
        registryEntry: registry,
      };
    }
  }

  const fromEntity = matchRegistryByEntity(org);
  if (fromEntity) {
    const id = canonicalEnterpriseId(fromEntity.id);
    return {
      key: id,
      enterpriseId: id,
      displayName: fromEntity.name,
      method: "curated_entity_token",
      registryEntry: fromEntity,
    };
  }

  return {
    key: `standalone:${org.id}`,
    enterpriseId: org.id,
    displayName: org.canonicalName,
    method: "standalone",
  };
}
