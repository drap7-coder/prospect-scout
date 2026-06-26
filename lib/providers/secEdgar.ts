import type {
  ProspectSignal,
  SignalStrength,
  SignalType,
} from "@/lib/search/types";

/**
 * SEC EDGAR provider — the first REAL public-data source.
 *
 * Responsibilities:
 *   1. Look up a company's CIK/ticker via SEC's company_tickers.json.
 *   2. Fetch that company's recent submissions by CIK.
 *   3. Extract lightweight, normalized `ProspectSignal`s from recent filings.
 *
 * Design notes:
 *   - This module is intentionally self-contained (only type-only imports) so
 *     its pure functions can be unit-tested directly with mocked data, with no
 *     bundler/path-alias or network dependencies.
 *   - All network calls accept an injectable `fetch` for testing and default
 *     to the global `fetch` in production.
 *   - Every SEC request sends a compliant User-Agent (SEC requirement).
 *   - No API key, no auth, no database. Failures are surfaced as thrown errors
 *     and handled non-fatally by the caller (graceful mock fallback).
 */

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SUBMISSIONS_BASE = "https://data.sec.gov/submissions";
const DEV_FALLBACK_UA =
  "Prospect Scout (dev fallback) set-SEC_USER_AGENT@example.com";

// ---------------------------------------------------------------------------
// Compliant User-Agent
// ---------------------------------------------------------------------------

/**
 * Returns the User-Agent for SEC requests. SEC requires a descriptive UA with
 * contact info. Configure via `SEC_USER_AGENT`. If missing, we log a warning
 * and fall back to a safe development value (best-effort, may be rate limited).
 */
export function getUserAgent(): string {
  const ua = process.env.SEC_USER_AGENT;
  if (!ua || !ua.trim()) {
    console.warn(
      '[secEdgar] SEC_USER_AGENT is not set. Using a development fallback. ' +
        'Set SEC_USER_AGENT="Prospect Scout your-email@example.com" for compliant SEC access.',
    );
    return DEV_FALLBACK_UA;
  }
  return ua.trim();
}

// ---------------------------------------------------------------------------
// CIK helpers
// ---------------------------------------------------------------------------

/** Zero-pads a CIK to the 10-digit form SEC submissions endpoints expect. */
export function padCik(cik: string | number): string {
  const digits = String(cik).replace(/\D/g, "");
  return digits.padStart(10, "0");
}

/** Builds the submissions JSON URL for a CIK. */
export function submissionsUrl(cik: string | number): string {
  return `${SUBMISSIONS_BASE}/CIK${padCik(cik)}.json`;
}

// ---------------------------------------------------------------------------
// Minimal fetch shape (so tests can inject a stub)
// ---------------------------------------------------------------------------

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

interface ProviderOpts {
  fetchImpl?: FetchLike;
  userAgent?: string;
}

function resolveFetch(opts?: ProviderOpts): FetchLike {
  const impl = opts?.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  if (!impl) {
    throw new Error("No fetch implementation available for SEC EDGAR.");
  }
  return impl;
}

function headers(opts?: ProviderOpts): Record<string, string> {
  return {
    "User-Agent": opts?.userAgent ?? getUserAgent(),
    Accept: "application/json",
  };
}

// ---------------------------------------------------------------------------
// Ticker / CIK lookup
// ---------------------------------------------------------------------------

export interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

export interface CompanyMatch {
  cik: string;
  ticker: string;
  title: string;
}

/** Generic words that should never, on their own, identify a company. */
const GENERIC_TERMS = new Set([
  "the", "and", "for", "with", "that", "may", "need", "find", "show", "help",
  "want", "looking", "target", "targeting", "sell", "selling", "reduce", "spend",
  "company", "companies", "corp", "corporation", "inc", "incorporated", "group",
  "holdings", "co", "plc", "ltd", "llc", "services", "service", "solutions",
  "regional", "national", "public", "private", "county", "city", "district",
  "health", "plan", "plans", "system", "systems", "hospital", "hospitals",
  "manufacturer", "manufacturers", "manufacturing", "employer", "employers",
  "food", "beverage", "retail", "industrial", "technology", "tech", "energy",
  "pharma", "pharmaceutical", "pharmaceuticals", "bank", "banking", "insurance",
  "consulting", "software", "analytics", "specialty", "drug", "drugs",
  "pharmacy", "packaging", "automation", "cost", "costs", "benefits",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Inc|Llc|Plc|Ltd|Corp)\b/g, (m) => m.toUpperCase());
}

