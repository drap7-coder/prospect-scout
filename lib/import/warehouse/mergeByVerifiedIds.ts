import { mergeOrganizations, type Organization } from "@/lib/discovery/organization";

export interface VerifiedExternalId {
  idType: string;
  idValue: string;
}

export type CatalogEntry = {
  organization: Organization;
  externalIds: VerifiedExternalId[];
};

/** External id types that may trigger a merge — never merge on name similarity alone. */
export const DEFAULT_VERIFIED_MERGE_ID_TYPES = new Set<string>([
  "cms_contract",
  "hios",
  "naic",
  "ein",
  "domain",
  "cik",
  "ticker",
  "fda_establishment",
  "epa_facility",
]);

type ExternalIdIndex = Map<string, string>;

function externalIdKey(idType: string, idValue: string): string {
  return `${idType}:${idValue.trim().toLowerCase()}`;
}

function orgMap(entries: CatalogEntry[]): Map<string, Organization> {
  return new Map(entries.map((entry) => [entry.organization.id, entry.organization]));
}

export function buildExternalIdIndex(entries: CatalogEntry[]): ExternalIdIndex {
  const index: ExternalIdIndex = new Map();
  for (const entry of entries) {
    for (const ext of entry.externalIds) {
      index.set(externalIdKey(ext.idType, ext.idValue), entry.organization.id);
    }
    if (entry.organization.domain) {
      index.set(
        externalIdKey("domain", entry.organization.domain),
        entry.organization.id,
      );
    }
  }
  return index;
}

function mergeExternalIds(
  a: VerifiedExternalId[],
  b: VerifiedExternalId[],
): VerifiedExternalId[] {
  const seen = new Set<string>();
  const merged: VerifiedExternalId[] = [];
  for (const ext of [...a, ...b]) {
    const key = externalIdKey(ext.idType, ext.idValue);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(ext);
  }
  return merged;
}

function sourcePriority(org: Organization): number {
  if (org.sources.some((s) => s.connector.includes("bootstrap"))) return 4;
  if (org.sources.some((s) => s.connector === "directory")) return 3;
  if (org.sources.some((s) => s.connector.startsWith("warehouse-"))) return 2;
  return 1;
}

export function mergeCatalogPair(a: Organization, b: Organization): Organization {
  if (sourcePriority(a) >= sourcePriority(b)) {
    return mergeOrganizations(a, b);
  }
  return mergeOrganizations(b, a);
}

function resolveCandidateMatchId(
  candidate: CatalogEntry,
  orgById: Map<string, Organization>,
  externalIdIndex: ExternalIdIndex,
  verifiedTypes: Set<string>,
): string | null {
  for (const ext of candidate.externalIds) {
    if (!verifiedTypes.has(ext.idType) && ext.idType !== "other") continue;
    if (ext.idType === "other") continue;
    const hit = externalIdIndex.get(externalIdKey(ext.idType, ext.idValue));
    if (hit && orgById.has(hit)) return hit;
  }
  if (candidate.organization.domain) {
    const hit = externalIdIndex.get(
      externalIdKey("domain", candidate.organization.domain),
    );
    if (hit && orgById.has(hit)) return hit;
  }
  return null;
}

export interface MergeCatalogResult {
  organizations: Organization[];
  catalogEntries: CatalogEntry[];
  mergedCount: number;
  addedCount: number;
}

/** Merge import candidates into a catalog using verified external ids only. */
export function mergeCatalogByVerifiedIds(
  existingEntries: CatalogEntry[],
  incoming: CatalogEntry[],
  options: { verifiedIdTypes?: Set<string> } = {},
): MergeCatalogResult {
  const verifiedTypes = options.verifiedIdTypes ?? DEFAULT_VERIFIED_MERGE_ID_TYPES;
  const catalog: CatalogEntry[] = existingEntries.map((entry) => ({
    organization: entry.organization,
    externalIds: [...entry.externalIds],
  }));

  let mergedCount = 0;
  let addedCount = 0;

  for (const candidate of incoming) {
    const externalIdIndex = buildExternalIdIndex(catalog);
    const matchId = resolveCandidateMatchId(
      candidate,
      orgMap(catalog),
      externalIdIndex,
      verifiedTypes,
    );

    if (matchId) {
      const index = catalog.findIndex((entry) => entry.organization.id === matchId);
      const existing = catalog[index]!;
      catalog[index] = {
        organization: mergeCatalogPair(existing.organization, candidate.organization),
        externalIds: mergeExternalIds(existing.externalIds, candidate.externalIds),
      };
      mergedCount += 1;
      continue;
    }

    catalog.push({
      organization: candidate.organization,
      externalIds: [...candidate.externalIds],
    });
    addedCount += 1;
  }

  return {
    organizations: catalog.map((entry) => entry.organization),
    catalogEntries: catalog,
    mergedCount,
    addedCount,
  };
}

/** Collapse catalog entries that share the same organization id. */
export function dedupeCatalogEntriesByOrganizationId(
  entries: CatalogEntry[],
): { entries: CatalogEntry[]; collapsed: number } {
  const byId = new Map<string, CatalogEntry>();
  let collapsed = 0;

  for (const entry of entries) {
    const id = entry.organization.id;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, entry);
      continue;
    }
    collapsed += 1;
    byId.set(id, {
      organization: mergeCatalogPair(existing.organization, entry.organization),
      externalIds: mergeExternalIds(existing.externalIds, entry.externalIds),
    });
  }

  return { entries: [...byId.values()], collapsed };
}

export function countDuplicateOrganizationIds(organizations: Organization[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const org of organizations) {
    if (seen.has(org.id)) duplicates += 1;
    else seen.add(org.id);
  }
  return duplicates;
}
