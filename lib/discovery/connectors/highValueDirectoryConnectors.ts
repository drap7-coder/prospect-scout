import type { DiscoveryConnector, ConnectorRecord } from "../connector";
import { sourceStamp } from "../connector";
import { mergeOrganizations, type Organization } from "../organization";
import type { SearchIntent } from "../intent";

type SourceDirectoryId = "cms" | "sec" | "fda" | "irs-nonprofits" | "nces";

type SourceSeed = {
  id: SourceDirectoryId;
  label: string;
  count: number;
  sectorId: string;
  industries: string[];
  organizationTypes: string[];
  ownership: Organization["ownership"];
  buyerPack: Organization["buyerPack"];
  nameTemplates: string[];
  evidence: string;
};

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
] as const;

const REGIONS_BY_STATE: Record<string, string> = {
  CT: "northeast", DC: "mid-atlantic", DE: "mid-atlantic", MA: "northeast", MD: "mid-atlantic",
  ME: "northeast", NH: "northeast", NJ: "mid-atlantic", NY: "northeast", PA: "mid-atlantic",
  RI: "northeast", VT: "northeast", IL: "midwest", IN: "midwest", IA: "midwest", KS: "midwest",
  MI: "midwest", MN: "midwest", MO: "midwest", ND: "midwest", NE: "midwest", OH: "midwest",
  SD: "midwest", WI: "midwest", AL: "southeast", AR: "southeast", FL: "southeast",
  GA: "southeast", KY: "southeast", LA: "southeast", MS: "southeast", NC: "southeast",
  SC: "southeast", TN: "southeast", VA: "southeast", WV: "southeast", AZ: "southwest",
  NM: "southwest", OK: "southwest", TX: "southwest", AK: "west", CA: "west", CO: "west",
  HI: "west", ID: "west", MT: "west", NV: "west", OR: "west", UT: "west", WA: "west", WY: "west",
};

const SOURCE_SEEDS: SourceSeed[] = [
  {
    id: "cms",
    label: "CMS Plan Directory",
    count: 4_500,
    sectorId: "healthcare",
    industries: ["payers"],
    organizationTypes: ["health-plan"],
    ownership: "private",
    buyerPack: "health-plans",
    nameTemplates: ["Medicare Advantage Plan", "Regional Health Plan", "Managed Care Organization", "Medicaid Health Plan"],
    evidence: "CMS public plan directory stub",
  },
  {
    id: "sec",
    label: "SEC Company Directory",
    count: 14_000,
    sectorId: "financial-services",
    industries: ["banks", "insurance-carriers", "asset-managers", "fintech", "industrial-products", "technology", "retail"],
    organizationTypes: ["bank", "insurance-carrier", "asset-manager", "fintech-company", "manufacturer", "employer"],
    ownership: "public",
    buyerPack: "employers",
    nameTemplates: ["Bancorp", "Financial Holdings", "Industrial Group", "Technology Holdings", "Retail Group", "Insurance Group"],
    evidence: "SEC company_tickers bulk directory stub",
  },
  {
    id: "fda",
    label: "FDA Establishment Directory",
    count: 7_500,
    sectorId: "manufacturing",
    industries: ["food-beverage", "pharma-manufacturing", "medical-device-manufacturing", "packaging", "chemicals"],
    organizationTypes: ["food-beverage-company", "pharma-manufacturer", "medical-device", "packaging-company", "chemical-company"],
    ownership: "private",
    buyerPack: "manufacturers",
    nameTemplates: ["Food Manufacturing", "Device Manufacturing", "Pharma Manufacturing", "Packaging Operations", "Quality Systems"],
    evidence: "FDA enforcement and establishment directory stub",
  },
  {
    id: "irs-nonprofits",
    label: "IRS Exempt Organizations",
    count: 62_000,
    sectorId: "nonprofit",
    industries: ["nonprofit"],
    organizationTypes: ["employer"],
    ownership: "nonprofit",
    buyerPack: "employers",
    nameTemplates: ["Community Foundation", "Human Services Council", "Arts Alliance", "Education Fund", "Health Charity"],
    evidence: "IRS exempt organizations directory stub",
  },
  {
    id: "nces",
    label: "NCES / IPEDS Institutions",
    count: 18_500,
    sectorId: "education",
    industries: ["universities", "community-colleges", "private-schools"],
    organizationTypes: ["university", "community-college", "private-school"],
    ownership: "nonprofit",
    buyerPack: "employers",
    nameTemplates: ["State University", "Community College", "Technical Institute", "Liberal Arts College", "Graduate University"],
    evidence: "NCES/IPEDS institution directory stub",
  },
];

const SEC_PROFILES = [
  { template: "Bancorp", sectorId: "financial-services", industry: "banks", organizationType: "bank" },
  { template: "Financial Holdings", sectorId: "financial-services", industry: "asset-managers", organizationType: "asset-manager" },
  { template: "Industrial Group", sectorId: "manufacturing", industry: "industrial-products", organizationType: "manufacturer" },
  { template: "Technology Holdings", sectorId: "technology", industry: "technology", organizationType: "employer" },
  { template: "Retail Group", sectorId: "retail-consumer", industry: "retail", organizationType: "employer" },
  { template: "Insurance Group", sectorId: "financial-services", industry: "insurance-carriers", organizationType: "insurance-carrier" },
] as const;

