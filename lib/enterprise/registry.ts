import { HEALTH_PLANS_DIRECTORY } from "@/lib/directories/healthPlans";
import { normalizeDirectoryRecord } from "@/lib/directories/types";
import { buildParentDomainRules } from "@/lib/domainIntelligence/parentMappings";
import { normalizeBrandPhrase } from "@/lib/domainIntelligence/normalize";
import type { EnterpriseRegistryEntry } from "./types";

function slugId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function parseHq(headquarters: string | null | undefined): { city: string | null; state: string | null } {
  if (!headquarters?.trim()) return { city: null, state: null };
  const parts = headquarters.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const stateMatch = parts[parts.length - 1]!.match(/\b([A-Z]{2})\b/);
    return { city: parts[0] ?? null, state: stateMatch?.[1] ?? null };
  }
  const stateOnly = headquarters.match(/\b([A-Z]{2})\b/);
  return { city: null, state: stateOnly?.[1] ?? null };
}

let cachedRegistry: EnterpriseRegistryEntry[] | null = null;

/** Curated enterprise registry aligned with Domain Intelligence parent mappings. */
export function buildEnterpriseRegistry(): EnterpriseRegistryEntry[] {
  if (cachedRegistry) return cachedRegistry;

  const seen = new Set<string>();
  const entries: EnterpriseRegistryEntry[] = [];

  const push = (entry: EnterpriseRegistryEntry) => {
    if (seen.has(entry.id)) return;
    seen.add(entry.id);
    entries.push(entry);
  };

  for (const rule of buildParentDomainRules()) {
    push({
      id: slugId(rule.parentOrg),
      name: rule.parentOrg.replace(/,?\s*(Inc\.?|Incorporated|Corporation|Corp\.?)$/i, "").trim(),
      canonicalDomain: rule.domain,
      website: rule.website,
      parentNames: [...new Set([...rule.parentNames, normalizeBrandPhrase(rule.parentOrg)])],
      entityTokens: rule.entityTokens,
      national: rule.national,
      states: rule.states,
    });
  }

  for (const raw of HEALTH_PLANS_DIRECTORY.map(normalizeDirectoryRecord)) {
    if (!raw.website) continue;
    const domain = raw.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
    const hq = parseHq(raw.headquarters);
    const parentNames = new Set<string>();
    parentNames.add(normalizeBrandPhrase(raw.name));
    if (raw.parentOrganization) parentNames.add(normalizeBrandPhrase(raw.parentOrganization));
    for (const alias of raw.aliases ?? []) {
      if (alias.length >= 6) parentNames.add(normalizeBrandPhrase(alias));
    }

    push({
      id: slugId(raw.parentOrganization ?? raw.name),
      name: raw.parentOrganization ?? raw.name,
      canonicalDomain: domain,
      website: raw.website.startsWith("http") ? raw.website : `https://${domain}`,
      parentNames: [...parentNames],
      entityTokens: (raw.aliases ?? [])
        .map((a) => normalizeBrandPhrase(a))
        .filter((t) => t.length >= 8),
      ticker: raw.ticker ?? null,
      hqCity: hq.city,
      hqState: hq.state ?? raw.headquarters?.match(/\b([A-Z]{2})\b/)?.[1] ?? null,
      national: (raw.tags ?? []).includes("national"),
      states: raw.statesServed,
    });
  }

  cachedRegistry = entries;
  return entries;
}

export function resetEnterpriseRegistryCache(): void {
  cachedRegistry = null;
}

export function registryByParentName(): Map<string, EnterpriseRegistryEntry> {
  const map = new Map<string, EnterpriseRegistryEntry>();
  for (const entry of buildEnterpriseRegistry()) {
    for (const name of entry.parentNames) {
      if (!map.has(name)) map.set(name, entry);
    }
  }
  return map;
}
