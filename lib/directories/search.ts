import type { BuyerPackId } from "@/lib/search/types";
import { inferTaxonomyFromQuery } from "@/lib/taxonomy";
import { EDUCATION_DIRECTORY } from "./education";
import { EMPLOYERS_DIRECTORY } from "./employers";
import { FINANCIAL_SERVICES_DIRECTORY } from "./financialServices";
import { HEALTH_PLANS_DIRECTORY } from "./healthPlans";
import { getHealthPlanDirectoryRecords } from "@/lib/import/healthPlans/discoverySource";
import { shouldUsePersistentHealthPlanCatalog } from "@/lib/import/healthPlans/featureFlag";
import { HEALTH_SYSTEMS_DIRECTORY } from "./healthSystems";
import { MANUFACTURERS_DIRECTORY } from "./manufacturers";
import { NONPROFITS_DIRECTORY } from "./nonprofits";
import { PUBLIC_SECTOR_DIRECTORY } from "./publicSector";
import { RETAIL_CONSUMER_DIRECTORY } from "./retailConsumer";
import { TECHNOLOGY_DIRECTORY } from "./technology";
import type {
  DirectoryOrganizationType,
  DirectorySearchCriteria,
  DirectorySearchMatch,
  OrganizationRecord,
} from "./types";
import { normalizeDirectoryRecord } from "./types";

const STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

const REGION_ALIASES: Record<string, string[]> = {
  midwest: ["midwest", "great-lakes", "upper-midwest"],
  "mid-west": ["midwest", "great-lakes", "upper-midwest"],
  northeast: ["northeast", "mid-atlantic", "new-england"],
  southeast: ["southeast", "south"],
  southwest: ["southwest"],
  west: ["west"],
  national: ["national"],
  "mid-atlantic": ["mid-atlantic", "northeast"],
};

const ORG_TYPE_PHRASES: Record<string, DirectoryOrganizationType> = {
  "health plan": "health-plan",
  "health plans": "health-plan",
  "health system": "health-system",
  "health systems": "health-system",
  manufacturer: "manufacturer",
  manufacturers: "manufacturer",
  employer: "employer",
  employers: "employer",
};

const PROGRAM_PHRASES: Record<string, keyof DirectorySearchCriteria> = {
  commercial: "commercial",
  medicare: "medicare",
  medicaid: "medicaid",
  exchange: "exchange",
  aso: "aso",
  tpa: "tpa",
};

export function getDirectoryForPack(pack: BuyerPackId): OrganizationRecord[] {
  switch (pack) {
    case "health-plans":
      return getHealthPlanDirectoryRecords();
    case "health-systems":
      return HEALTH_SYSTEMS_DIRECTORY.map(normalizeDirectoryRecord);
    case "manufacturers":
      return MANUFACTURERS_DIRECTORY.map(normalizeDirectoryRecord);
    case "employers":
      return [
        ...EMPLOYERS_DIRECTORY,
        ...FINANCIAL_SERVICES_DIRECTORY,
        ...EDUCATION_DIRECTORY,
        ...RETAIL_CONSUMER_DIRECTORY,
        ...TECHNOLOGY_DIRECTORY,
        ...NONPROFITS_DIRECTORY,
      ].map(normalizeDirectoryRecord);
    case "public-sector":
      return PUBLIC_SECTOR_DIRECTORY.map(normalizeDirectoryRecord);
    default:
      return [];
  }
}

export function getAllDirectoryRecords(): OrganizationRecord[] {
  const healthPlanRecords = shouldUsePersistentHealthPlanCatalog()
    ? []
    : HEALTH_PLANS_DIRECTORY.map(normalizeDirectoryRecord);

  return [
    ...healthPlanRecords,
    ...HEALTH_SYSTEMS_DIRECTORY,
    ...MANUFACTURERS_DIRECTORY,
    ...EMPLOYERS_DIRECTORY,
    ...PUBLIC_SECTOR_DIRECTORY,
    ...FINANCIAL_SERVICES_DIRECTORY,
    ...EDUCATION_DIRECTORY,
    ...RETAIL_CONSUMER_DIRECTORY,
    ...TECHNOLOGY_DIRECTORY,
    ...NONPROFITS_DIRECTORY,
  ].map(normalizeDirectoryRecord);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s&/-]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value).split(" ").filter(Boolean);
}

