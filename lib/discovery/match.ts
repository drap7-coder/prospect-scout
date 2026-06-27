import type { Organization } from "./organization";
import type { SearchIntent } from "./intent";
import type { CatalogRecord } from "./catalog/types";

/** Crosswalk: taxonomy industry id → equivalent catalog industry ids. */
export const INDUSTRY_EQUIVALENTS: Record<string, string[]> = {
  "life-sciences": [
    "life-sciences",
    "pharma-manufacturing",
    "medical-device-manufacturing",
  ],
  "pharma-manufacturing": ["pharma-manufacturing", "life-sciences"],
  "medical-device-manufacturing": [
    "medical-device-manufacturing",
    "life-sciences",
  ],
  providers: ["providers", "hospitals", "payers"],
  hospitals: ["hospitals", "providers"],
  nonprofit: ["nonprofit", "hospitals"],
  universities: ["universities", "community-colleges"],
};

/** Sector equivalents for cross-sector discovery (e.g. pharma in healthcare + manufacturing). */
export const SECTOR_EQUIVALENTS: Record<string, string[]> = {
  healthcare: ["healthcare", "manufacturing"],
  manufacturing: ["manufacturing", "healthcare"],
};

export function expandIndustryIds(industryId: string | null): string[] {
  if (!industryId) return [];
  return INDUSTRY_EQUIVALENTS[industryId] ?? [industryId];
}

export function expandSectorIds(sectorId: string | null): string[] {
  if (!sectorId) return [];
  return SECTOR_EQUIVALENTS[sectorId] ?? [sectorId];
}

export function intentIndustryIds(intent: SearchIntent): string[] {
  const ids = new Set<string>();
  for (const id of expandIndustryIds(intent.industryId)) ids.add(id);
  for (const alt of intent.alternateIndustryIds ?? []) {
    for (const id of expandIndustryIds(alt)) ids.add(id);
  }
  return [...ids];
}

export function intentSectorIds(intent: SearchIntent): string[] {
  const ids = new Set<string>();
  if (intent.sectorId) ids.add(intent.sectorId);
  for (const alt of intent.alternateSectorIds ?? []) ids.add(alt);
  return [...ids];
}

export function orgIndustryMatches(org: Organization, industryId: string): boolean {
  const equivalents = expandIndustryIds(industryId);
  return org.industries.some((i) => equivalents.includes(i));
}

export function orgMatchesAnyIndustry(
  org: Organization,
  industryIds: string[],
): boolean {
  if (industryIds.length === 0) return true;
  return industryIds.some((id) => orgIndustryMatches(org, id));
}

export function catalogIndustryMatches(
  record: CatalogRecord,
  industryId: string,
): boolean {
  const equivalents = expandIndustryIds(industryId);
  return record.industries.some((i) => equivalents.includes(i));
}

export function catalogMatchesAnyIndustry(
  record: CatalogRecord,
  industryIds: string[],
): boolean {
  if (industryIds.length === 0) return true;
  return industryIds.some((id) => catalogIndustryMatches(record, id));
}

export function orgSectorMatches(org: Organization, intent: SearchIntent): boolean {
  const sectors = intentSectorIds(intent);
  if (sectors.length === 0) return true;
  if (!org.sectorId) return true;
  return sectors.includes(org.sectorId);
}

export function catalogSectorMatches(
  record: CatalogRecord,
  intent: SearchIntent,
): boolean {
  const sectors = intentSectorIds(intent);
  if (sectors.length === 0) return true;
  return sectors.includes(record.sectorId);
}

/** Names that should not rank for university queries. */
export const UNIVERSITY_EXCLUSION_RE =
  /\b(adult school|beauty college|cosmetology|barber|trade school|technical institute)\b/i;

/** Non-hospital org types that should not appear for hospital queries. */
export const NON_HOSPITAL_TYPES = new Set([
  "health-plan",
  "pbm",
  "health-system",
  "insurance-carrier",
  "employer",
]);