function toMatch(entry: TickerEntry): CompanyMatch {
  return {
    cik: padCik(entry.cik_str),
    ticker: entry.ticker.toUpperCase(),
    title: titleCase(entry.title),
  };
}

/**
 * Cheap pre-check: does this hint plausibly name a public company or ticker?
 * Used to avoid pointless network calls for generic category searches.
 */
export function looksLikeCompanyReference(hint: string): boolean {
  if (!hint || !hint.trim()) return false;
  const rawTokens = hint.match(/[A-Za-z0-9.&-]+/g) ?? [];
  if (rawTokens.some((t) => /^[A-Z]{1,5}$/.test(t))) return true; // ticker-like
  const significant = tokenize(hint).filter(
    (t) => t.length >= 4 && !GENERIC_TERMS.has(t),
  );
  return significant.length >= 1;
}

/**
 * Pure matcher: resolve a hint to a company using a provided ticker dataset.
 * Prefers an exact ticker match, then the most specific (shortest) company
 * title whose tokens cover the significant hint tokens.
 */
export function matchCompany(
  hint: string,
  tickers: TickerEntry[],
): CompanyMatch | null {
  if (!hint || !hint.trim() || tickers.length === 0) return null;

  // 1) Exact ticker match (uppercase 1–5 letter token).
  const rawTokens = hint.match(/[A-Za-z0-9.&-]+/g) ?? [];
  for (const raw of rawTokens) {
    if (/^[A-Z]{1,5}$/.test(raw)) {
      const hit = tickers.find((e) => e.ticker.toUpperCase() === raw);
      if (hit) return toMatch(hit);
    }
  }

  // 2) Company-name match on significant tokens.
  const tokens = tokenize(hint).filter(
    (t) => t.length >= 3 && !GENERIC_TERMS.has(t),
  );
  if (tokens.length === 0) return null;
  // Require either two significant tokens, or one reasonably specific token.
  const need = tokens.length >= 2 ? tokens : tokens[0].length >= 4 ? tokens : [];
  if (need.length === 0) return null;

  let best: TickerEntry | null = null;
  let bestLen = Infinity;
  for (const entry of tickers) {
    const title = entry.title.toLowerCase();
    const titleTokens = new Set(tokenize(title));
    const all = need.every((tok) => titleTokens.has(tok) || title.includes(tok));
    if (all && entry.title.length < bestLen) {
      best = entry;
      bestLen = entry.title.length;
    }
  }
  return best ? toMatch(best) : null;
}

let tickerCache: TickerEntry[] | null = null;

/** Loads and caches the SEC company tickers dataset. */
export async function loadTickers(opts?: ProviderOpts): Promise<TickerEntry[]> {
  if (tickerCache) return tickerCache;
  const res = await resolveFetch(opts)(TICKERS_URL, { headers: headers(opts) });
  if (!res.ok) {
    throw new Error(`SEC company_tickers fetch failed (${res.status}).`);
  }
  const data = (await res.json()) as Record<string, TickerEntry>;
  tickerCache = Object.values(data);
  return tickerCache;
}