export function inferStateFromQuery(query: string): string | undefined {
  const norm = normalizeText(query);
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (norm.includes(name)) return code;
  }
  const tokens = tokenize(query);
  for (const token of tokens) {
    if (/^[a-z]{2}$/i.test(token) && Object.values(STATE_NAMES).includes(token.toUpperCase())) {
      return token.toUpperCase();
    }
  }
  return undefined;
}

export function inferRegionFromQuery(query: string): string | undefined {
  const norm = normalizeText(query);
  for (const [phrase, regions] of Object.entries(REGION_ALIASES)) {
    if (norm.includes(phrase)) return regions[0];
  }
  if (norm.includes("blues") && norm.includes("midwest")) return "midwest";
  return undefined;
}

function inferOrgTypeFromQuery(query: string): DirectoryOrganizationType | undefined {
  const norm = normalizeText(query);
  for (const [phrase, type] of Object.entries(ORG_TYPE_PHRASES)) {
    if (norm.includes(phrase)) return type;
  }
  return undefined;
}

function inferProgramFlags(query: string): Partial<DirectorySearchCriteria> {
  const norm = normalizeText(query);
  const flags: Partial<DirectorySearchCriteria> = {};
  for (const [phrase, key] of Object.entries(PROGRAM_PHRASES)) {
    if (norm.includes(phrase)) {
      (flags as Record<string, boolean>)[key] = true;
    }
  }
  return flags;
}

function recordMatchesProgram(
  record: OrganizationRecord,
  key: keyof DirectorySearchCriteria,
): boolean {
  if (key === "commercial") return record.commercial === true;
  if (key === "medicare") return record.medicare === true;
  if (key === "medicaid") return record.medicaid === true;
  if (key === "exchange") return record.exchange === true;
  if (key === "aso") return record.aso === true;
  if (key === "tpa") return record.tpa === true;
  return true;
}

function searchableStrings(record: OrganizationRecord): string[] {
  return [
    record.name,
    record.parentOrganization ?? "",
    ...record.aliases,
    ...(record.tags ?? []),
    record.headquarters,
    ...record.statesServed,
    ...record.regions,
  ].map(normalizeText);
}

function scoreNameMatch(record: OrganizationRecord, query: string): DirectorySearchMatch | null {
  const normQuery = normalizeText(query);
  if (!normQuery) return null;

  const nameNorm = normalizeText(record.name);
  if (nameNorm === normQuery) {
    return { record, score: 100, matchedOn: record.name };
  }

  for (const alias of record.aliases) {
    if (normalizeText(alias) === normQuery) {
      return { record, score: 95, matchedOn: alias };
    }
  }

  if (nameNorm.includes(normQuery) || normQuery.includes(nameNorm)) {
    return { record, score: 85, matchedOn: record.name };
  }

  for (const alias of record.aliases) {
    const aliasNorm = normalizeText(alias);
    if (aliasNorm.includes(normQuery) || normQuery.includes(aliasNorm)) {
      return { record, score: 80, matchedOn: alias };
    }
  }

  const queryTokens = tokenize(query).filter((t) => t.length >= 2);
  if (queryTokens.length === 0) return null;

  const corpus = searchableStrings(record).join(" ");
  const matchedTokens = queryTokens.filter((t) => corpus.includes(t));
  if (matchedTokens.length === 0) return null;

  const coverage = matchedTokens.length / queryTokens.length;
  return {
    record,
    score: 40 + coverage * 40,
    matchedOn: matchedTokens.join(", "),
  };
}

