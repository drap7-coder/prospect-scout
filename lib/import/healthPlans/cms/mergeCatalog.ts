import { mergeOrganizations, type Organization } from "@/lib/discovery/organization";
import { HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID } from "../types";
import type { HealthPlanExternalId, HealthPlanImportCandidate } from "./types";

/** External id types that may trigger a merge — never merge on name similarity alone. */
const VERIFIED_MERGE_ID_TYPES = new Set<HealthPlanExternalId["idType"]>([
  "cms_contract",
  "hios",
  "naic",
  "ein",
  "domain",
]);

type CatalogEntry = {
  organization: Organization;
  externalIds: HealthPlanExternalId[];
};

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
  a: HealthPlanExternalId[],
  b: HealthPlanExternalId[],
): HealthPlanExternalId[] {
  const seen = new Set<string>();
  const merged: HealthPlanExternalId[] = [];
  for (const ext of [...a, ...b]) {
    const key = externalIdKey(ext.idType, ext.idValue);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(ext);
  }
  return merged;
}

function sourcePriority(org: Organization): number {
  if (org.sources.some((s) => s.connector === HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID)) {
    return 4;
  }
  if (org.sources.some((s) => s.connector === "directory")) return 3;
  if (org.sources.some((s) => s.connector.startsWith("cms-"))) return 2;
  return 1;
}

/** Merge two health plan orgs, preserving curated bootstrap identity when present. */
export function mergeHealthPlanPair(a: Organization, b: Organization): Organization {
  if (sourcePriority(a) >= sourcePriority(b)) {
    return mergeOrganizations(a, b);
  }
  return mergeOrganizations(b, a);
}

function resolveCandidateMatchId(
  candidate: HealthPlanImportCandidate,
  orgById: Map<string, Organization>,
  externalIdIndex: ExternalIdIndex,
): string | null {
  for (const ext of candidate.externalIds) {
    if (!VERIFIED_MERGE_ID_TYPES.has(ext.idType) && ext.idType !== "other") {
      continue;
    }
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
      organization: mergeHealthPlanPair(existing.organization, entry.organization),
      externalIds: mergeExternalIds(existing.externalIds, entry.externalIds),
    });
  }

  return { entries: [...byId.values()], collapsed };
}

/** Merge CMS import candidates into an existing health plan catalog. */
export function mergeHealthPlanCatalog(
  existingEntries: CatalogEntry[],
  incoming: HealthPlanImportCandidate[],
): MergeCatalogResult {
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
    );

    if (matchId) {
      const index = catalog.findIndex((entry) => entry.organization.id === matchId);
      const existing = catalog[index]!;
      catalog[index] = {
        organization: mergeHealthPlanPair(existing.organization, candidate.organization),
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

/** Detect duplicate CMS contract ids assigned to different organization ids. */
export function findDuplicateContractAssignments(entries: CatalogEntry[]): string[] {
  const contractToOrg = new Map<string, string>();
  const duplicates: string[] = [];
  for (const entry of entries) {
    for (const ext of entry.externalIds) {
      if (ext.idType !== "cms_contract") continue;
      const existingOrg = contractToOrg.get(ext.idValue);
      if (existingOrg && existingOrg !== entry.organization.id) {
        duplicates.push(`${ext.idValue}:${existingOrg}:${entry.organization.id}`);
        continue;
      }
      contractToOrg.set(ext.idValue, entry.organization.id);
    }
  }
  return duplicates;
}
