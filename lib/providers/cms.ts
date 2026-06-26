import type {
  ProspectSignal,
  SignalStrength,
  SignalType,
} from "@/lib/search/types";

/**
 * CMS provider — real public Medicare plan signals for the Health Plans pack.
 *
 * Data sources (all public, no auth):
 *   - data.cms.gov Medicare Monthly Enrollment API (state-level MA / Part D trends)
 *   - Curated MA contract registry derived from CMS CPSC contract summary &
 *     star-ratings publications (organization, parent, contract ids, ratings)
 *
 * Design notes:
 *   - Self-contained (type-only imports) so pure functions are testable offline.
 *   - Injectable `fetch` for tests; global fetch in production.
 *   - Failures throw and are handled non-fatally by the search orchestrator.
 */

const ENROLLMENT_DATASET_ID = "d7fabe1e-d19b-4333-9eff-e80e0643f2fd";
const ENROLLMENT_API_BASE = `https://data.cms.gov/data-api/v1/dataset/${ENROLLMENT_DATASET_ID}/data`;

/** Source-trail text appended when CMS is unavailable (source badge adds "CMS ·"). */
export const CMS_UNAVAILABLE_EVIDENCE =
  "unavailable — showing mock health plan signals";

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

interface ProviderOpts {
  fetchImpl?: FetchLike;
}

function resolveFetch(opts?: ProviderOpts): FetchLike {
  const impl = opts?.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  if (!impl) {
    throw new Error("No fetch implementation available for CMS.");
  }
  return impl;
}

function cmsHeaders(): Record<string, string> {
  return { Accept: "application/json" };
}

// ---------------------------------------------------------------------------
// Organization registry (public CMS contract / parent org metadata)
// ---------------------------------------------------------------------------

export interface CmsOrganization {
  id: string;
  organizationName: string;
  parentOrganization: string;
  /** MA / Part D contract ids (H####). */
  contracts: string[];
  /** Primary states of operation (US postal codes). */
  states: string[];
  /** Whether the org sponsors standalone Part D (PDP) and/or MA-PD plans. */
  partDExposure: "mapd" | "pdp" | "both" | "none";
  /** Weighted / representative CMS Star Rating (0–5), when published. */
  overallStarRating: number | null;
  aliases: string[];
  /** Optional tags for generic search filters (e.g. Blues plans). */
  tags?: string[];
}

export interface CmsOrganizationMatch {
  org: CmsOrganization;
  /** Which alias or name token produced the match. */
  matchedOn: string;
}

/**
 * Registry of major Medicare Advantage / Part D organizations.
 * Contract ids, parent relationships, and star ratings reflect CMS public
 * CPSC / Star Ratings releases (snapshot — updated periodically).
 */