function industryMatches(record: OrganizationRecord, industryId: string): boolean {
  if (record.industryId === industryId) return true;
  if (industryId === "life-sciences" && record.industryId === "medical-device-manufacturing") {
    return true;
  }
  if (industryId === "medical-device-manufacturing" && record.industryId === "life-sciences") {
    return true;
  }
  return false;
}

function passesFilters(
  record: OrganizationRecord,
  criteria: DirectorySearchCriteria,
): boolean {
  const normalized = normalizeDirectoryRecord(record);

  if (criteria.organizationType && normalized.organizationType !== criteria.organizationType) {
    return false;
  }

  if (criteria.organizationTypeId && normalized.organizationTypeId !== criteria.organizationTypeId) {
    return false;
  }

  if (criteria.industryId && !industryMatches(normalized, criteria.industryId)) {
    return false;
  }

  if (criteria.sectorId && normalized.sectorId !== criteria.sectorId) {
    return false;
  }

  if (criteria.state && !normalized.statesServed.includes(criteria.state)) {
    return false;
  }

  if (criteria.region) {
    const regionNorm = normalizeText(criteria.region);
    const regionSet = REGION_ALIASES[regionNorm] ?? [regionNorm];
    const recordRegions = normalized.regions.map(normalizeText);
    if (!regionSet.some((r) => recordRegions.includes(r))) {
      return false;
    }
  }

  for (const key of ["commercial", "medicare", "medicaid", "exchange", "aso", "tpa"] as const) {
    if (criteria[key] === true && !recordMatchesProgram(normalized, key)) {
      return false;
    }
  }

  return true;
}

function isGeographicListingQuery(criteria: DirectorySearchCriteria): boolean {
  const norm = normalizeText(criteria.query);
  const hasGeo =
    Boolean(criteria.state) ||
    Boolean(criteria.region) ||
    Boolean(inferStateFromQuery(criteria.query)) ||
    Boolean(inferRegionFromQuery(criteria.query));
  const hasOrgType =
    Boolean(criteria.organizationType) ||
    Boolean(criteria.industryId) ||
    /health plan|health plans|blues|manufacturer|employer|health system|municipal|universit|bank|food|packaging|device/.test(
      norm,
    );
  return hasGeo && hasOrgType;
}

function inferIndustryFromQueryKeywords(query: string): string | undefined {
  const norm = normalizeText(query);
  if (/packaging|packager/.test(norm)) return "packaging";
  if (/food|beverage|snack|cpg food/.test(norm)) return "food-beverage";
  if (/medical device|medtech|device maker/.test(norm)) return "medical-device-manufacturing";
  if (/pharma|pharmaceutical|biotech/.test(norm)) return "life-sciences";
  if (/chemical|specialty chemical|paint|coatings/.test(norm)) return "chemicals";
  if (/automotive|auto parts|tire|vehicle assembly/.test(norm)) return "automotive";
  if (/consumer goods|cpg|household/.test(norm)) return "consumer-goods";
  if (/industrial|machinery/.test(norm)) return "industrial-products";
  return undefined;
}

function inferOrganizationTypeFromQueryKeywords(query: string): string | undefined {
  const norm = normalizeText(query);
  if (/medical device|medtech/.test(norm)) return "medical-device";
  if (/packaging/.test(norm)) return "packaging-company";
  if (/food|beverage/.test(norm)) return "food-beverage-company";
  return undefined;
}

function isGenericManufacturerQuery(query: string): boolean {
  const norm = normalizeText(query);
  return (
    /manufacturer/.test(norm) &&
    !/food|beverage|packaging|device|pharma|pharmaceutical|chemical|automotive|auto parts|tire|consumer goods|cpg|industrial machinery/.test(
      norm,
    )
  );
}

