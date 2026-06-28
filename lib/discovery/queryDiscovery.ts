import type { Organization } from "./organization";
import { stripCorporateSuffix } from "./organization";
import type { SearchIntent } from "./intent";

const INDUSTRY_QUERY_TERMS: Record<string, string[]> = {
  "life-sciences": [
    "pharma",
    "pharmaceutical",
    "biotech",
    "biologic",
    "therapeutic",
    "drug",
    "medicine",
    "vaccine",
    "oncology",
  ],
  "pharma-manufacturing": [
    "pharma",
    "pharmaceutical",
    "biotech",
    "therapeutic",
    "drug",
  ],
  payers: ["health plan", "insurer", "payer", "medicare", "medicaid", "mco"],
  providers: ["hospital", "health system", "clinic", "medical center"],
  "food-beverage": ["food", "beverage", "nutrition", "dairy", "snack"],
  "industrial-products": ["manufactur", "industrial", "factory", "plant"],
};

const GENERIC_QUERY_STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "company",
  "companies",
  "organization",
  "organizations",
  "manufacturer",
  "manufacturers",
  "manufacturing",
]);

function orgSearchHaystack(org: Organization): string {
  return [org.canonicalName, ...org.aliases, org.description ?? ""]
    .join(" ")
    .toLowerCase();
}

function queryTerms(intent: SearchIntent): string[] {
  const terms = new Set<string>();
  for (const kw of intent.keywords) {
    if (kw.length >= 3 && !GENERIC_QUERY_STOP.has(kw)) terms.add(kw);
  }
  for (const token of intent.query.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (token.length >= 3 && !GENERIC_QUERY_STOP.has(token)) terms.add(token);
  }
  if (intent.industryId) {
    for (const t of INDUSTRY_QUERY_TERMS[intent.industryId] ?? []) terms.add(t);
  }
  for (const alt of intent.alternateIndustryIds) {
    for (const t of INDUSTRY_QUERY_TERMS[alt] ?? []) terms.add(t);
  }
  if (/\bpharma\b|\bpharmaceutical\b/i.test(intent.query)) {
    for (const t of INDUSTRY_QUERY_TERMS["life-sciences"] ?? []) terms.add(t);
  }
  return [...terms];
}

/** True when org name/aliases match significant query or industry terms. */
export function organizationMatchesQueryText(
  org: Organization,
  intent: SearchIntent,
): boolean {
  const terms = queryTerms(intent);
  if (terms.length === 0) return false;
  const hay = orgSearchHaystack(org);
  return terms.some((term) => hay.includes(term));
}

/** Filter organizations to those matching query text (for connector-level discovery). */
export function filterOrganizationsByQueryText(
  orgs: Organization[],
  intent: SearchIntent,
): Organization[] {
  const terms = queryTerms(intent);
  if (terms.length === 0) return [];
  return orgs.filter((org) => organizationMatchesQueryText(org, intent));
}

/** Fuzzy name equality for merge (stripped corporate suffix). */
export function exactNameKey(org: Organization): string {
  return stripCorporateSuffix(org.canonicalName);
}