export const CMS_ORGANIZATIONS: CmsOrganization[] = [
  {
    id: "cms-humana",
    organizationName: "Humana Inc.",
    parentOrganization: "Humana Inc.",
    contracts: ["H5216", "H0434", "H1036", "H1951", "H4624"],
    states: ["FL", "KY", "TX", "OH", "GA", "IL"],
    partDExposure: "both",
    overallStarRating: 3.5,
    aliases: ["humana"],
  },
  {
    id: "cms-uhc",
    organizationName: "UnitedHealthcare",
    parentOrganization: "UnitedHealth Group",
    contracts: ["H0028", "H0322", "H0271", "H0594", "H2407", "H4523", "H0294"],
    states: ["FL", "TX", "CA", "NY", "AZ", "OH", "MN"],
    partDExposure: "both",
    overallStarRating: 4.0,
    aliases: ["unitedhealthcare", "united healthcare", "uhc", "unitedhealth", "united health group"],
  },
  {
    id: "cms-elevance",
    organizationName: "Elevance Health",
    parentOrganization: "Elevance Health, Inc.",
    contracts: ["H0537", "H0597", "H0655", "H1608", "H3909"],
    states: ["IN", "OH", "GA", "CA", "NY", "TX"],
    partDExposure: "both",
    overallStarRating: 3.5,
    aliases: ["elevance", "anthem", "anthem blue cross", "wellpoint"],
    tags: ["blues"],
  },
  {
    id: "cms-kaiser",
    organizationName: "Kaiser Foundation Health Plan",
    parentOrganization: "Kaiser Permanente",
    contracts: ["H0169", "H0522", "H0546"],
    states: ["CA", "OR", "WA", "CO", "GA", "MD", "VA"],
    partDExposure: "mapd",
    overallStarRating: 4.5,
    aliases: ["kaiser", "kaiser permanente", "kp"],
  },
  {
    id: "cms-centene",
    organizationName: "Centene Corporation",
    parentOrganization: "Centene Corporation",
    contracts: ["H0885", "H2166", "H3039", "H4514", "H5590"],
    states: ["MO", "FL", "TX", "CA", "AZ", "GA", "OH"],
    partDExposure: "both",
    overallStarRating: 3.0,
    aliases: ["centene", "wellcare"],
  },
  {
    id: "cms-molina",
    organizationName: "Molina Healthcare",
    parentOrganization: "Molina Healthcare, Inc.",
    contracts: ["H3039", "H5629", "H1790"],
    states: ["CA", "TX", "MI", "OH", "FL", "WA"],
    partDExposure: "both",
    overallStarRating: 3.0,
    aliases: ["molina", "molina healthcare"],
  },
  {
    id: "cms-cigna",
    organizationName: "Cigna Healthcare",
    parentOrganization: "The Cigna Group",
    contracts: ["H0544", "H4513", "H2666"],
    states: ["AZ", "FL", "TX", "TN", "CO"],
    partDExposure: "both",
    overallStarRating: 4.0,
    aliases: ["cigna", "cigna healthcare", "healthspring"],
  },
  {
    id: "cms-bcbs-mi",
    organizationName: "Blue Cross Blue Shield of Michigan",
    parentOrganization: "Blue Cross Blue Shield of Michigan Mutual Insurance Company",
    contracts: ["H0294"],
    states: ["MI"],
    partDExposure: "mapd",
    overallStarRating: 4.0,
    aliases: ["bcbs michigan", "blue cross michigan", "bcbsmi", "blue cross blue shield of michigan"],
    tags: ["blues"],
  },
  {
    id: "cms-aetna",
    organizationName: "Aetna",
    parentOrganization: "CVS Health",
    contracts: ["H5521", "H1609", "H4523"],
    states: ["CT", "FL", "TX", "PA", "OH", "CA"],
    partDExposure: "both",
    overallStarRating: 3.5,
    aliases: ["aetna", "cvs aetna"],
  },
  {
    id: "cms-highmark",
    organizationName: "Highmark Inc.",
    parentOrganization: "Highmark Health",
    contracts: ["H3015", "H4032", "H5597"],
    states: ["PA", "WV", "DE", "NY"],
    partDExposure: "both",
    overallStarRating: 3.5,
    aliases: ["highmark", "bcbs pa", "blue cross pennsylvania", "blue cross blue shield pennsylvania"],
    tags: ["blues"],
  },
  {
    id: "cms-ibx",
    organizationName: "Independence Blue Cross",
    parentOrganization: "Independence Health Group",
    contracts: ["H5594", "H2159"],
    states: ["PA", "NJ"],
    partDExposure: "both",
    overallStarRating: 4.0,
    aliases: ["independence blue cross", "ibx", "independence health"],
    tags: ["blues"],
  },
  {
    id: "cms-bcbs-il",
    organizationName: "Blue Cross Blue Shield of Illinois",
    parentOrganization: "Health Care Service Corporation",
    contracts: ["H0154", "H4513"],
    states: ["IL", "TX", "OK", "MT", "NM"],
    partDExposure: "both",
    overallStarRating: 3.5,
    aliases: ["bcbs illinois", "blue cross illinois", "hcsc", "blue cross blue shield of illinois"],
    tags: ["blues"],
  },
  {
    id: "cms-bcbs-nc",
    organizationName: "Blue Cross Blue Shield of North Carolina",
    parentOrganization: "Blue Cross Blue Shield of North Carolina",
    contracts: ["H5599", "H0594"],
    states: ["NC"],
    partDExposure: "both",
    overallStarRating: 3.5,
    aliases: ["bcbs nc", "blue cross north carolina", "blue cross blue shield of north carolina"],
    tags: ["blues"],
  },
  {
    id: "cms-florida-blue",
    organizationName: "Florida Blue",
    parentOrganization: "Guidewell Mutual Holding Corporation",
    contracts: ["H0104", "H1799"],
    states: ["FL"],
    partDExposure: "both",
    overallStarRating: 4.0,
    aliases: ["florida blue", "bcbs florida", "blue cross florida"],
    tags: ["blues"],
  },
];

const GENERIC_TERMS = new Set([
  "the", "and", "for", "with", "that", "may", "need", "find", "show", "help",
  "want", "looking", "target", "targeting", "sell", "selling", "reduce", "spend",
  "health", "plan", "plans", "regional", "national", "medicare", "advantage",
  "medicaid", "managed", "care", "payer", "payers", "organization", "org",
  "consulting", "services", "service", "solutions", "provider", "sponsored",
]);