function taxonomyFiltersFromQuery(
  query: string,
  taxonomy: ReturnType<typeof inferTaxonomyFromQuery>,
): Pick<DirectorySearchCriteria, "sectorId" | "industryId" | "organizationTypeId"> {
  const keywordIndustry = inferIndustryFromQueryKeywords(query);
  const keywordOrgType = inferOrganizationTypeFromQueryKeywords(query);

  if (keywordIndustry || keywordOrgType) {
    return {
      sectorId: taxonomy.sectorId,
      industryId: keywordIndustry ?? taxonomy.industryId,
      organizationTypeId: keywordOrgType ?? taxonomy.organizationTypeId,
    };
  }

  if (isGenericManufacturerQuery(query)) {
    return {};
  }
  return {
    sectorId: taxonomy.sectorId,
    industryId: taxonomy.industryId,
    organizationTypeId: taxonomy.organizationTypeId,
  };
}

function isBluesQuery(query: string): boolean {
  const norm = normalizeText(query);
  return norm.includes("blues") || norm.includes("blue cross") || norm.includes("bcbs");
}

/**
 * Search the master directory for organizations matching criteria.
 * Geographic + org-type queries return the full filtered set (e.g. "Pennsylvania health plans").
 */
export function searchDirectory(criteria: DirectorySearchCriteria): DirectorySearchMatch[] {
  const pool = getDirectoryForPack(criteria.buyerPack);
  if (pool.length === 0) return [];

  const taxonomy = inferTaxonomyFromQuery(criteria.query);
  const taxonomyFilters = taxonomyFiltersFromQuery(criteria.query, taxonomy);

  const enriched: DirectorySearchCriteria = {
    ...criteria,
    state: criteria.state ?? inferStateFromQuery(criteria.query),
    region: criteria.region ?? inferRegionFromQuery(criteria.query),
    sectorId: criteria.sectorId ?? taxonomyFilters.sectorId,
    industryId: criteria.industryId ?? taxonomyFilters.industryId,
    organizationTypeId: criteria.organizationTypeId ?? taxonomyFilters.organizationTypeId,
    organizationType:
      criteria.organizationType ??
      inferOrgTypeFromQuery(criteria.query) ??
      (criteria.buyerPack === "health-plans"
        ? "health-plan"
        : criteria.buyerPack === "health-systems"
          ? "health-system"
          : criteria.buyerPack === "manufacturers"
            ? "manufacturer"
            : criteria.buyerPack === "employers"
              ? "employer"
              : criteria.buyerPack === "public-sector"
                ? "municipality"
                : undefined),
    ...inferProgramFlags(criteria.query),
  };

  const listingMode = isGeographicListingQuery(enriched);
  const bluesQuery = isBluesQuery(criteria.query);

  if (listingMode) {
    let filtered = pool.filter((record) => passesFilters(record, enriched));
    if (bluesQuery) {
      filtered = filtered.filter(
        (record) => record.tags?.includes("blues") ?? false,
      );
    }
    return filtered
      .map((record) => ({
        record,
        score: 70,
        matchedOn: enriched.state
          ? `state:${enriched.state}`
          : enriched.region
            ? `region:${enriched.region}`
            : "listing",
      }))
      .sort((a, b) => a.record.name.localeCompare(b.record.name));
  }

  const matches: DirectorySearchMatch[] = [];
  for (const record of pool) {
    if (!passesFilters(record, enriched)) continue;
    if (bluesQuery && !(record.tags?.includes("blues") ?? false)) continue;

    const nameMatch = scoreNameMatch(record, criteria.query);
    if (nameMatch) {
      matches.push(nameMatch);
      continue;
    }

    if (enriched.state || enriched.region) {
      matches.push({
        record,
        score: 55,
        matchedOn: enriched.state ? `state:${enriched.state}` : `region:${enriched.region}`,
      });
    }
  }

  const byId = new Map<string, DirectorySearchMatch>();
  for (const match of matches) {
    const existing = byId.get(match.record.id);
    if (!existing || match.score > existing.score) {
      byId.set(match.record.id, match);
    }
  }

  return [...byId.values()].sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name));
}

export function resolveOrganization(
  query: string,
  buyerPack: BuyerPackId = "health-plans",
): OrganizationRecord | undefined {
  const matches = searchDirectory({ query, buyerPack });
  return matches[0]?.record;
}
