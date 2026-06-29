import type { Organization } from "@/lib/discovery/organization";
import { readDomainIntelligence } from "@/lib/domainIntelligence/enrichOrganization";
import {
  normalizePrimaryDomain,
  normalizeWebsiteUrl,
  websiteFromDomain,
} from "@/lib/domainIntelligence/normalize";
import { DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD } from "@/lib/domainIntelligence/types";
import type { DomainIntelligenceSource } from "@/lib/domainIntelligence/types";
import type { EnterpriseRegistryEntry } from "./types";
import type { ResolvedEnterpriseKey } from "./types";

export type EnterpriseDomainSource =
  | "curated_parent_mapping"
  | "parent_propagation"
  | "domain_intelligence"
  | "explicit_website"
  | "derived_domain";

export interface DomainCandidate {
  domain: string;
  website: string | null;
  tier: number;
  confidence: number;
  source: EnterpriseDomainSource;
  childOrganizationId: string;
  domainIntelligenceSource?: DomainIntelligenceSource;
}

export interface PromotedEnterpriseDomain {
  canonicalDomain: string;
  website: string;
  domainConfidence: number;
  domainSource: EnterpriseDomainSource;
  domainEvidenceCount: number;
  ambiguous: boolean;
}

const TIER_CURATED = 1;
const TIER_PARENT_PROPAGATION = 2;
const TIER_DOMAIN_INTELLIGENCE = 3;
const TIER_EXPLICIT_WEBSITE = 4;
const TIER_DERIVED = 5;

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, "");
}

function collectCandidatesFromChild(org: Organization): DomainCandidate[] {
  const out: DomainCandidate[] = [];
  const intel = readDomainIntelligence(org.sectorAttributes);

  if (
    intel?.domain &&
    intel.confidence >= DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD &&
    intel.source === "parent_propagation"
  ) {
    const domain = normalizeDomain(intel.domain);
    out.push({
      domain,
      website: intel.website ?? websiteFromDomain(domain),
      tier: TIER_PARENT_PROPAGATION,
      confidence: intel.confidence,
      source: "parent_propagation",
      childOrganizationId: org.id,
      domainIntelligenceSource: intel.source,
    });
  }

  if (
    intel?.domain &&
    intel.confidence >= DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD &&
    intel.source !== "parent_propagation"
  ) {
    const domain = normalizeDomain(intel.domain);
    out.push({
      domain,
      website: intel.website ?? websiteFromDomain(domain),
      tier: TIER_DOMAIN_INTELLIGENCE,
      confidence: intel.confidence,
      source: "domain_intelligence",
      childOrganizationId: org.id,
      domainIntelligenceSource: intel.source,
    });
  }

  const explicitWebsite = normalizeWebsiteUrl(org.website);
  if (explicitWebsite) {
    const domain = normalizePrimaryDomain({ website: explicitWebsite });
    if (domain) {
      out.push({
        domain: normalizeDomain(domain),
        website: explicitWebsite,
        tier: TIER_EXPLICIT_WEBSITE,
        confidence: 0.95,
        source: "explicit_website",
        childOrganizationId: org.id,
      });
    }
  }

  const derived = normalizePrimaryDomain({
    website: org.website,
    domain: org.domain,
  });
  if (derived) {
    const normalized = normalizeDomain(derived);
    const alreadyExplicit = out.some(
      (c) => c.domain === normalized && c.tier <= TIER_EXPLICIT_WEBSITE,
    );
    if (!alreadyExplicit) {
      out.push({
        domain: normalized,
        website: org.website ?? websiteFromDomain(normalized),
        tier: TIER_DERIVED,
        confidence: 0.88,
        source: "derived_domain",
        childOrganizationId: org.id,
      });
    }
  }

  return out;
}

function pickUnambiguousDomain(
  candidates: DomainCandidate[],
  tier: number,
): { domain: string; evidence: DomainCandidate[] } | null {
  const tierCandidates = candidates.filter((c) => c.tier === tier);
  if (tierCandidates.length === 0) return null;

  const byDomain = new Map<string, DomainCandidate[]>();
  for (const c of tierCandidates) {
    const bucket = byDomain.get(c.domain) ?? [];
    bucket.push(c);
    byDomain.set(c.domain, bucket);
  }

  if (byDomain.size !== 1) return null;

  const [domain, evidence] = [...byDomain.entries()][0]!;
  return { domain, evidence };
}

function bestCandidateFromEvidence(evidence: DomainCandidate[]): DomainCandidate {
  return evidence.reduce((best, c) => (c.confidence > best.confidence ? c : best));
}

/** Promote a canonical domain onto an enterprise profile from registry + child evidence. */
export function promoteEnterpriseDomain(input: {
  key: ResolvedEnterpriseKey;
  children: Organization[];
  registry?: EnterpriseRegistryEntry | null;
}): PromotedEnterpriseDomain | null {
  const registry = input.registry ?? input.key.registryEntry ?? null;

  if (registry?.canonicalDomain) {
    const domain = normalizeDomain(registry.canonicalDomain);
    const childCandidates = input.children.flatMap(collectCandidatesFromChild);
    const supporting = childCandidates.filter((c) => c.domain === domain);
    return {
      canonicalDomain: domain,
      website: registry.website ?? websiteFromDomain(domain),
      domainConfidence: 0.98,
      domainSource: "curated_parent_mapping",
      domainEvidenceCount: Math.max(1, supporting.length),
      ambiguous: false,
    };
  }

  const allCandidates = input.children.flatMap(collectCandidatesFromChild);
  if (allCandidates.length === 0) return null;

  for (const tier of [
    TIER_PARENT_PROPAGATION,
    TIER_DOMAIN_INTELLIGENCE,
    TIER_EXPLICIT_WEBSITE,
    TIER_DERIVED,
  ]) {
    const picked = pickUnambiguousDomain(allCandidates, tier);
    if (!picked) continue;

    const best = bestCandidateFromEvidence(picked.evidence);
    return {
      canonicalDomain: picked.domain,
      website: best.website ?? websiteFromDomain(picked.domain),
      domainConfidence: best.confidence,
      domainSource: best.source,
      domainEvidenceCount: picked.evidence.length,
      ambiguous: false,
    };
  }

  return null;
}

/** True when child records disagree on high-confidence domains at the same tier. */
export function enterpriseDomainIsAmbiguous(children: Organization[]): boolean {
  const allCandidates = children.flatMap(collectCandidatesFromChild);
  for (const tier of [
    TIER_PARENT_PROPAGATION,
    TIER_DOMAIN_INTELLIGENCE,
    TIER_EXPLICIT_WEBSITE,
    TIER_DERIVED,
  ]) {
    const tierCandidates = allCandidates.filter((c) => c.tier === tier);
    if (tierCandidates.length === 0) continue;
    const domains = new Set(tierCandidates.map((c) => c.domain));
    if (domains.size > 1) return true;
  }
  return false;
}
