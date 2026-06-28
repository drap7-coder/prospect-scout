import type { Organization } from "./organization";
import {
  mergeOrganizations,
  stripCorporateSuffix,
} from "./organization";
import { extractExternalIds } from "./externalIds";
import { exactNameKey } from "./queryDiscovery";

export type MergeKeyKind =
  | "domain"
  | "ein"
  | "cik"
  | "npi"
  | "fda"
  | "exact-name"
  | "fuzzy-name";

export interface MergeKey {
  kind: MergeKeyKind;
  value: string;
}

const MERGE_PRIORITY: MergeKeyKind[] = [
  "domain",
  "ein",
  "cik",
  "npi",
  "fda",
  "exact-name",
  "fuzzy-name",
];

/** All merge keys for an organization, highest-priority first. */
export function organizationMergeKeys(org: Organization): MergeKey[] {
  const keys: MergeKey[] = [];
  const ids = extractExternalIds(org);

  if (org.domain) keys.push({ kind: "domain", value: org.domain.toLowerCase() });
  if (ids.ein) keys.push({ kind: "ein", value: ids.ein });
  if (ids.cik) keys.push({ kind: "cik", value: ids.cik });
  if (ids.npi) keys.push({ kind: "npi", value: ids.npi });
  if (ids.fdaOrganizationId) {
    keys.push({ kind: "fda", value: ids.fdaOrganizationId });
  }

  const exact = exactNameKey(org);
  if (exact) keys.push({ kind: "exact-name", value: exact });

  const fuzzy = stripCorporateSuffix(org.canonicalName);
  if (fuzzy && fuzzy !== exact) {
    keys.push({ kind: "fuzzy-name", value: fuzzy });
  }

  for (const alias of org.aliases) {
    const aliasKey = stripCorporateSuffix(alias);
    if (aliasKey) keys.push({ kind: "fuzzy-name", value: aliasKey });
  }

  return keys;
}

function mergeKeyIndex(kind: MergeKeyKind): number {
  return MERGE_PRIORITY.indexOf(kind);
}

function pickPrimaryKey(keys: MergeKey[]): MergeKey | null {
  if (keys.length === 0) return null;
  return keys.reduce((best, key) =>
    mergeKeyIndex(key.kind) < mergeKeyIndex(best.kind) ? key : best,
  );
}

/**
 * Deduplicate organizations using priority merge keys:
 * domain → EIN → CIK → NPI → FDA ID → exact name → fuzzy name.
 * Preserves source attribution via mergeOrganizations.
 */
export function dedupeOrganizationsByMergeKeys(
  orgs: Organization[],
): Organization[] {
  const byKey = new Map<string, Organization>();

  for (const org of orgs) {
    const keys = organizationMergeKeys(org);
    const primary = pickPrimaryKey(keys);
    if (!primary) continue;

    let existing: Organization | null = null;
    for (const key of keys.sort(
      (a, b) => mergeKeyIndex(a.kind) - mergeKeyIndex(b.kind),
    )) {
      const mapKey = `${key.kind}:${key.value}`;
      const hit = byKey.get(mapKey);
      if (hit) {
        existing = hit;
        break;
      }
    }

    const merged = existing ? mergeOrganizations(existing, org) : org;
    for (const key of organizationMergeKeys(merged)) {
      byKey.set(`${key.kind}:${key.value}`, merged);
    }
  }

  return [...new Set(byKey.values())];
}
