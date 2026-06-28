import { sourceStamp } from "@/lib/discovery/connector";
import {
  finalizeOrganization,
  stripCorporateSuffix,
  type Organization,
} from "@/lib/discovery/organization";
import type { ErisaCardIntel, ErisaCsvRow } from "./types";
import { buildErisaTags } from "./tags";
import { ERISA_CONNECTOR_ID, ERISA_SOURCE_NAME } from "./types";

const STATE_REGIONS: Record<string, string[]> = {
  PA: ["mid-atlantic", "northeast"],
  OH: ["midwest", "great-lakes"],
  CA: ["west"],
  TX: ["southwest", "south"],
  FL: ["southeast", "south"],
  NY: ["northeast", "mid-atlantic"],
  NJ: ["mid-atlantic", "northeast"],
  IL: ["midwest", "great-lakes"],
};

export function erisaOrganizationId(ein: string): string {
  return `${ERISA_CONNECTOR_ID}-${ein}`;
}

export function filingKeyForRow(row: ErisaCsvRow): string {
  return `${row.sponsorEin}-${row.planNumber ?? "001"}-${row.filingYear}`;
}

export function normalizeSponsorNameKey(name: string, state: string | null): string {
  const base = stripCorporateSuffix(name);
  return state ? `${base}|${state.toUpperCase()}` : base;
}

function headquarters(city: string | null, state: string | null): string | null {
  if (city && state) return `${city}, ${state}`;
  if (state) return state;
  if (city) return city;
  return null;
}

/** Build card intelligence from the latest filing snapshot. */
export function buildErisaCardIntel(
  row: ErisaCsvRow,
  tags: string[],
): ErisaCardIntel {
  return {
    participantCount: row.participantCount ?? undefined,
    sponsorState: row.sponsorState ?? undefined,
    planName: row.planName ?? undefined,
    healthWelfarePlan: row.healthWelfarePlan,
    fundingArrangement: row.fundingArrangement,
    latestFilingYear: row.filingYear,
    selfFunded: row.selfFunded,
    tags,
    sourceLabel: "ERISA Form 5500",
  };
}

/** Normalize a Form 5500 CSV row into a canonical Organization. */
export function organizationFromErisaRow(
  row: ErisaCsvRow,
  existing?: Organization,
): Organization {
  const tags = buildErisaTags(row);
  const mergedTags = existing?.tags
    ? [...new Set([...existing.tags, ...tags])]
    : tags;
  const aliases = new Set(existing?.aliases ?? []);
  if (row.planName) aliases.add(row.planName);

  const states = new Set(existing?.states ?? []);
  if (row.sponsorState) states.add(row.sponsorState);

  const regions = new Set(existing?.regions ?? []);
  if (row.sponsorState) {
    for (const r of STATE_REGIONS[row.sponsorState] ?? []) regions.add(r);
  }

  const sourceId = filingKeyForRow(row);
  const org: Organization = finalizeOrganization({
    id: existing?.id ?? erisaOrganizationId(row.sponsorEin),
    canonicalName: existing?.canonicalName ?? row.sponsorName,
    aliases: [...aliases],
    website: existing?.website ?? null,
    domain: existing?.domain ?? null,
    organizationType: "employer",
    industries: [],
    sectorId: null,
    headquarters:
      existing?.headquarters ?? headquarters(row.sponsorCity, row.sponsorState),
    locations: existing?.locations ?? [],
    states: [...states],
    regions: regions.size > 0 ? [...regions] : ["national"],
    ownership: existing?.ownership ?? "private",
    employeeRange: existing?.employeeRange ?? null,
    memberEstimate:
      row.participantCount ?? existing?.memberEstimate ?? null,
    revenueRange: existing?.revenueRange ?? null,
    description:
      existing?.description ??
      (row.planName ? `ERISA plan sponsor — ${row.planName}` : null),
    sources: [
      sourceStamp(ERISA_CONNECTOR_ID, sourceId, [
        "ERISA Form 5500 filing",
        row.selfFunded ? "Self-funded plan" : "Insured plan",
        row.healthWelfarePlan ? "Health & welfare benefits" : "Retirement/benefits plan",
      ], {
        sourceName: ERISA_SOURCE_NAME,
        sourceUrl: "https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/public-disclosure/foia/form-5500-datasets",
        lastUpdated: String(row.filingYear),
        confidence: 0.88,
      }),
      ...(existing?.sources.filter((s) => s.connector !== ERISA_CONNECTOR_ID) ??
        []),
    ],
    buyerPack: "employers",
    canonicalOrganizationType: "employer",
    tags: mergedTags,
    erisaIntel: buildErisaCardIntel(row, mergedTags),
  });

  return org;
}

/** Attach latest ERISA intel onto an organization (for indexed search). */
export function withLatestErisaIntel(
  org: Organization,
  row: ErisaCsvRow,
): Organization {
  const next = organizationFromErisaRow(row, org);
  return {
    ...next,
    erisaIntel: buildErisaCardIntel(row, next.tags ?? buildErisaTags(row)),
  };
}
