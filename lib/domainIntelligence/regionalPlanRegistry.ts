import type { Organization } from "@/lib/discovery/organization";
import {
  confidenceLabelFromScore,
  normalizeBrandPhrase,
  normalizePrimaryDomain,
  normalizeWebsiteUrl,
} from "./normalize";
import type { DomainLookupResult } from "./types";
import { DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD } from "./types";

export type RegionalPlanType = "medicaid" | "provider-sponsored" | "regional";

/** Lane 2 — deterministic name → domain for state/regional Medicaid and provider-sponsored plans. */
export interface RegionalPlanDomainEntry {
  id: string;
  name: string;
  aliases: string[];
  /** Distinctive normalized tokens — must appear in org name fields. */
  entityTokens: string[];
  states: string[];
  domain: string;
  website: string;
  confidence: number;
  planType: RegionalPlanType;
}

function entry(
  input: Omit<RegionalPlanDomainEntry, "entityTokens"> & { entityTokens?: string[] },
): RegionalPlanDomainEntry {
  const tokens = new Set(input.entityTokens ?? []);
  tokens.add(normalizeBrandPhrase(input.name));
  for (const alias of input.aliases) tokens.add(normalizeBrandPhrase(alias));
  return {
    ...input,
    entityTokens: [...tokens].filter((t) => t.length >= 8),
  };
}

/** Curated regional plan domains — explicit tokens only, no fuzzy guessing. */
export const REGIONAL_PLAN_DOMAIN_ENTRIES: RegionalPlanDomainEntry[] = [
  // Centene Medicaid operating brands
  entry({
    id: "regional-sunshine-health",
    name: "Sunshine State Health Plan",
    aliases: ["sunshine health", "sunshine state health"],
    states: ["FL"],
    domain: "sunshinehealth.com",
    website: "https://www.sunshinehealth.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-buckeye",
    name: "Buckeye Health Plan",
    aliases: ["buckeye community health plan"],
    states: ["OH"],
    domain: "buckeyehealthplan.com",
    website: "https://www.buckeyehealthplan.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-absolute-total-care",
    name: "Absolute Total Care",
    aliases: ["absolute total care inc"],
    states: ["SC"],
    domain: "absolutetotalcare.com",
    website: "https://www.absolutetotalcare.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-peach-state",
    name: "Peach State Health Plan",
    aliases: ["peach state health"],
    states: ["GA"],
    domain: "peachstatehealth.com",
    website: "https://www.peachstatehealth.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-superior-healthplan",
    name: "Superior HealthPlan",
    aliases: ["superior health plan", "superior healthplan texas"],
    states: ["TX"],
    domain: "superiorhealthplan.com",
    website: "https://www.superiorhealthplan.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-magnolia",
    name: "Magnolia Health Plan",
    aliases: ["magnolia health"],
    states: ["MS"],
    domain: "magnoliahealthplan.com",
    website: "https://www.magnoliahealthplan.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-home-state",
    name: "Home State Health Plan",
    aliases: ["home state health"],
    states: ["MO"],
    domain: "homestatehealth.com",
    website: "https://www.homestatehealth.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-carolina-complete",
    name: "Carolina Complete Health",
    aliases: ["carolina complete health plan"],
    states: ["NC"],
    domain: "carolinacompletehealth.com",
    website: "https://www.carolinacompletehealth.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-louisiana-health-connect",
    name: "Louisiana Healthcare Connections",
    aliases: ["louisiana health connect", "louisiana healthcare connections"],
    states: ["LA"],
    domain: "louisianahealthconnect.com",
    website: "https://www.louisianahealthconnect.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-arizona-complete",
    name: "Arizona Complete Health",
    aliases: ["arizona complete health care"],
    states: ["AZ"],
    domain: "azcompletehealth.com",
    website: "https://www.azcompletehealth.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-keystone-first",
    name: "Keystone First",
    aliases: ["keystone first choice"],
    states: ["PA"],
    domain: "keystonefirstpa.com",
    website: "https://www.keystonefirstpa.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-pa-health-wellness",
    name: "Pennsylvania Health & Wellness",
    aliases: ["pa health and wellness", "pennsylvania health and wellness"],
    states: ["PA"],
    domain: "pahealthwellness.com",
    website: "https://www.pahealthwellness.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-amerihealth-caritas-pa",
    name: "AmeriHealth Caritas Pennsylvania",
    aliases: ["amerihealth caritas pa", "amerihealth caritas pennsylvania"],
    states: ["PA"],
    domain: "amerihealthcaritaspa.com",
    website: "https://www.amerihealthcaritaspa.com",
    confidence: 0.92,
    planType: "medicaid",
  }),
  entry({
    id: "regional-health-partners-plans",
    name: "Health Partners Plans",
    aliases: ["health partners plan", "healthpartners plans"],
    states: ["PA"],
    domain: "healthpartnersplans.com",
    website: "https://www.healthpartnersplans.com",
    confidence: 0.91,
    planType: "medicaid",
  }),
  entry({
    id: "regional-allwell",
    name: "Allwell",
    aliases: ["allwell health", "allwell from health net"],
    states: [],
    domain: "allwellhealth.com",
    website: "https://www.allwellhealth.com",
    confidence: 0.9,
    planType: "regional",
  }),
  // Provider-sponsored / regional
  entry({
    id: "regional-geisinger-hp",
    name: "Geisinger Health Plan",
    aliases: ["geisinger plan", "geisinger insurance"],
    states: ["PA"],
    domain: "geisinger.org",
    website: "https://www.geisinger.org/health-plan",
    confidence: 0.91,
    planType: "provider-sponsored",
  }),
  entry({
    id: "regional-upmc-hp",
    name: "UPMC Health Plan",
    aliases: ["upmc insurance", "upmc health insurance"],
    states: ["PA", "OH", "WV"],
    domain: "upmchealthplan.com",
    website: "https://www.upmchealthplan.com",
    confidence: 0.91,
    planType: "provider-sponsored",
  }),
  entry({
    id: "regional-banner-health",
    name: "Banner Health",
    aliases: ["banner health plan", "banner medicare"],
    states: ["AZ"],
    domain: "bannerhealth.com",
    website: "https://www.bannerhealth.com",
    confidence: 0.9,
    planType: "provider-sponsored",
  }),
  entry({
    id: "regional-presbyterian",
    name: "Presbyterian Healthcare Services",
    aliases: ["presbyterian health plan", "presbyterian insurance"],
    states: ["NM"],
    domain: "phs.org",
    website: "https://www.phs.org",
    confidence: 0.9,
    planType: "provider-sponsored",
  }),
  entry({
    id: "regional-capital-bc",
    name: "Capital Blue Cross",
    aliases: ["capital bc", "capital blue", "capital bluecross"],
    states: ["PA"],
    domain: "capbluecross.com",
    website: "https://www.capbluecross.com",
    confidence: 0.91,
    planType: "regional",
  }),
  entry({
    id: "regional-priority-health",
    name: "Priority Health",
    aliases: ["priorityhealth"],
    states: ["MI"],
    domain: "priorityhealth.com",
    website: "https://www.priorityhealth.com",
    confidence: 0.91,
    planType: "regional",
  }),
  entry({
    id: "regional-selecthealth",
    name: "SelectHealth",
    aliases: ["select health"],
    states: ["UT", "ID"],
    domain: "selecthealth.org",
    website: "https://selecthealth.org",
    confidence: 0.91,
    planType: "regional",
  }),
  entry({
    id: "regional-healthpartners-mn",
    name: "HealthPartners",
    aliases: ["health partners minnesota"],
    states: ["MN"],
    domain: "healthpartners.com",
    website: "https://www.healthpartners.com",
    confidence: 0.91,
    planType: "provider-sponsored",
  }),
];