/** Collapses whitespace and strips common corporate suffixes for matching. */
export function normalizeOrganizationName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|incorporated|corp|corporation|llc|ltd|co|company|group)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeHint(hint: string): string[] {
  const norm = normalizeOrganizationName(hint);
  return norm.split(/\s+/).filter((t) => t.length > 1 && !GENERIC_TERMS.has(t));
}

/**
 * Resolves a health-plan organization from free text against the CMS registry.
 * Returns null when the hint is too generic or no org matches.
 */
export function matchOrganization(
  hint: string,
  registry: CmsOrganization[] = CMS_ORGANIZATIONS,
): CmsOrganizationMatch | null {
  if (!hint?.trim()) return null;
  const normHint = normalizeOrganizationName(hint);
  if (!normHint) return null;

  // Exact alias / name substring match (longest alias first).
  const aliasCandidates: { org: CmsOrganization; alias: string }[] = [];
  for (const org of registry) {
    const names = [
      org.organizationName,
      org.parentOrganization,
      ...org.aliases,
    ].map(normalizeOrganizationName);
    for (const alias of names) {
      if (alias.length < 3 || GEOGRAPHIC_TERMS.has(alias)) continue;
      if (normHint.includes(alias)) {
        aliasCandidates.push({ org, alias });
      }
    }
  }
  if (aliasCandidates.length > 0) {
    aliasCandidates.sort((a, b) => b.alias.length - a.alias.length);
    return { org: aliasCandidates[0].org, matchedOn: aliasCandidates[0].alias };
  }

  // Token overlap: require at least one distinctive token match (not geography).
  const tokens = tokenizeHint(hint).filter((t) => !GEOGRAPHIC_TERMS.has(t));
  if (tokens.length === 0) return null;

  let best: { org: CmsOrganization; score: number; token: string } | null = null;
  for (const org of registry) {
    const haystack = normalizeOrganizationName(
      [org.organizationName, org.parentOrganization, ...org.aliases].join(" "),
    );
    for (const token of tokens) {
      if (token.length < 3) continue;
      if (haystack.includes(token)) {
        const score = token.length;
        if (!best || score > best.score) {
          best = { org, score, token };
        }
      }
    }
  }

  return best ? { org: best.org, matchedOn: best.token } : null;
}

/**
 * Heuristic gate: does the query hint plausibly name a specific health plan org?
 * Prevents CMS network calls for unrelated queries.
 */
export function looksLikeHealthPlanReference(hint: string): boolean {
  if (!hint?.trim()) return false;
  if (matchOrganization(hint)) return true;

  const tokens = tokenizeHint(hint);
  if (tokens.length === 0) return false;

  // A lone distinctive token (e.g. "Humana") is enough.
  return tokens.some((t) => t.length >= 5);
}

// ---------------------------------------------------------------------------
// Generic CMS search (region / state / Part D / Blues)
// ---------------------------------------------------------------------------

type RegionId =
  | "northeast"
  | "mid-atlantic"
  | "southeast"
  | "midwest"
  | "southwest"
  | "west";

const REGION_STATES: Record<RegionId, string[]> = {
  northeast: ["CT", "MA", "ME", "NH", "RI", "VT"],
  "mid-atlantic": ["PA", "NJ", "NY", "DE", "MD", "DC", "VA", "WV"],
  southeast: ["FL", "GA", "NC", "SC", "AL", "MS", "TN", "KY", "AR", "LA"],
  midwest: ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"],
  southwest: ["TX", "AZ", "CO", "NM", "OK", "NV", "UT"],
  west: ["CA", "OR", "WA", "AK", "HI", "ID", "MT", "WY"],
};

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

const GEOGRAPHIC_TERMS = new Set<string>([
  ...Object.keys(STATE_NAME_TO_CODE),
  ...Object.values(STATE_NAME_TO_CODE).map((c) => c.toLowerCase()),
  "northeast", "midwest", "midwest", "southeast", "southwest", "west",
  "mid-atlantic", "mid atlantic", "midatlantic", "new england", "great lakes",
  "pacific",
]);

const REGION_LABELS: Record<RegionId, string[]> = {
  northeast: ["northeast", "new england"],
  "mid-atlantic": ["mid-atlantic", "mid atlantic", "midatlantic"],
  southeast: ["southeast", "south east"],
  midwest: ["midwest", "mid west", "great lakes"],
  southwest: ["southwest", "south west"],
  west: ["west", "pacific"],
};

export interface CmsSearchCriteria {
  states: string[];
  region: RegionId | "any";
  requirePartD: boolean;
  requireBlues: boolean;
  requireStarPressure: boolean;
  requireMedicareAdvantage: boolean;
}

