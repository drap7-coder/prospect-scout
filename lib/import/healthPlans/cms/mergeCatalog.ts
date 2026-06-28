import {
  mergeOrganizations,
  stripCorporateSuffix,
  type Organization,
} from "@/lib/discovery/organization";
import { normalizeOrganizationName } from "@/lib/providers/cms";
import { HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID } from "../types";
import type { HealthPlanExternalId, HealthPlanImportCandidate } from "./types";

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

function parentBrandKey(org: Organization): string | null {
  const parent = org.description?.replace(/^Part of /i, "").trim();
  const name = normalizeOrganizationName(org.canonicalName);
  const parentNorm = parent ? normalizeOrganizationName(parent) : "";
  if (!parentNorm || parentNorm === name) return null;
  return `${parentNorm}::${name}`;
}

function resolveCandidateMatchId(
  candidate: HealthPlanImportCandidate,
  orgById: Map<string, Organization>,
  externalIdIndex: ExternalIdIndex,
): string | null {
  for (const ext of candidate.externalIds) {
    const hit = externalIdIndex.get(externalIdKey(ext.idType, ext.idValue));
    if (hit && orgById.has(hit)) return hit;
  }
  if (candidate.organization.domain) {
    const hit = externalIdIndex.get(
      externalIdKey("domain", candidate.organization.domain),
    );
    if (hit && orgById.has(hit)) return hit;
  }

  const incomingName = stripCorporateSuffix(candidate.organization.canonicalName);
  const incomingParent = parentBrandKey(candidate.organization);
  for (const org of orgById.values()) {
    const name = stripCorporateSuffix(org.canonicalName);
    if (name && incomingName && name === incomingName) return org.id;
    const parentKey = parentBrandKey(org);
    if (incomingParent && parentKey && incomingParent === parentKey) return org.id;
    for (const alias of org.aliases) {
      if (stripCorporateSuffix(alias) === incomingName) return org.id;
    }
  }

  return null;
}

export interface MergeCatalogResult {
  organizations: Organization[];
  catalogEntries: CatalogEntry[];
  mergedCount: number;
  addedCount: number;
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