function orgStates(org: Organization): string[] {
  const states = new Set<string>();
  for (const s of org.geography?.states ?? []) states.add(s.toUpperCase());
  for (const s of org.states ?? []) states.add(s.toUpperCase());
  const hq = org.headquarters ?? org.geography?.headquarters;
  if (hq) {
    const match = hq.match(/\b([A-Z]{2})\b/);
    if (match) states.add(match[1]!);
  }
  return [...states];
}

function collectNormalizedTexts(org: Organization): string[] {
  return [
    org.canonicalName,
    org.legalName,
    org.displayName,
    org.parentDisplayName,
    ...org.aliases,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => normalizeBrandPhrase(value));
}

function statesCompatible(org: Organization, entry: RegionalPlanDomainEntry): boolean {
  if (!entry.states.length) return true;
  const orgSt = orgStates(org);
  if (orgSt.length === 0) return false;
  return orgSt.some((s) => entry.states.includes(s));
}

function matchesEntry(org: Organization, plan: RegionalPlanDomainEntry, texts: string[]): boolean {
  if (!statesCompatible(org, plan)) return false;
  const haystack = texts.join(" ");
  for (const token of plan.entityTokens) {
    if (token.length >= 8 && haystack.includes(token)) return true;
  }
  return false;
}

/**
 * Resolve domain from the regional plan registry.
 * Returns null when no match or when multiple domains would apply.
 */
export function resolveRegionalPlanDomain(org: Organization): DomainLookupResult | null {
  const texts = collectNormalizedTexts(org);
  const matches = REGIONAL_PLAN_DOMAIN_ENTRIES.filter((plan) =>
    matchesEntry(org, plan, texts),
  );

  if (matches.length === 0) return null;

  const domains = new Set(matches.map((m) => m.domain));
  if (domains.size !== 1) return null;

  const best = matches.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
  if (best.confidence < DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD) return null;

  const website = normalizeWebsiteUrl(best.website);
  const domain = normalizePrimaryDomain({ website: website ?? best.website, domain: best.domain });
  if (!website || !domain) return null;

  return {
    website,
    domain,
    source: "regional_plan_registry",
    confidence: best.confidence,
    confidenceLabel: confidenceLabelFromScore(best.confidence),
    matchMethod: "regional_plan_registry",
    matchedRule: best.id,
  };
}

export function buildRegionalPlanRegistryIndex(): Map<string, RegionalPlanDomainEntry[]> {
  const byToken = new Map<string, RegionalPlanDomainEntry[]>();
  for (const plan of REGIONAL_PLAN_DOMAIN_ENTRIES) {
    for (const token of plan.entityTokens) {
      const bucket = byToken.get(token) ?? [];
      bucket.push(plan);
      byToken.set(token, bucket);
    }
  }
  return byToken;
}
