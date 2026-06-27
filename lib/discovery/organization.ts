import { getAllDirectoryRecords } from "@/lib/directories/search";
import type { OrganizationRecord } from "@/lib/directories/types";
import { normalizeDirectoryRecord } from "@/lib/directories/types";
import type { BuyerPackId } from "@/lib/search/types";
import {
  normalizeCanonicalOrganizationType,
  normalizeTaxonomyOrganizationType,
} from "./canonicalOrgType";

/** Provenance for a field or record from a discovery connector. */
export interface OrganizationSource {
  connector: string;
  sourceId: string;
  /** Human-readable source name, e.g. "FDIC Institution Directory". */
  sourceName?: string;
  /** Public URL or dataset file for the source. */
  sourceUrl?: string;
  /** When the upstream dataset was last updated. */
  lastUpdated?: string;
  /** Confidence in this source record (0–1). */
  confidence?: number;
  retrievedAt: string;
  evidence: string[];
}

/**
 * Canonical organization — the primary object in the discovery engine.
 * Every connector normalizes into this schema.
 */
export interface Organization {
  id: string;
  canonicalName: string;
  aliases: string[];
  website: string | null;
  domain: string | null;
  organizationType: string | null;
  industries: string[];
  sectorId: string | null;
  headquarters: string | null;
  locations: string[];
  /** US state codes where the org operates or is headquartered. */
  states: string[];
  regions: string[];
  ownership: "public" | "private" | "nonprofit" | "government" | null;
  employeeRange: string | null;
  revenueRange: string | null;
  description: string | null;
  sources: OrganizationSource[];
  /** Internal pipeline anchor (legacy buyer pack). */
  buyerPack: BuyerPackId | null;
  /** Relevance score from structured ranking (0–100). */
  relevance?: number;
  /** Confidence that this org matches the query intent (0–1). */
  confidence?: number;
  /** Single canonical organization type for faceting and display. */
  canonicalOrganizationType: string;
}

