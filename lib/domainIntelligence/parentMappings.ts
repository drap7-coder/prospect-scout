import { HEALTH_PLANS_DIRECTORY } from "@/lib/directories/healthPlans";
import { MANUFACTURERS_DIRECTORY } from "@/lib/directories/manufacturers";
import { normalizeDirectoryRecord } from "@/lib/directories/types";
import { normalizeBrandPhrase, normalizePrimaryDomain, normalizeWebsiteUrl } from "./normalize";
import { CURATED_PARENT_DOMAIN_RULES } from "./curatedParents";
import type { ParentDomainRule } from "./types";

export type { ParentMatchSignal, ParentDomainRule } from "./types";

function rule(
  input: Omit<ParentDomainRule, "parentNames" | "entityTokens"> & {
    parentNames?: string[];
    entityTokens?: string[];
  },
): ParentDomainRule {
  return {
    parentNames: input.parentNames ?? [],
    entityTokens: input.entityTokens ?? [],
    ...input,
  };
}

function directoryRecordToRule(record: ReturnType<typeof normalizeDirectoryRecord>): ParentDomainRule | null {
  const website = normalizeWebsiteUrl(record.website);
  const domain = normalizePrimaryDomain({ website });
  if (!website || !domain) return null;

  const states = (record.statesServed ?? []).map((s) => s.toUpperCase());
  const national =
    (record.tags ?? []).includes("national") ||
    (record.tags ?? []).includes("national-carrier") ||
    states.length >= 12;

  const parentNames = new Set<string>();
  if (record.parentOrganization) {
    parentNames.add(normalizeBrandPhrase(record.parentOrganization));
  }
  parentNames.add(normalizeBrandPhrase(record.name));

  const entityTokens = new Set<string>();
  entityTokens.add(normalizeBrandPhrase(record.name));
  for (const alias of record.aliases ?? []) {
    const normalized = normalizeBrandPhrase(alias);
    if (normalized.length >= 8) entityTokens.add(normalized);
  }

  const isRegionalBlues = (record.tags ?? []).includes("blues") && !national;

  return rule({
    id: `dir-parent-${record.id}`,
    parentOrg: record.parentOrganization ?? record.name,
    domain,
    website,
    confidence: isRegionalBlues ? 0.91 : national ? 0.9 : 0.89,
    national: national && !isRegionalBlues,
    states: isRegionalBlues ? states : states.length > 0 && states.length < 12 ? states : undefined,
    parentNames: [...parentNames],
    entityTokens: [...entityTokens].filter((t) => t.length >= 6),
  });
}

let cachedRules: ParentDomainRule[] | null = null;

/** All curated parent domain propagation rules. */
export function buildParentDomainRules(): ParentDomainRule[] {
  if (cachedRules) return cachedRules;

  const fromDirectory = [
    ...HEALTH_PLANS_DIRECTORY.map(normalizeDirectoryRecord),
    ...MANUFACTURERS_DIRECTORY.map(normalizeDirectoryRecord),
  ]
    .map(directoryRecordToRule)
    .filter((r): r is ParentDomainRule => r != null);

  const seen = new Set<string>();
  const merged: ParentDomainRule[] = [];

  for (const r of [...CURATED_PARENT_DOMAIN_RULES, ...fromDirectory]) {
    const key = `${r.domain}::${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }

  cachedRules = merged;
  return merged;
}

export function resetParentDomainRulesCache(): void {
  cachedRules = null;
}
