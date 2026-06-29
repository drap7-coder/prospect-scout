import type { Organization } from "@/lib/discovery/organization";
import { confidenceLabelFromScore, normalizeBrandPhrase } from "./normalize";
import { buildParentDomainRules, type ParentDomainRule, type ParentMatchSignal } from "./parentMappings";
import { collectOrgNameTexts, resolveOrgStates } from "./stateInference";
import type { DomainLookupResult } from "./types";
import { DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD } from "./types";

function orgStates(org: Organization, texts: string[]): string[] {
  return resolveOrgStates(org, texts);
}

function collectNormalizedTexts(org: Organization): string[] {
  return collectOrgNameTexts(org).map((value) => normalizeBrandPhrase(value));
}

function statesCompatible(org: Organization, rule: ParentDomainRule, texts: string[]): boolean {
  if (rule.national) return true;
  const orgSt = orgStates(org, texts);
  if (!rule.states?.length) return true;
  if (orgSt.length === 0) return false;
  return orgSt.some((s) => rule.states!.includes(s));
}

function hasExcludedToken(texts: string[], rule: ParentDomainRule): boolean {
  if (!rule.excludeTokens?.length) return false;
  const haystack = texts.join(" ");
  return rule.excludeTokens.some((token) => haystack.includes(token));
}

interface RuleMatch {
  rule: ParentDomainRule;
  signal: ParentMatchSignal;
  matchedRule: string;
}

function matchParentDisplayName(
  org: Organization,
  rule: ParentDomainRule,
  texts: string[],
): RuleMatch | null {
  const parent = org.parentDisplayName?.trim();
  if (!parent) return null;
  const normalized = normalizeBrandPhrase(parent);
  if (!rule.parentNames.includes(normalized)) return null;
  if (!statesCompatible(org, rule, texts) && !rule.national) return null;
  if (hasExcludedToken(texts, rule)) return null;
  return {
    rule,
    signal: "parent_display_name",
    matchedRule: `parent_display_name:${normalized}`,
  };
}

const DISTINCTIVE_BRAND_TOKENS = new Set([
  "uhc",
  "aetna",
  "cigna",
  "humana",
  "centene",
  "wellcare",
  "molina",
  "kaiser",
  "anthem",
  "elevance",
  "optum",
  "evernorth",
]);

function tokenMatches(haystack: string, token: string): boolean {
  if (DISTINCTIVE_BRAND_TOKENS.has(token)) return haystack.includes(token);
  if (token.length < 8) return false;
  return haystack.includes(token);
}

function matchEntityTokens(
  org: Organization,
  rule: ParentDomainRule,
  texts: string[],
): RuleMatch | null {
  if (!rule.entityTokens.length) return null;
  if (hasExcludedToken(texts, rule)) return null;

  const haystack = texts.join(" ");
  for (const token of rule.entityTokens) {
    if (!tokenMatches(haystack, token)) continue;
    if (!rule.national && rule.states?.length) {
      if (!statesCompatible(org, rule, texts)) continue;
    }
    return {
      rule,
      signal: "legal_entity_token",
      matchedRule: `legal_entity_token:${token}`,
    };
  }
  return null;
}

function matchRule(org: Organization, rule: ParentDomainRule): RuleMatch | null {
  const texts = collectNormalizedTexts(org);
  return matchParentDisplayName(org, rule, texts) ?? matchEntityTokens(org, rule, texts);
}

function toLookupResult(match: RuleMatch): DomainLookupResult {
  const { rule, signal, matchedRule } = match;
  const confidence =
    signal === "parent_display_name"
      ? Math.max(rule.confidence, 0.9)
      : rule.confidence;

  return {
    website: rule.website,
    domain: rule.domain,
    source: "parent_propagation",
    confidence,
    confidenceLabel: confidenceLabelFromScore(confidence),
    matchMethod: signal,
    parentOrg: rule.parentOrg,
    matchedRule,
  };
}

/**
 * Resolve domain by inheriting from a known parent organization.
 * Returns null when parent is ambiguous or confidence is below threshold.
 */
export function resolveParentOrganizationDomain(org: Organization): DomainLookupResult | null {
  const rules = buildParentDomainRules();
  const matches: RuleMatch[] = [];

  for (const rule of rules) {
    const match = matchRule(org, rule);
    if (match) matches.push(match);
  }

  if (matches.length === 0) return null;

  const domains = new Set(matches.map((m) => m.rule.domain));
  if (domains.size > 1) return null;

  const best = matches.reduce((a, b) =>
    a.rule.confidence >= b.rule.confidence ? a : b,
  );

  const result = toLookupResult(best);
  if (result.confidence < DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD) return null;
  return result;
}
