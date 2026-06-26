import { getAllDirectoryRecords } from "@/lib/directories/search";
import type { OrganizationRecord } from "@/lib/directories/types";
import { normalizeDirectoryRecord } from "@/lib/directories/types";
import type { BuyerPackId } from "@/lib/search/types";

/** Provenance for a field or record from a discovery connector. */
export interface OrganizationSource {
  connector: string;
  sourceId: string;
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

/** Dedupe key: domain first, then normalized name. */
export function organizationDedupeKey(org: Organization): string {
  if (org.domain) return `domain:${org.domain}`;
  return `name:${normalizeNameKey(org.canonicalName)}`;
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

  return {
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
        retrievedAt: new Date().toISOString(),
        evidence: ["Master directory record"],
      },
    ],
    buyerPack: normalized.buyerPack,
  };
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

/** Merge two organization records into one (dedupe aliases, sources, locations). */
export function mergeOrganizations(
  existing: Organization,
  incoming: Organization,
): Organization {
  const mergedIndustries = unionUnique(existing.industries, incoming.industries);
  const mergedSources = [...existing.sources];
  for (const src of incoming.sources) {
    const dup = mergedSources.some(
      (s) => s.connector === src.connector && s.sourceId === src.sourceId,
    );
    if (!dup) mergedSources.push(src);
  }

  return {
    id: existing.id,
    canonicalName: existing.canonicalName || incoming.canonicalName,
    aliases: unionUnique(
      unionUnique(existing.aliases, incoming.aliases),
      incoming.canonicalName !== existing.canonicalName
        ? [incoming.canonicalName]
        : [],
    ),
    website: pickBetterString(existing.website, incoming.website),
    domain: existing.domain ?? incoming.domain,
    organizationType: existing.organizationType ?? incoming.organizationType,
    industries: mergedIndustries,
    sectorId: existing.sectorId ?? incoming.sectorId,
    headquarters: pickBetterString(existing.headquarters, incoming.headquarters),
    locations: unionUnique(existing.locations, incoming.locations),
    states: unionUnique(existing.states, incoming.states),
    regions: unionUnique(existing.regions, incoming.regions),
    ownership: existing.ownership ?? incoming.ownership,
    employeeRange: existing.employeeRange ?? incoming.employeeRange,
    revenueRange: existing.revenueRange ?? incoming.revenueRange,
    description: existing.description ?? incoming.description,
    sources: mergedSources,
    buyerPack: existing.buyerPack ?? incoming.buyerPack,
    relevance: Math.max(existing.relevance ?? 0, incoming.relevance ?? 0),
    confidence: Math.max(existing.confidence ?? 0, incoming.confidence ?? 0),
  };
}

/** Deduplicate a list of organizations by domain then normalized name. */
export function dedupeOrganizations(orgs: Organization[]): Organization[] {
  const byKey = new Map<string, Organization>();
  for (const org of orgs) {
    const key = organizationDedupeKey(org);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, org);
      continue;
    }
    byKey.set(key, mergeOrganizations(existing, org));
  }
  return [...byKey.values()];
}

export { normalizeNameKey };