/** Resolves a hint to a company via the live tickers dataset. */
export async function searchCompany(
  hint: string,
  opts?: ProviderOpts,
): Promise<CompanyMatch | null> {
  const tickers = await loadTickers(opts);
  return matchCompany(hint, tickers);
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export interface SecAddress {
  street1?: string;
  street2?: string;
  city?: string;
  stateOrCountry?: string;
  zipCode?: string;
}

export interface SecRecentFilings {
  form?: string[];
  filingDate?: string[];
  items?: string[];
  primaryDocument?: string[];
  accessionNumber?: string[];
}

export interface SecSubmissions {
  cik?: string;
  name?: string;
  addresses?: {
    business?: SecAddress;
    mailing?: SecAddress;
  };
  filings?: { recent?: SecRecentFilings };
}

export interface FilingRef {
  form: string;
  filingDate: string;
  items: string;
  primaryDocument: string;
  accessionNumber: string;
}

/** Fetches a company's submissions JSON by CIK. */
export async function fetchSubmissions(
  cik: string | number,
  opts?: ProviderOpts,
): Promise<SecSubmissions> {
  const res = await resolveFetch(opts)(submissionsUrl(cik), {
    headers: headers(opts),
  });
  if (!res.ok) {
    throw new Error(`SEC submissions fetch failed (${res.status}).`);
  }
  return (await res.json()) as SecSubmissions;
}

/** Flattens the parallel `filings.recent` arrays into FilingRef objects. */
export function recentFilingsFromSubmissions(
  submissions: SecSubmissions,
): FilingRef[] {
  const recent = submissions.filings?.recent;
  if (!recent?.form) return [];
  const count = recent.form.length;
  const filings: FilingRef[] = [];
  for (let i = 0; i < count; i++) {
    filings.push({
      form: recent.form[i] ?? "",
      filingDate: recent.filingDate?.[i] ?? "",
      items: recent.items?.[i] ?? "",
      primaryDocument: recent.primaryDocument?.[i] ?? "",
      accessionNumber: recent.accessionNumber?.[i] ?? "",
    });
  }
  return filings;
}

// ---------------------------------------------------------------------------
// Company location (business / mailing address → region)
// ---------------------------------------------------------------------------

/** Canonical region ids used for SEC location inference and region scoring. */
export type RegionId =
  | "northeast"
  | "mid-atlantic"
  | "southeast"
  | "midwest"
  | "mountain-west"
  | "southwest"
  | "west";

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

/** Full state / territory name → two-letter code. */
const STATE_NAME_TO_CODE: Record<string, string> = {
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA",
  COLORADO: "CO", CONNECTICUT: "CT", DELAWARE: "DE", "DISTRICT OF COLUMBIA": "DC",
  FLORIDA: "FL", GEORGIA: "GA", HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL",
  INDIANA: "IN", IOWA: "IA", KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA",
  MAINE: "ME", MARYLAND: "MD", MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN",
  MISSISSIPPI: "MS", MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV",
  "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
  "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK",
  OREGON: "OR", PENNSYLVANIA: "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD", TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT", VERMONT: "VT",
  VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV", WISCONSIN: "WI",
  WYOMING: "WY",
};

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
for (const s of ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY"]) {
  REGION_BY_STATE[s] = "mountain-west";
}
for (const s of ["CA", "OR", "WA", "AK", "HI"]) {
  REGION_BY_STATE[s] = "west";
}
for (const s of ["TX", "OK"]) {
  REGION_BY_STATE[s] = "southwest";
}

/**
 * Normalizes SEC `stateOrCountry` to a US two-letter state code, or null when
 * the value is missing, foreign, or otherwise not a recognized US state.
 */
export function normalizeSecState(stateOrCountry: string): string | null {
  if (!stateOrCountry?.trim()) return null;
  const raw = stateOrCountry.trim().toUpperCase();

  if (/^[A-Z]{2}$/.test(raw)) {
    return US_STATE_CODES.has(raw) ? raw : null;
  }

  const fromName = STATE_NAME_TO_CODE[raw];
  return fromName ?? null;
}

/**
 * Maps a normalized US state code to a Prospect Scout region bucket.
 * Returns `"any"` when the state is unknown or non-US.
 */
export function inferUsRegionFromState(state: string): RegionId | "any" {
  const code = normalizeSecState(state);
  if (!code) return "any";
  return REGION_BY_STATE[code] ?? "any";
}

export interface SecCompanyAddress {
  city?: string;
  stateOrCountry?: string;
  zipCode?: string;
  /** Which SEC address block supplied this data. */
  source: "business" | "mailing";
}

export interface SecCompanyLocation {
  city: string | null;
  state: string | null;
  zipCode: string | null;
  region: RegionId | "any";
  /** Human-readable location, e.g. "Purchase, NY". */
  displayLocation: string;
}

/**
 * Extracts the best available company address from SEC submissions JSON.
 * Prefers the business address over the mailing address.
 */
export function extractCompanyAddress(
  submissions: SecSubmissions,
): SecCompanyAddress | null {
  const addresses = submissions.addresses;
  if (!addresses) return null;

  const business = addresses.business;
  if (business && (business.city || business.stateOrCountry)) {
    return {
      city: business.city,
      stateOrCountry: business.stateOrCountry,
      zipCode: business.zipCode,
      source: "business",
    };
  }

  const mailing = addresses.mailing;
  if (mailing && (mailing.city || mailing.stateOrCountry)) {
    return {
      city: mailing.city,
      stateOrCountry: mailing.stateOrCountry,
      zipCode: mailing.zipCode,
      source: "mailing",
    };
  }

  return null;
}

/** Builds display location + region from SEC submissions address data. */
export function enrichLocationFromSubmissions(
  submissions: SecSubmissions,
): SecCompanyLocation | null {
  const addr = extractCompanyAddress(submissions);
  if (!addr) return null;

  const state = addr.stateOrCountry
    ? normalizeSecState(addr.stateOrCountry)
    : null;
  const region = state ? inferUsRegionFromState(state) : "any";
  const cityRaw = addr.city?.trim() || null;
  const city = cityRaw
    ? cityRaw.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
    : null;

  let displayLocation: string | null = null;
  if (city && state) displayLocation = `${city}, ${state}`;
  else if (city) displayLocation = city;
  else if (state) displayLocation = state;

  if (!displayLocation) return null;

  return {
    city,
    state,
    zipCode: addr.zipCode?.trim() || null,
    region,
    displayLocation,
  };
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

interface SecSignalTemplate {
  id: string;
  label: string;
  type: SignalType;
  /** Source-trail text (rendered after the "SEC" badge). */
  evidence: string;
  whyNow: string;
  suggestedAction: string;
}

const SEC_SIGNALS: Record<string, SecSignalTemplate> = {
  "sec-8k": {
    id: "sec-8k",
    label: "Recent 8-K event",
    type: "operational",
    evidence: "EDGAR · Recent 8-K",
    whyNow: "A recent 8-K signals a material event worth a timely outreach",
    suggestedAction: "Reference the recent 8-K event in your opener",
  },
  "sec-10k": {
    id: "sec-10k",
    label: "Recent 10-K filing",
    type: "regulatory",
    evidence: "EDGAR · Recent 10-K",
    whyNow: "A fresh annual report exposes current priorities and risks",
    suggestedAction: "Anchor your pitch to themes in their latest 10-K",
  },
  "sec-10q": {
    id: "sec-10q",
    label: "Recent 10-Q filing",
    type: "financial",
    evidence: "EDGAR · Recent 10-Q",
    whyNow: "A recent quarterly filing reflects the latest financial posture",
    suggestedAction: "Tie your value to trends in their latest quarter",
  },
  "sec-acquisition": {
    id: "sec-acquisition",
    label: "Acquisition / merger activity",
    type: "growth",
    evidence: "EDGAR · Acquisition / merger language",
    whyNow: "M&A activity is reopening systems, vendors, and integration needs",
    suggestedAction: "Position around integration and consolidation value",
  },
  "sec-risk-factors": {
    id: "sec-risk-factors",
    label: "Risk factor language",
    type: "regulatory",
    evidence: "EDGAR · Risk factor language",
    whyNow: "Disclosed risk factors point to active pain worth addressing",
    suggestedAction: "Map your offering to a disclosed risk factor",
  },
  "sec-leadership-change": {
    id: "sec-leadership-change",
    label: "Executive / leadership change",
    type: "leadership",
    evidence: "EDGAR · Leadership change (Item 5.02)",
    whyNow: "A leadership change often triggers a partner and vendor review",
    suggestedAction: "Engage the new leader with a focused first-90-days plan",
  },
  "sec-capital-investment": {
    id: "sec-capital-investment",
    label: "Capital investment / expansion",
    type: "financial",
    evidence: "EDGAR · Capital investment language",
    whyNow: "Capital is flowing toward expansion and new capacity",
    suggestedAction: "Quantify ROI on their stated capital plans",
  },
  "sec-cost-pressure": {
    id: "sec-cost-pressure",
    label: "Cost pressure",
    type: "financial",
    evidence: "EDGAR · Cost pressure language",
    whyNow: "Disclosed cost pressure sharpens appetite for savings",
    suggestedAction: "Lead with measurable cost reduction",
  },
};

function makeSignal(
  id: string,
  strength: SignalStrength,
  freshnessDays: number,
  evidenceOverride?: string,
): ProspectSignal | null {
  const tmpl = SEC_SIGNALS[id];
  if (!tmpl) return null;
  return {
    id: tmpl.id,
    label: tmpl.label,
    type: tmpl.type,
    strength,
    strengthScore: STRENGTH_SCORE[strength],
    source: "SEC",
    evidenceText: evidenceOverride ?? tmpl.evidence,
    whyNow: tmpl.whyNow,
    suggestedAction: tmpl.suggestedAction,
    freshnessDays,
    urgency: urgency(strength, freshnessDays),
  };
}

function daysBetween(filingDate: string, now: Date): number {
  const then = new Date(filingDate).getTime();
  if (Number.isNaN(then)) return 999;
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}

function freshnessStrength(days: number): SignalStrength {
  if (days <= 30) return "strong";
  if (days <= 120) return "moderate";
  return "weak";
}

/** Keep only the freshest instance of each signal id. */
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

/**
 * Extracts signals from recent filing metadata (form + 8-K item codes).
 * Considers filings within the last `windowDays` (default ~400).
 */
export function extractSignalsFromFilings(
  filings: FilingRef[],
  now: Date = new Date(),
  windowDays = 400,
): ProspectSignal[] {
  const out: ProspectSignal[] = [];

  for (const filing of filings) {
    const days = daysBetween(filing.filingDate, now);
    if (days > windowDays) continue;
    const form = filing.form.toUpperCase();
    const items = filing.items
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (form.startsWith("8-K")) {
      out.push(makeSignal("sec-8k", freshnessStrength(days), days)!);
      // Item 2.01 / 1.01 → completed/entered material acquisition agreement.
      if (items.some((it) => it === "2.01" || it === "1.01")) {
        out.push(makeSignal("sec-acquisition", "strong", days)!);
      }
      // Item 5.02 → director/officer departure or election.
      if (items.includes("5.02")) {
        out.push(makeSignal("sec-leadership-change", "strong", days)!);
      }
    } else if (form.startsWith("10-K")) {
      out.push(makeSignal("sec-10k", freshnessStrength(days), days)!);
      // 10-Ks always contain a Risk Factors section.
      out.push(makeSignal("sec-risk-factors", "moderate", days)!);
    } else if (form.startsWith("10-Q")) {
      out.push(makeSignal("sec-10q", freshnessStrength(days), days)!);
    }
  }

  return dedupe(out.filter((s): s is ProspectSignal => s !== null));
}

/** Language patterns for full-text-derived signals. */
const TEXT_PATTERNS: { id: string; re: RegExp }[] = [
  {
    id: "sec-acquisition",
    re: /\b(acquisition|acquire[ds]?|merger|merge[ds]?|business combination)\b/i,
  },
  { id: "sec-risk-factors", re: /\brisk factors?\b/i },
  {
    id: "sec-leadership-change",
    re: /\b(chief executive|chief financial|appoint(ed|ment)?|resign(ed|ation)?|departure of|newly elected|new president)\b/i,
  },
  {
    id: "sec-capital-investment",
    re: /\b(capital expenditure|capital expenditures|capex|new facility|plant expansion|expand(ing)? capacity|investing in)\b/i,
  },
  {
    id: "sec-cost-pressure",
    re: /\b(cost pressure|rising costs|margin pressure|inflationary|cost of goods)\b/i,
  },
];

/**
 * Extracts language-based signals from filing text (e.g. a 10-K excerpt).
 * Useful when a primary document's text is available; also exercised by tests.
 */
export function extractSignalsFromText(
  text: string,
  options: { filingDate?: string; now?: Date; strength?: SignalStrength } = {},
): ProspectSignal[] {
  if (!text) return [];
  const now = options.now ?? new Date();
  const days = options.filingDate ? daysBetween(options.filingDate, now) : 30;
  const strength = options.strength ?? "moderate";

  const out: ProspectSignal[] = [];
  for (const { id, re } of TEXT_PATTERNS) {
    if (re.test(text)) {
      const sig = makeSignal(id, strength, days);
      if (sig) out.push(sig);
    }
  }
  return dedupe(out);
}

/** Resets the in-memory ticker cache (testing/maintenance helper). */
export function _resetTickerCache(): void {
  tickerCache = null;
}
