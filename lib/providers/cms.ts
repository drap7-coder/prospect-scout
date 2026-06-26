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
      if (alias.length >= 3 && normHint.includes(alias)) {
        aliasCandidates.push({ org, alias });
      }
    }
  }
  if (aliasCandidates.length > 0) {
    aliasCandidates.sort((a, b) => b.alias.length - a.alias.length);
    return { org: aliasCandidates[0].org, matchedOn: aliasCandidates[0].alias };
  }

  // Token overlap: require at least one distinctive token match.
  const tokens = tokenizeHint(hint);
  if (tokens.length === 0) return null;

  let best: { org: CmsOrganization; score: number; token: string } | null = null;
  for (const org of registry) {
    const haystack = normalizeOrganizationName(
      [org.organizationName, org.parentOrganization, ...org.aliases].join(" "),
    );
    for (const token of tokens) {
      if (token.length < 4) continue;
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
 * Prevents CMS network calls for generic queries like "regional health plans".
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
  return normalizeEnrollmentTrend(state, data);
}

/** Picks the best state for enrollment lookup (query region > org primary state). */
export function resolveEnrollmentState(
  org: CmsOrganization,
  queryRegion?: string,
): string {
  if (queryRegion && queryRegion !== "any") {
    const regionStates: Record<string, string[]> = {
      northeast: ["MA", "NY", "CT"],
      "mid-atlantic": ["PA", "NJ", "MD", "VA"],
      southeast: ["FL", "GA", "NC"],
      midwest: ["OH", "MI", "IL", "IN"],
      southwest: ["TX", "AZ", "NM"],
      west: ["CA", "WA", "OR"],
    };
    const candidates = regionStates[queryRegion] ?? [];
    const hit = candidates.find((s) => org.states.includes(s));
    if (hit) return hit;
  }
  return org.states[0] ?? "US";
}

// ---------------------------------------------------------------------------
// Location / region enrichment
// ---------------------------------------------------------------------------

type RegionId =
  | "northeast"
  | "mid-atlantic"
  | "southeast"
  | "midwest"
  | "southwest"
  | "west";

const REGION_BY_STATE: Record<string, RegionId> = {};
for (const s of ["PA", "NJ", "NY", "DE", "MD", "DC", "VA", "WV"]) {
  REGION_BY_STATE[s] = "mid-atlantic";
}
for (const s of ["CT", "MA", "ME", "NH", "RI", "VT"]) {
  REGION_BY_STATE[s] = "northeast";
}
for (const s of ["FL", "GA", "NC", "SC", "AL", "MS", "TN", "KY", "AR", "LA"]) {
  REGION_BY_STATE[s] = "southeast";
}
for (const s of ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"]) {
  REGION_BY_STATE[s] = "midwest";
}
for (const s of ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY", "OK"]) {
  REGION_BY_STATE[s] = "southwest";
}
for (const s of ["CA", "OR", "WA", "AK", "HI"]) {
  REGION_BY_STATE[s] = "west";
}
for (const s of ["TX"]) {
  REGION_BY_STATE[s] = "southwest";
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

export interface CmsFetchResult {
  match: CmsOrganizationMatch;
  enrollmentTrend: StateEnrollmentTrend | null;
  signals: ProspectSignal[];
  location: ReturnType<typeof buildOrganizationLocation>;
}

/**
 * Resolves a health plan org from the query hint, fetches CMS enrollment
 * trends for the best-matching state, and returns extracted signals.
 */
export async function fetchCmsProspectData(
  hint: string,
  queryRegion?: string,
  opts?: ProviderOpts,
): Promise<CmsFetchResult | null> {
  const match = matchOrganization(hint);
  if (!match) return null;

  const state = resolveEnrollmentState(match.org, queryRegion);
  let enrollmentTrend: StateEnrollmentTrend | null = null;
  if (state !== "US") {
    enrollmentTrend = await fetchStateEnrollmentTrend(state, opts);
  }

  const now = new Date();
  const dataFreshnessDays = enrollmentTrend
    ? Math.max(
        30,
        Math.floor(
          (now.getTime() - new Date(enrollmentTrend.currentYear, 6, 1).getTime()) /
            86_400_000,
        ),
      )
    : 60;

  const signals = extractSignalsFromCmsData({
    org: match.org,
    enrollmentTrend,
    dataFreshnessDays,
  });
  if (signals.length === 0) return null;

  return {
    match,
    enrollmentTrend,
    signals,
    location: buildOrganizationLocation(match.org, enrollmentTrend),
  };
}