/** Derive a hostname from a full website URL. */
export function deriveDomain(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  try {
    const url = new URL(
      /^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`,
    );
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CORPORATE_SUFFIXES =
  /\b(inc|incorporated|corp|corporation|co|company|llc|l l c|ltd|limited|plc|lp|llp|na|n a|national association|bancorp|bancshares|holdings|group)\b/gi;

/** Strip legal suffixes for fuzzy name matching. */
export function stripCorporateSuffix(name: string): string {
  return normalizeNameKey(name.replace(CORPORATE_SUFFIXES, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function isDirectorySource(org: Organization): boolean {
  return org.sources.some((s) => s.connector === "directory");
}

function sourcePriority(org: Organization): number {
  if (isDirectorySource(org)) return 3;
  const connector = org.sources[0]?.connector ?? "";
  if (connector === "cms" || connector === "sec" || connector === "nces") return 2;
  return 1;
}

/** Dedupe key: domain first, then stripped normalized name. */
export function organizationDedupeKey(org: Organization): string {
  if (org.domain) return `domain:${org.domain}`;
  return `name:${stripCorporateSuffix(org.canonicalName)}`;
}

/** Apply canonical type normalization to a catalog organization. */
export function finalizeOrganization(org: Organization): Organization {
  const organizationType =
    normalizeTaxonomyOrganizationType(org.organizationType) ?? org.organizationType;
  const finalized: Organization = {
    ...org,
    organizationType,
    canonicalOrganizationType: normalizeCanonicalOrganizationType({
      ...org,
      organizationType,
    }),
  };
  return finalized;
}

function inferOwnership(record: OrganizationRecord): Organization["ownership"] {
  if (record.publicCompany) return "public";
  if (record.organizationType === "municipality") return "government";
  if (record.organizationType === "university") return "government";
  if (record.sectorId === "nonprofit" || record.industryId === "nonprofit") {
    return "nonprofit";
  }
  return "private";
}

function headquartersState(record: OrganizationRecord): string | null {
  const parts = record.headquarters.split(",").map((s) => s.trim());
  const last = parts.length >= 2 ? parts[parts.length - 1] : "";
  if (/^[A-Z]{2}$/.test(last)) return last;
  return record.statesServed[0] ?? null;
}

/** Map a master directory record into the canonical Organization model. */
export function directoryRecordToOrganization(
  record: OrganizationRecord,
): Organization {
  const normalized = normalizeDirectoryRecord(record);
  const domain = deriveDomain(normalized.website);
  const hqState = headquartersState(normalized);

  const org: Organization = {
    id: normalized.id,
    canonicalName: normalized.name,
    aliases: normalized.aliases,
    website: normalized.website ?? null,
    domain,
    organizationType: normalized.organizationTypeId ?? normalized.organizationType,
    industries: normalized.industryId
      ? [normalized.industryId]
      : normalized.industry
        ? [normalized.industry]
        : [],
    sectorId: normalized.sectorId ?? null,
    headquarters: normalized.headquarters,
    locations: hqState ? [normalized.headquarters] : [],
    states: normalized.statesServed,
    regions: normalized.regions,
    ownership: inferOwnership(normalized),
    employeeRange: normalized.employeeEstimate
      ? String(normalized.employeeEstimate)
      : normalized.memberEstimate
        ? String(normalized.memberEstimate)
        : null,
    revenueRange: null,
    description: normalized.parentOrganization
      ? `Part of ${normalized.parentOrganization}`
      : null,
    sources: [
      {
        connector: "directory",
        sourceId: normalized.id,
        sourceName: "Master Directory",
        sourceUrl: "lib/directories/",
        lastUpdated: new Date().toISOString().slice(0, 10),
        confidence: 0.92,
        retrievedAt: new Date().toISOString(),
        evidence: ["Master directory record"],
      },
    ],
    buyerPack: normalized.buyerPack,
    canonicalOrganizationType: "other",
  };
  return finalizeOrganization(org);
}

/** Load all curated directory records as canonical organizations. */
export function organizationsFromDirectory(): Organization[] {
  return getAllDirectoryRecords().map(directoryRecordToOrganization);
}

function unionUnique<T>(a: T[], b: T[]): T[] {
  return [...new Set([...a, ...b])];
}

function pickBetterString(a: string | null, b: string | null): string | null {
  if (a && b) return a.length >= b.length ? a : b;
  return a ?? b;
}

/** Merge two organization records; prefer directory canonical identity. */
export function mergeOrganizations(
  existing: Organization,
  incoming: Organization,
): Organization {
  const preferIncoming =
    isDirectorySource(incoming) && !isDirectorySource(existing);
  const base = preferIncoming ? incoming : existing;
  const other = preferIncoming ? existing : incoming;

  const mergedIndustries = unionUnique(base.industries, other.industries);
  const mergedSources = [...base.sources];
  for (const src of other.sources) {
    const dup = mergedSources.some(
      (s) => s.connector === src.connector && s.sourceId === src.sourceId,
    );
    if (!dup) mergedSources.push(src);
  }

  return finalizeOrganization({
    id: base.id,
    canonicalName: base.canonicalName || other.canonicalName,
    aliases: unionUnique(
      unionUnique(base.aliases, other.aliases),
      other.canonicalName !== base.canonicalName ? [other.canonicalName] : [],
    ),
    website: pickBetterString(base.website, other.website),
    domain: base.domain ?? other.domain,
    organizationType: base.organizationType ?? other.organizationType,
    industries: mergedIndustries,
    sectorId: base.sectorId ?? other.sectorId,
    headquarters: pickBetterString(base.headquarters, other.headquarters),
    locations: unionUnique(base.locations, other.locations),
    states: unionUnique(base.states, other.states),
    regions: unionUnique(base.regions, other.regions),
    ownership: base.ownership ?? other.ownership,
    employeeRange: base.employeeRange ?? other.employeeRange,
    revenueRange: base.revenueRange ?? other.revenueRange,
    description: base.description ?? other.description,
    sources: mergedSources,
    buyerPack: base.buyerPack ?? other.buyerPack,
    relevance: Math.max(base.relevance ?? 0, other.relevance ?? 0),
    confidence: Math.max(base.confidence ?? 0, other.confidence ?? 0),
    canonicalOrganizationType: base.canonicalOrganizationType,
  });
}

/** Deduplicate a list of organizations by domain then normalized name. */
export function dedupeOrganizations(orgs: Organization[]): Organization[] {
  return dedupeOrganizationsCanonical(orgs);
}

/**
 * Canonical dedupe: domain → stripped name → alias overlap.
 * Directory records are merged first so curated names win.
 */
export function dedupeOrganizationsCanonical(
  orgs: Organization[],
): Organization[] {
  const sorted = [...orgs].sort(
    (a, b) => sourcePriority(b) - sourcePriority(a),
  );

  const byKey = new Map<string, Organization>();
  for (const org of sorted) {
    const key = organizationDedupeKey(org);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, org);
      continue;
    }
    byKey.set(key, mergeOrganizations(existing, org));
  }

  let deduped = [...byKey.values()];

  const byName = new Map<string, Organization>();
  for (const org of deduped) {
    const nameKey = stripCorporateSuffix(org.canonicalName);
    const existing = byName.get(nameKey);
    if (!existing) {
      byName.set(nameKey, org);
      continue;
    }
    byName.set(nameKey, mergeOrganizations(existing, org));
  }
  deduped = [...byName.values()];

  const byAliasKey = new Map<string, Organization>();
  for (const org of deduped) {
    const keys = [
      stripCorporateSuffix(org.canonicalName),
      ...org.aliases.map(stripCorporateSuffix),
    ].filter(Boolean);
    let mergeTarget: Organization | null = null;
    for (const key of keys) {
      const existing = byAliasKey.get(key);
      if (existing) {
        mergeTarget = existing;
        break;
      }
    }
    const merged = mergeTarget ? mergeOrganizations(mergeTarget, org) : org;
    for (const key of keys) {
      byAliasKey.set(key, merged);
    }
  }

  return [...new Set(byAliasKey.values())];
}

export { normalizeNameKey };
