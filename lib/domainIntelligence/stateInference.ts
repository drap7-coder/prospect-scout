import type { Organization } from "@/lib/discovery/organization";
import { normalizeBrandPhrase } from "./normalize";

/** Strong "of {state}" phrases — conservative inference only. */
const NAME_STATE_PHRASES: ReadonlyArray<{ phrase: string; state: string }> = [
  { phrase: "of alabama", state: "AL" },
  { phrase: "of rhode island", state: "RI" },
  { phrase: "of alaska", state: "AK" },
  { phrase: "of california", state: "CA" },
  { phrase: "of minnesota", state: "MN" },
  { phrase: "of michigan", state: "MI" },
  { phrase: "of texas", state: "TX" },
  { phrase: "of wisconsin", state: "WI" },
  { phrase: "of missouri", state: "MO" },
  { phrase: "of arkansas", state: "AR" },
  { phrase: "of indiana", state: "IN" },
  { phrase: "of maryland", state: "MD" },
  { phrase: "of virginia", state: "VA" },
  { phrase: "of louisiana", state: "LA" },
  { phrase: "of north carolina", state: "NC" },
  { phrase: "of south carolina", state: "SC" },
  { phrase: "of illinois", state: "IL" },
  { phrase: "of oklahoma", state: "OK" },
  { phrase: "of new mexico", state: "NM" },
  { phrase: "of montana", state: "MT" },
  { phrase: "of arizona", state: "AZ" },
  { phrase: "of florida", state: "FL" },
  { phrase: "of pennsylvania", state: "PA" },
  { phrase: "of new york", state: "NY" },
  { phrase: "of massachusetts", state: "MA" },
  { phrase: "of hawaii", state: "HI" },
  { phrase: "of new hampshire", state: "NH" },
];

export function collectOrgNameTexts(org: Organization): string[] {
  return [
    org.canonicalName,
    org.legalName,
    org.displayName,
    org.parentDisplayName,
    ...org.aliases,
  ].filter((value): value is string => Boolean(value?.trim()));
}

/** Infer US state codes from strong legal/name phrases when geography is absent. */
export function inferStatesFromOrgText(texts: string[]): string[] {
  const states = new Set<string>();
  for (const raw of texts) {
    const normalized = normalizeBrandPhrase(raw);
    for (const { phrase, state } of NAME_STATE_PHRASES) {
      if (normalized.includes(phrase)) states.add(state);
    }
  }
  return [...states];
}

/**
 * Resolve organization states from explicit geography, then conservative name inference.
 * Name inference applies only when no explicit state geography exists.
 */
export function resolveOrgStates(org: Organization, texts?: string[]): string[] {
  const states = new Set<string>();
  for (const s of org.geography?.states ?? []) states.add(s.toUpperCase());
  for (const s of org.states ?? []) states.add(s.toUpperCase());

  const hq = org.headquarters ?? org.geography?.headquarters;
  if (hq) {
    const match = hq.match(/\b([A-Z]{2})\b/);
    if (match) states.add(match[1]!);
  }

  if (states.size === 0) {
    const source = texts ?? collectOrgNameTexts(org);
    for (const inferred of inferStatesFromOrgText(source)) states.add(inferred);
  }

  return [...states];
}