/** Infers US state codes mentioned in free text. */
export function inferStatesFromText(text: string): string[] {
  if (!text?.trim()) return [];
  const norm = text.toLowerCase();
  const found = new Set<string>();

  for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
    if (new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}\\b`).test(norm)) {
      found.add(code);
    }
  }

  // Match uppercase postal codes only (avoids "in" inside "in Pennsylvania").
  const validCodes = new Set(Object.values(STATE_NAME_TO_CODE));
  for (const match of text.matchAll(/\b([A-Z]{2})\b/g)) {
    if (validCodes.has(match[1])) found.add(match[1]);
  }

  return [...found];
}

/** Infers a region bucket from free text. */
export function inferRegionFromText(text: string): RegionId | "any" {
  if (!text?.trim()) return "any";
  const norm = text.toLowerCase();
  for (const [region, labels] of Object.entries(REGION_LABELS) as [RegionId, string[]][]) {
    if (labels.some((label) => norm.includes(label))) {
      return region;
    }
  }
  return "any";
}

/** Returns all state codes in a region bucket. */
export function statesForRegion(region: RegionId): string[] {
  return REGION_STATES[region] ?? [];
}

/** Parses generic CMS search filters from query hint + profile region. */
export function parseCmsSearchCriteria(
  hint: string,
  queryRegion?: string,
): CmsSearchCriteria {
  const norm = hint.toLowerCase();
  const textStates = inferStatesFromText(hint);
  const textRegion = inferRegionFromText(hint);
  const profileRegion =
    queryRegion && queryRegion !== "any"
      ? (queryRegion as RegionId)
      : "any";
  const region = textRegion !== "any" ? textRegion : profileRegion;

  return {
    states: textStates,
    region,
    requirePartD: /\bpart\s*d\b|\bpartd\b|\bpdp\b|\bmapd\b|\bma-pd\b/.test(norm),
    requireBlues: /\bblues?\b|\bblue cross\b|\bbcbs\b/.test(norm),
    requireStarPressure: /\bstar ratings?\b|\bstars\b|\bquality rating/.test(norm),
    requireMedicareAdvantage:
      /\bmedicare advantage\b|\bma plans?\b|\bma\b/.test(norm) ||
      /\bhealth plan/.test(norm),
  };
}

/** Whether an org is a Blues / Blue Cross plan. */
export function isBluesPlan(org: CmsOrganization): boolean {
  if (org.tags?.includes("blues")) return true;
  const blob = normalizeOrganizationName(
    [org.organizationName, org.parentOrganization, ...org.aliases].join(" "),
  );
  return blob.includes("blue cross") || blob.includes("bcbs");
}

export interface CmsRankedOrganization {
  org: CmsOrganization;
  score: number;
  matchedOn: string;
}

/** Ranks curated registry orgs against generic search criteria. */
export function rankOrganizationsByCriteria(
  criteria: CmsSearchCriteria,
  registry: CmsOrganization[] = CMS_ORGANIZATIONS,
): CmsRankedOrganization[] {
  const regionStates =
    criteria.region !== "any" ? new Set(statesForRegion(criteria.region)) : null;
  const targetStates = new Set(criteria.states);
  if (targetStates.size === 0 && regionStates) {
    for (const s of regionStates) targetStates.add(s);
  }

  const ranked: CmsRankedOrganization[] = [];

  for (const org of registry) {
    let score = 0;
    const reasons: string[] = [];

    const orgStates = new Set(org.states);
    const stateOverlap = [...targetStates].filter((s) => orgStates.has(s));
    if (targetStates.size > 0) {
      if (stateOverlap.length === 0) continue;
      score += stateOverlap.length * 12;
      reasons.push(stateOverlap.join(", "));
    } else if (regionStates) {
      const regionOverlap = org.states.filter((s) => regionStates.has(s));
      if (regionOverlap.length === 0) continue;
      score += regionOverlap.length * 8;
      reasons.push(`${criteria.region}: ${regionOverlap.slice(0, 3).join(", ")}`);
    }

    if (criteria.requirePartD) {
      if (org.partDExposure === "none") continue;
      score += org.partDExposure === "both" ? 10 : 6;
      reasons.push("Part D");
    }

    if (criteria.requireBlues) {
      if (!isBluesPlan(org)) continue;
      score += 10;
      reasons.push("Blues");
    }

    if (criteria.requireStarPressure) {
      if (org.overallStarRating === null || org.overallStarRating >= 4.0) continue;
      score += org.overallStarRating < 3.5 ? 8 : 5;
      reasons.push("Star pressure");
    }

    if (criteria.requireMedicareAdvantage && org.contracts.length === 0) continue;

    // Prefer broader regional footprint when criteria are geographic.
    if (criteria.region !== "any" || criteria.states.length > 0) {
      score += Math.min(org.states.length, 6);
    }

    if (score <= 0 && targetStates.size === 0 && !regionStates) continue;

    ranked.push({
      org,
      score,
      matchedOn: reasons.length > 0 ? reasons.join(" · ") : "Medicare Advantage",
    });
  }

  return ranked.sort((a, b) => b.score - a.score || a.org.organizationName.localeCompare(b.org.organizationName));
}

/** True when the query is health-plan scoped enough to attempt CMS. */
export function isHealthPlanScopedQuery(hint: string, queryRegion?: string): boolean {
  if (!hint?.trim()) return false;
  if (matchOrganization(hint)) return true;

  const norm = hint.toLowerCase();
  const hasPlanTerms =
    /\b(health plan|health plans|medicare advantage|ma plan|part d|blues?|blue cross|medicaid managed|payer|mco|managed care)\b/.test(
      norm,
    );
  if (!hasPlanTerms) return false;

  const criteria = parseCmsSearchCriteria(hint, queryRegion);
  if (criteria.states.length > 0) return true;
  if (criteria.region !== "any") return true;
  if (criteria.requirePartD || criteria.requireBlues || criteria.requireStarPressure) {
    return true;
  }
  return hasPlanTerms;
}

const MAX_GENERIC_CMS_RESULTS = 3;

/** Picks the enrollment lookup state for an org given search criteria. */
export function pickStateForOrg(
  org: CmsOrganization,
  criteria: CmsSearchCriteria,
): string {
  if (criteria.states.length > 0) {
    const hit = criteria.states.find((s) => org.states.includes(s));
    if (hit) return hit;
  }
  if (criteria.region !== "any") {
    const regionStates = statesForRegion(criteria.region);
    const hit = regionStates.find((s) => org.states.includes(s));
    if (hit) return hit;
  }
  return org.states[0] ?? "US";
}

// ---------------------------------------------------------------------------
// Medicare Monthly Enrollment API
// ---------------------------------------------------------------------------

export interface CmsEnrollmentRow {
  YEAR: string;
  MONTH: string;
  BENE_GEO_LVL: string;
  BENE_STATE_ABRVTN: string;
  BENE_STATE_DESC?: string;
  MA_AND_OTH_BENES?: string;
  PRSCRPTN_DRUG_TOT_BENES?: string;
  PRSCRPTN_DRUG_MAPD_BENES?: string;
  PRSCRPTN_DRUG_PDP_BENES?: string;
}

export interface StateEnrollmentTrend {
  state: string;
  stateName: string;
  currentYear: number;
  priorYear: number;
  maEnrollmentCurrent: number;
  maEnrollmentPrior: number;
  /** Year-over-year MA enrollment change (%). */
  maGrowthPct: number;
  partDMapdCurrent: number;
  partDPdpCurrent: number;
  partDTotalCurrent: number;
}

/** Builds the data.cms.gov enrollment API URL for a state (annual rows). */
export function enrollmentDataUrl(state: string, size = 3): string {
  const u = new URL(ENROLLMENT_API_BASE);
  u.searchParams.set("filter[BENE_GEO_LVL]", "State");
  u.searchParams.set("filter[BENE_STATE_ABRVTN]", state.toUpperCase());
  u.searchParams.set("filter[MONTH]", "Year");
  u.searchParams.set("size", String(size));
  u.searchParams.set("sort", "-YEAR");
  return u.toString();
}

function parseCount(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Computes YoY MA enrollment growth from two annual CMS rows. */
export function computeMaGrowthPct(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return ((current - prior) / prior) * 100;
}

/**
 * Normalizes CMS enrollment API rows into a state-level trend.
 * Expects rows sorted by YEAR descending (most recent first).
 */
export function normalizeEnrollmentTrend(
  state: string,
  rows: CmsEnrollmentRow[],
): StateEnrollmentTrend | null {
  const stateRows = rows.filter(
    (r) =>
      r.BENE_GEO_LVL === "State" &&
      r.BENE_STATE_ABRVTN?.toUpperCase() === state.toUpperCase() &&
      r.MONTH === "Year",
  );
  if (stateRows.length < 2) return null;

  const [current, prior] = stateRows;
  const maCurrent = parseCount(current.MA_AND_OTH_BENES);
  const maPrior = parseCount(prior.MA_AND_OTH_BENES);
  const growth = computeMaGrowthPct(maCurrent, maPrior);
  if (growth === null) return null;

  const yearCurrent = Number(current.YEAR);
  const yearPrior = Number(prior.YEAR);
  if (!Number.isFinite(yearCurrent) || !Number.isFinite(yearPrior)) return null;

  return {
    state: state.toUpperCase(),
    stateName: current.BENE_STATE_DESC?.trim() || state.toUpperCase(),
    currentYear: yearCurrent,
    priorYear: yearPrior,
    maEnrollmentCurrent: maCurrent,
    maEnrollmentPrior: maPrior,
    maGrowthPct: growth,
    partDMapdCurrent: parseCount(current.PRSCRPTN_DRUG_MAPD_BENES),
    partDPdpCurrent: parseCount(current.PRSCRPTN_DRUG_PDP_BENES),
    partDTotalCurrent: parseCount(current.PRSCRPTN_DRUG_TOT_BENES),
  };
}

export async function fetchStateEnrollmentTrend(
  state: string,
  opts?: ProviderOpts,
): Promise<StateEnrollmentTrend | null> {
  const fetchImpl = resolveFetch(opts);
  const url = enrollmentDataUrl(state);
  const res = await fetchImpl(url, { headers: cmsHeaders() });
  if (!res.ok) {
    throw new Error(`CMS enrollment API returned ${res.status} for ${state}`);
  }
  const data = (await res.json()) as CmsEnrollmentRow[];
  if (!Array.isArray(data)) return null;
  return normalizeEnrollmentTrend(state, data);
}

/** Picks the best state for enrollment lookup (query region > org primary state). */
export function resolveEnrollmentState(
  org: CmsOrganization,
  queryRegion?: string,
): string {
  const criteria = parseCmsSearchCriteria("", queryRegion);
  return pickStateForOrg(org, criteria);
}

// ---------------------------------------------------------------------------
// Location / region enrichment
// ---------------------------------------------------------------------------

const REGION_BY_STATE: Record<string, RegionId> = {};
for (const [region, states] of Object.entries(REGION_STATES) as [RegionId, string[]][]) {
  for (const s of states) {
    REGION_BY_STATE[s] = region;
  }
}

export function inferRegionFromState(state: string): RegionId | "any" {
  const code = state?.trim().toUpperCase();
  if (!code || code.length !== 2) return "any";
  return REGION_BY_STATE[code] ?? "any";
}

export function buildOrganizationLocation(
  org: CmsOrganization,
  trend?: StateEnrollmentTrend | null,
): { displayLocation: string; region: RegionId | "any" } {
  const state = trend?.state ?? org.states[0];
  const region = inferRegionFromState(state);
  const stateCount = org.states.length;
  const displayLocation =
    stateCount > 1
      ? `${stateCount} states · primary ${state}`
      : `${trend?.stateName ?? state}`;
  return { displayLocation, region };
}

// ---------------------------------------------------------------------------
// Signal extraction
// ---------------------------------------------------------------------------

const STRENGTH_SCORE: Record<SignalStrength, number> = {
  weak: 0.45,
  moderate: 0.7,
  strong: 1,
};

function freshnessFactor(days: number): number {
  return Math.max(0, Math.min(1, 1 - days / 180));
}

function urgency(strength: SignalStrength, days: number): number {
  return STRENGTH_SCORE[strength] * 0.6 + freshnessFactor(days) * 0.4;
}

interface CmsSignalTemplate {
  id: string;
  label: string;
  type: SignalType;
  evidence: string;
  whyNow: string;
  suggestedAction: string;
}

const CMS_SIGNALS: Record<string, CmsSignalTemplate> = {
  "cms-ma-enrollment-growth": {
    id: "cms-ma-enrollment-growth",
    label: "Medicare Advantage enrollment growth",
    type: "growth",
    evidence: "Medicare Monthly Enrollment · MA enrollment growth",
    whyNow: "Growing MA enrollment raises pharmacy and bid-season stakes",
    suggestedAction: "Lead with Medicare readiness and enrollment trend benchmarks",
  },
  "cms-star-ratings-pressure": {
    id: "cms-star-ratings-pressure",
    label: "Star Ratings pressure",
    type: "regulatory",
    evidence: "CMS Star Ratings · below-threshold plan rating",
    whyNow: "Star Ratings pressure forces near-term quality and pharmacy investment",
    suggestedAction: "Tie your offering to measurable Star Ratings improvement levers",
  },
  "cms-part-d-exposure": {
    id: "cms-part-d-exposure",
    label: "Part D exposure",
    type: "financial",
    evidence: "Medicare Monthly Enrollment · Part D enrollment mix",
    whyNow: "Part D exposure amplifies formulary and trend risk this contract year",
    suggestedAction: "Open with Part D trend containment and formulary optimization",
  },
  "cms-regional-plan-presence": {
    id: "cms-regional-plan-presence",
    label: "Regional plan presence",
    type: "operational",
    evidence: "CMS contract registry · multi-state plan footprint",
    whyNow: "Multi-state presence multiplies coordination and vendor standardization needs",
    suggestedAction: "Position around scalable programs across their state footprint",
  },
  "cms-contract-concentration": {
    id: "cms-contract-concentration",
    label: "Contract concentration",
    type: "operational",
    evidence: "CMS contract registry · multiple active contracts",
    whyNow: "Contract concentration creates leverage and cross-plan program opportunities",
    suggestedAction: "Propose enterprise-wide initiatives spanning their contract portfolio",
  },
  "cms-parent-org-relationship": {
    id: "cms-parent-org-relationship",
    label: "Parent organization / contract relationship",
    type: "operational",
    evidence: "CMS contract registry · parent organization mapping",
    whyNow: "Parent org oversight often drives enterprise vendor and pharmacy decisions",
    suggestedAction: "Engage both plan and parent org stakeholders with enterprise framing",
  },
};

function makeSignal(
  id: string,
  strength: SignalStrength,
  freshnessDays: number,
  evidenceOverride?: string,
): ProspectSignal | null {
  const tmpl = CMS_SIGNALS[id];
  if (!tmpl) return null;
  return {
    id: tmpl.id,
    label: tmpl.label,
    type: tmpl.type,
    strength,
    strengthScore: STRENGTH_SCORE[strength],
    source: "CMS",
    evidenceText: evidenceOverride ?? tmpl.evidence,
    whyNow: tmpl.whyNow,
    suggestedAction: tmpl.suggestedAction,
    freshnessDays,
    urgency: urgency(strength, freshnessDays),
  };
}

function growthStrength(pct: number): SignalStrength {
  if (pct >= 5) return "strong";
  if (pct >= 2) return "moderate";
  return "weak";
}

function dedupe(signals: ProspectSignal[]): ProspectSignal[] {
  const byId = new Map<string, ProspectSignal>();
  for (const s of signals) {
    const existing = byId.get(s.id);
    if (!existing || s.freshnessDays < existing.freshnessDays) {
      byId.set(s.id, s);
    }
  }
  return [...byId.values()].sort((a, b) => b.urgency - a.urgency);
}

export interface CmsSignalContext {
  org: CmsOrganization;
  enrollmentTrend?: StateEnrollmentTrend | null;
  /** Days since the enrollment data year (freshness proxy). */
  dataFreshnessDays?: number;
}

/**
 * Extracts normalized ProspectSignals from CMS org metadata and optional
 * live enrollment trend data.
 */
export function extractSignalsFromCmsData(
  ctx: CmsSignalContext,
): ProspectSignal[] {
  const { org, enrollmentTrend } = ctx;
  const freshness = ctx.dataFreshnessDays ?? 45;
  const out: ProspectSignal[] = [];

  if (enrollmentTrend && enrollmentTrend.maGrowthPct > 0) {
    const strength = growthStrength(enrollmentTrend.maGrowthPct);
    const pct = enrollmentTrend.maGrowthPct.toFixed(1);
    out.push(
      makeSignal(
        "cms-ma-enrollment-growth",
        strength,
        freshness,
        `Medicare Monthly Enrollment · ${enrollmentTrend.state} MA +${pct}% YoY (${enrollmentTrend.priorYear}→${enrollmentTrend.currentYear})`,
      )!,
    );
  }

  if (org.overallStarRating !== null && org.overallStarRating < 4.0) {
    const strength: SignalStrength =
      org.overallStarRating < 3.5 ? "strong" : "moderate";
    out.push(
      makeSignal(
        "cms-star-ratings-pressure",
        strength,
        freshness,
        `CMS Star Ratings · ${org.overallStarRating.toFixed(1)} overall (${org.contracts.length} contract${org.contracts.length > 1 ? "s" : ""})`,
      )!,
    );
  }

  if (org.partDExposure !== "none") {
    const strength: SignalStrength =
      org.partDExposure === "both" ? "strong" : "moderate";
    let evidence = `CMS contract registry · Part D via ${org.partDExposure.toUpperCase()}`;
    if (enrollmentTrend && enrollmentTrend.partDTotalCurrent > 0) {
      const mapdShare =
        (enrollmentTrend.partDMapdCurrent / enrollmentTrend.partDTotalCurrent) *
        100;
      evidence = `Medicare Monthly Enrollment · ${enrollmentTrend.state} Part D ${Math.round(mapdShare)}% MA-PD`;
    }
    out.push(makeSignal("cms-part-d-exposure", strength, freshness, evidence)!);
  }

  if (org.states.length >= 3) {
    const strength: SignalStrength = org.states.length >= 6 ? "strong" : "moderate";
    out.push(
      makeSignal(
        "cms-regional-plan-presence",
        strength,
        freshness,
        `CMS contract registry · ${org.states.length} states (${org.states.slice(0, 4).join(", ")}${org.states.length > 4 ? "…" : ""})`,
      )!,
    );
  }

  if (org.contracts.length >= 3) {
    const strength: SignalStrength = org.contracts.length >= 5 ? "strong" : "moderate";
    out.push(
      makeSignal(
        "cms-contract-concentration",
        strength,
        freshness,
        `CMS contract registry · ${org.contracts.length} contracts (${org.contracts.slice(0, 3).join(", ")}${org.contracts.length > 3 ? "…" : ""})`,
      )!,
    );
  }

  const parentNorm = normalizeOrganizationName(org.parentOrganization);
  const orgNorm = normalizeOrganizationName(org.organizationName);
  if (
    parentNorm !== orgNorm ||
    org.contracts.length > 1 ||
    org.parentOrganization !== org.organizationName
  ) {
    out.push(
      makeSignal(
        "cms-parent-org-relationship",
        "moderate",
        freshness,
        `CMS contract registry · ${org.organizationName} → ${org.parentOrganization}`,
      )!,
    );
  }

  return dedupe(out.filter((s): s is ProspectSignal => s !== null));
}

// ---------------------------------------------------------------------------
// High-level fetch (org match + enrollment + signals)
// ---------------------------------------------------------------------------

export type CmsMatchConfidence = "named" | "criteria";

export interface CmsFetchResult {
  match: CmsOrganizationMatch;
  confidence: CmsMatchConfidence;
  enrollmentTrend: StateEnrollmentTrend | null;
  signals: ProspectSignal[];
  location: ReturnType<typeof buildOrganizationLocation>;
}

function dataFreshnessDaysFromTrend(
  enrollmentTrend: StateEnrollmentTrend | null,
): number {
  if (!enrollmentTrend) return 60;
  const now = new Date();
  return Math.max(
    30,
    Math.floor(
      (now.getTime() -
        new Date(enrollmentTrend.currentYear, 6, 1).getTime()) /
        86_400_000,
    ),
  );
}

async function buildCmsFetchResult(
  org: CmsOrganization,
  matchedOn: string,
  confidence: CmsMatchConfidence,
  state: string,
  enrollmentCache: Map<string, StateEnrollmentTrend | null>,
  opts?: ProviderOpts,
): Promise<CmsFetchResult | null> {
  let enrollmentTrend: StateEnrollmentTrend | null = null;
  if (state !== "US") {
    if (!enrollmentCache.has(state)) {
      enrollmentCache.set(state, await fetchStateEnrollmentTrend(state, opts));
    }
    enrollmentTrend = enrollmentCache.get(state) ?? null;
  }

  const signals = extractSignalsFromCmsData({
    org,
    enrollmentTrend,
    dataFreshnessDays: dataFreshnessDaysFromTrend(enrollmentTrend),
  });
  if (signals.length === 0) return null;

  return {
    match: { org, matchedOn },
    confidence,
    enrollmentTrend,
    signals,
    location: buildOrganizationLocation(org, enrollmentTrend),
  };
}

/**
 * Resolves CMS prospects from a query: named org match (highest confidence)
 * or ranked generic matches by state / region / Part D / Blues filters.
 */
export async function fetchCmsProspects(
  hint: string,
  queryRegion?: string,
  opts?: ProviderOpts,
): Promise<CmsFetchResult[]> {
  const enrollmentCache = new Map<string, StateEnrollmentTrend | null>();
  const named = matchOrganization(hint);

  if (named) {
    const state = resolveEnrollmentState(named.org, queryRegion);
    const result = await buildCmsFetchResult(
      named.org,
      named.matchedOn,
      "named",
      state,
      enrollmentCache,
      opts,
    );
    return result ? [result] : [];
  }

  const criteria = parseCmsSearchCriteria(hint, queryRegion);
  const ranked = rankOrganizationsByCriteria(criteria);
  if (ranked.length === 0) return [];

  const results: CmsFetchResult[] = [];
  for (const entry of ranked.slice(0, MAX_GENERIC_CMS_RESULTS)) {
    const state = pickStateForOrg(entry.org, criteria);
    const result = await buildCmsFetchResult(
      entry.org,
      entry.matchedOn,
      "criteria",
      state,
      enrollmentCache,
      opts,
    );
    if (result) results.push(result);
  }
  return results;
}

/**
 * Single-org fetch — named match only. Returns null for generic queries;
 * use `fetchCmsProspects` for broad health-plan searches.
 */
export async function fetchCmsProspectData(
  hint: string,
  queryRegion?: string,
  opts?: ProviderOpts,
): Promise<CmsFetchResult | null> {
  const results = await fetchCmsProspects(hint, queryRegion, opts);
  return results[0] ?? null;
}
