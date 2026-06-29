import { HEALTH_PLANS_DIRECTORY } from "@/lib/directories/healthPlans";
import { MANUFACTURERS_DIRECTORY } from "@/lib/directories/manufacturers";
import { normalizeDirectoryRecord } from "@/lib/directories/types";
import { normalizePrimaryDomain, normalizeWebsiteUrl, normalizeBrandPhrase } from "./normalize";

export type ParentMatchSignal =
  | "parent_display_name"
  | "parent_organization"
  | "legal_entity_token"
  | "issuer_token"
  | "curated_alias";

/** Curated parent → domain rule used for high-confidence propagation. */
export interface ParentDomainRule {
  id: string;
  parentOrg: string;
  domain: string;
  website: string;
  confidence: number;
  /** Normalized parent organization names (exact match). */
  parentNames: string[];
  /** Normalized entity tokens — must appear in org name fields. */
  entityTokens: string[];
  /** When set, org geography must overlap one of these states. */
  states?: string[];
  /** National carriers — no state required when matched via parent name or national token. */
  national?: boolean;
  /** Normalized tokens that disqualify this rule when present. */
  excludeTokens?: string[];
}

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

/** Hand-curated national carrier parent rules — explicit tokens only, no fuzzy matching. */
const NATIONAL_PARENT_RULES: ParentDomainRule[] = [
  rule({
    id: "parent-uhc",
    parentOrg: "UnitedHealth Group",
    domain: "uhc.com",
    website: "https://www.uhc.com",
    confidence: 0.92,
    national: true,
    parentNames: ["unitedhealth group", "unitedhealth group incorporated", "unitedhealth"],
    entityTokens: ["unitedhealthcare", "united healthcare", "uhc"],
    excludeTokens: ["optum"],
  }),
  rule({
    id: "parent-aetna",
    parentOrg: "CVS Health",
    domain: "aetna.com",
    website: "https://www.aetna.com",
    confidence: 0.91,
    national: true,
    parentNames: ["cvs health", "cvs health corporation"],
    entityTokens: ["aetna"],
  }),
  rule({
    id: "parent-cigna",
    parentOrg: "The Cigna Group",
    domain: "cigna.com",
    website: "https://www.cigna.com",
    confidence: 0.91,
    national: true,
    parentNames: ["the cigna group", "cigna group", "cigna corporation"],
    entityTokens: ["cigna healthcare", "cigna health", "cigna"],
    excludeTokens: ["express scripts"],
  }),
  rule({
    id: "parent-express-scripts",
    parentOrg: "The Cigna Group",
    domain: "express-scripts.com",
    website: "https://www.express-scripts.com",
    confidence: 0.9,
    national: true,
    entityTokens: ["express scripts"],
  }),
  rule({
    id: "parent-humana",
    parentOrg: "Humana Inc.",
    domain: "humana.com",
    website: "https://www.humana.com",
    confidence: 0.92,
    national: true,
    parentNames: ["humana inc", "humana incorporated"],
    entityTokens: ["humana"],
  }),
  rule({
    id: "parent-elevance",
    parentOrg: "Elevance Health, Inc.",
    domain: "elevancehealth.com",
    website: "https://www.elevancehealth.com",
    confidence: 0.9,
    national: true,
    parentNames: ["elevance health", "elevance health inc", "wellpoint", "wellpoint inc"],
    entityTokens: ["elevance health"],
  }),
  rule({
    id: "parent-kaiser",
    parentOrg: "Kaiser Foundation Health Plan, Inc.",
    domain: "kp.org",
    website: "https://www.kp.org",
    confidence: 0.92,
    national: true,
    parentNames: [
      "kaiser foundation health plan",
      "kaiser foundation health plan inc",
      "kaiser permanente",
    ],
    entityTokens: ["kaiser permanente", "kaiser foundation"],
  }),
  rule({
    id: "parent-centene",
    parentOrg: "Centene Corporation",
    domain: "centene.com",
    website: "https://www.centene.com",
    confidence: 0.91,
    national: true,
    parentNames: ["centene corporation", "centene corp"],
    entityTokens: ["centene"],
    excludeTokens: ["wellcare"],
  }),
  rule({
    id: "parent-wellcare",
    parentOrg: "Centene Corporation",
    domain: "wellcare.com",
    website: "https://www.wellcare.com",
    confidence: 0.9,
    national: true,
    entityTokens: ["wellcare"],
  }),
  rule({
    id: "parent-molina",
    parentOrg: "Molina Healthcare, Inc.",
    domain: "molinahealthcare.com",
    website: "https://www.molinahealthcare.com",
    confidence: 0.91,
    national: true,
    parentNames: ["molina healthcare", "molina healthcare inc"],
    entityTokens: ["molina healthcare", "molina health"],
  }),
  rule({
    id: "parent-florida-blue",
    parentOrg: "Guidewell Mutual Holding Corporation",
    domain: "floridablue.com",
    website: "https://www.floridablue.com",
    confidence: 0.91,
    national: true,
    parentNames: [
      "guidewell mutual holding corporation",
      "guidewell",
      "florida blue",
    ],
    entityTokens: ["florida blue", "blue cross blue shield of florida"],
  }),
];

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

  for (const r of [...NATIONAL_PARENT_RULES, ...fromDirectory]) {
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