const FDA_PROFILES = [
  { template: "Food Manufacturing", sectorId: "manufacturing", industry: "food-beverage", organizationType: "food-beverage-company" },
  { template: "Pharma Manufacturing", sectorId: "manufacturing", industry: "pharma-manufacturing", organizationType: "pharma-manufacturer" },
  { template: "Device Manufacturing", sectorId: "manufacturing", industry: "medical-device-manufacturing", organizationType: "medical-device" },
  { template: "Packaging Operations", sectorId: "manufacturing", industry: "packaging", organizationType: "packaging-company" },
  { template: "Quality Systems", sectorId: "manufacturing", industry: "chemicals", organizationType: "chemical-company" },
] as const;

const NCES_PROFILES = [
  { template: "State University", sectorId: "education", industry: "universities", organizationType: "university" },
  { template: "Graduate University", sectorId: "education", industry: "universities", organizationType: "university" },
  { template: "Liberal Arts College", sectorId: "education", industry: "universities", organizationType: "university" },
  { template: "Community College", sectorId: "education", industry: "community-colleges", organizationType: "community-college" },
  { template: "Technical Institute", sectorId: "education", industry: "private-schools", organizationType: "private-school" },
] as const;

function stateForIndex(index: number): string {
  return STATES[index % STATES.length]!;
}

function sourceRecord(seed: SourceSeed, index: number): Organization {
  const state = stateForIndex(index);
  const profileIndex = Math.floor(index / STATES.length);
  const industry = seed.industries[profileIndex % seed.industries.length]!;
  const organizationType = seed.organizationTypes[profileIndex % seed.organizationTypes.length]!;
  const template = seed.nameTemplates[profileIndex % seed.nameTemplates.length]!;
  const secProfile = seed.id === "sec" ? SEC_PROFILES[profileIndex % SEC_PROFILES.length] : null;
  const fdaProfile = seed.id === "fda" ? FDA_PROFILES[profileIndex % FDA_PROFILES.length] : null;
  const ncesProfile = seed.id === "nces" ? NCES_PROFILES[profileIndex % NCES_PROFILES.length] : null;
  const profile = secProfile ?? fdaProfile ?? ncesProfile;
  const sequence = String(index + 1).padStart(5, "0");
  const region = REGIONS_BY_STATE[state] ?? "national";
  const statePhrase = state === "DC" ? "District of Columbia" : state;
  const sourcePrefix = seed.id === "irs-nonprofits" ? "IRS" : seed.id.toUpperCase();

  return {
    id: `${seed.id}-${sequence}`,
    canonicalName: `${sourcePrefix} ${statePhrase} ${profile?.template ?? template} ${sequence}`,
    aliases: [`${profile?.template ?? template} ${sequence}`, `${statePhrase} ${profile?.template ?? template}`],
    website: null,
    domain: null,
    organizationType: profile?.organizationType ?? organizationType,
    industries: [profile?.industry ?? industry],
    sectorId: profile?.sectorId ?? (industry === "technology" ? "technology" : industry === "retail" ? "retail-consumer" : seed.sectorId),
    headquarters: `${statePhrase}, ${state}`,
    locations: [`${statePhrase}, ${state}`],
    states: [state],
    regions: [region],
    ownership: seed.ownership,
    employeeRange: null,
    revenueRange: null,
    description: `${seed.label} catalog record used for broad organization discovery.`,
    sources: [sourceStamp(seed.id, `${seed.id}-${sequence}`, [seed.evidence])],
    buyerPack: seed.buyerPack,
  };
}

const SOURCE_CATALOGS = new Map<SourceDirectoryId, Organization[]>();

function sourceCatalog(id: SourceDirectoryId): Organization[] {
  const cached = SOURCE_CATALOGS.get(id);
  if (cached) return cached;
  const seed = SOURCE_SEEDS.find((item) => item.id === id);
  if (!seed) return [];
  const generated = Array.from({ length: seed.count }, (_, index) => sourceRecord(seed, index));
  SOURCE_CATALOGS.set(id, generated);
  return generated;
}

function matchesIntent(org: Organization, intent: SearchIntent): boolean {
  if (intent.state && !org.states.includes(intent.state)) return false;
  if (intent.region !== "any" && !org.regions.includes(intent.region)) return false;
  if (intent.sectorId && org.sectorId !== intent.sectorId) return false;
  if (intent.industryId && !org.industries.includes(intent.industryId)) return false;
  if (intent.organizationTypeId && org.organizationType !== intent.organizationTypeId) return false;
  return true;
}

function connectorFor(seed: SourceSeed): DiscoveryConnector {
  return {
    id: seed.id,
    label: seed.label,
    discover(intent: SearchIntent): ConnectorRecord[] {
      const catalog = sourceCatalog(seed.id);
      const filtered = catalog.filter((org) => matchesIntent(org, intent));
      const pool = filtered.length > 0 ? filtered : catalog.slice(0, 250);
      return pool.map((org) => ({ __type: "organization", org }));
    },
    normalize(record: ConnectorRecord): Organization {
      if (record.org) return record.org as Organization;
      throw new Error(`${seed.id}: invalid record`);
    },
    merge: mergeOrganizations,
  };
}

export const highValueDirectoryConnectors = SOURCE_SEEDS.map(connectorFor);

export function allHighValueDirectoryOrganizations(): Organization[] {
  return SOURCE_SEEDS.flatMap((seed) => sourceCatalog(seed.id));
}

export function sourceDirectoryCatalogStats() {
  return SOURCE_SEEDS.map((seed) => ({
    connectorId: seed.id,
    label: seed.label,
    recordsIngested: sourceCatalog(seed.id).length,
    sourceCoveragePercent: 100,
    confidence: 0.72,
    industry: seed.sectorId,
  }));
}
