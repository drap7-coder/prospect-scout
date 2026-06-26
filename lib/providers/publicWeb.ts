import type {
  BuyerPackId,
  ProspectSignal,
  SignalStrength,
  SignalType,
} from "@/lib/search/types";
import {
  HEALTH_PLAN_DIRECTORY,
  type HealthPlanDirectoryEntry,
} from "./directories/healthPlanDirectory";
import {
  MANUFACTURER_DIRECTORY,
  type ManufacturerDirectoryEntry,
} from "./directories/manufacturerDirectory";

/**
 * Public website / directory intelligence — fills gaps for private and
 * regional organizations not covered by SEC, CMS, RSS, or FDA.
 *
 * Uses curated directory registries plus shallow fetches of known public
 * pages on the organization's own domain only. No broad crawler, no Google,
 * no LinkedIn, no login/gated pages.
 */

export const PUBLIC_WEB_UNAVAILABLE_EVIDENCE =
  "unavailable — showing mock directory signals";

const MAX_DIRECTORY_MATCHES = 3;
const MAX_TEXT_CHARS = 50_000;

const BLOCKED_HOSTS = new Set([
  "linkedin.com",
  "www.linkedin.com",
  "google.com",
  "www.google.com",
  "facebook.com",
  "www.facebook.com",
  "twitter.com",
  "x.com",
]);

export type PublicPageType =
  | "home"
  | "about"
  | "news"
  | "press"
  | "careers"
  | "leadership"
  | "locations";

export interface PublicPagePath {
  path: string;
  pageType: PublicPageType;
  /** Source-trail label, e.g. "Careers page". */
  trailLabel: string;
}

export const PUBLIC_PAGE_PATHS: PublicPagePath[] = [
  { path: "/", pageType: "home", trailLabel: "Home page" },
  { path: "/about", pageType: "about", trailLabel: "About page" },
  { path: "/news", pageType: "news", trailLabel: "News page" },
  { path: "/press", pageType: "press", trailLabel: "Press page" },
  { path: "/careers", pageType: "careers", trailLabel: "Careers page" },
  { path: "/leadership", pageType: "leadership", trailLabel: "Leadership page" },
  { path: "/locations", pageType: "locations", trailLabel: "Locations page" },
];

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

export type TextFetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export interface ProviderOpts {
  fetchImpl?: TextFetchLike;
}

function resolveFetch(opts?: ProviderOpts): TextFetchLike {
  const impl = opts?.fetchImpl ?? (globalThis.fetch as unknown as TextFetchLike);
  if (!impl) {
    throw new Error("No fetch implementation available for publicWeb.");
  }
  return impl;
}

function webHeaders(): Record<string, string> {
  return {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent":
      "ProspectScout/1.0 (directory intelligence; +https://github.com/drap7-coder/prospect-scout)",
  };
}

/** Tracks page URLs that failed during a single fetchPublicWebProspects call. */
export class PageFailureCache {
  private failed = new Set<string>();

  has(url: string): boolean {
    return this.failed.has(url);
  }

  mark(url: string): void {
    this.failed.add(url);
  }
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

export function normalizeWebsiteOrigin(website: string): string {
  const trimmed = website.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withScheme);
  if (BLOCKED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`Blocked host: ${url.hostname}`);
  }
  return url.origin;
}

export function buildPageUrl(origin: string, path: string): string {
  const base = origin.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function buildPageCandidates(website: string): {
  url: string;
  pageType: PublicPageType;
  trailLabel: string;
}[] {
  const origin = normalizeWebsiteOrigin(website);
  return PUBLIC_PAGE_PATHS.map((p) => ({
    url: buildPageUrl(origin, p.path),
    pageType: p.pageType,
    trailLabel: p.trailLabel,
  }));
}

export function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Directory matching
// ---------------------------------------------------------------------------

export type DirectoryEntry = HealthPlanDirectoryEntry | ManufacturerDirectoryEntry;

export interface DirectoryMatch {
  entry: DirectoryEntry;
  matchedOn: string;
  score: number;
}

function normalizeHint(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferStatesFromText(hint: string): string[] {
  const states: string[] = [];
  const norm = hint.toLowerCase();
  const stateNames: Record<string, string> = {
    pennsylvania: "PA",
    "new york": "NY",
    massachusetts: "MA",
    michigan: "MI",
    minnesota: "MN",
    wisconsin: "WI",
    tennessee: "TN",
    oregon: "OR",
    utah: "UT",
    illinois: "IL",
    california: "CA",
    georgia: "GA",
    washington: "WA",
  };
  for (const [name, code] of Object.entries(stateNames)) {
    if (norm.includes(name)) states.push(code);
  }
  if (/\bpa\b/.test(norm)) states.push("PA");
  if (/\bny\b/.test(norm)) states.push("NY");
  if (/\bma\b/.test(norm)) states.push("MA");
  return [...new Set(states)];
}

function directoryForPack(buyerPack: BuyerPackId): DirectoryEntry[] {
  if (buyerPack === "health-plans") return HEALTH_PLAN_DIRECTORY;
  if (buyerPack === "manufacturers") return MANUFACTURER_DIRECTORY;
  return [];
}

const REGIONAL_KEYWORDS =
  /\b(regional|local|community|private|small|tpa|aso|co-?pack|contract packag|distributor|independent)\b/i;

const HEALTH_PLAN_DIRECTORY_KEYWORDS =
  /\b(health plan|health plans|regional plan|community plan|tpa|third party admin|aso|medicaid mco|local payer|regional payer)\b/i;

const MANUFACTURER_DIRECTORY_KEYWORDS =
  /\b(contract packag(?:ing|er)?|co-?pack(?:er|ing)?|private manufacturer|regional manufacturer|local food|food manufacturer|packager|distributors?|cold storage)\b/i;

/** Matches curated directory entries from query text. */
export function matchDirectoryEntries(
  hint: string,
  buyerPack: BuyerPackId,
  queryRegion?: string,
): DirectoryMatch[] {
  if (!hint?.trim()) return [];
  const registry = directoryForPack(buyerPack);
  if (registry.length === 0) return [];

  const normHint = normalizeHint(hint);
  const states = inferStatesFromText(hint);
  const candidates: DirectoryMatch[] = [];

  for (const entry of registry) {
    const names = [entry.name, ...entry.aliases].map(normalizeHint);
    for (const alias of names) {
      if (alias.length >= 3 && normHint.includes(alias)) {
        candidates.push({ entry, matchedOn: alias, score: alias.length + 20 });
      }
    }

    if (states.includes(entry.state)) {
      candidates.push({ entry, matchedOn: entry.state, score: 8 });
    }

    if (queryRegion && queryRegion !== "any" && entry.region === queryRegion) {
      candidates.push({ entry, matchedOn: entry.region, score: 6 });
    }
  }

  const byId = new Map<string, DirectoryMatch>();
  for (const c of candidates) {
    const existing = byId.get(c.entry.id);
    if (!existing || c.score > existing.score) byId.set(c.entry.id, c);
  }

  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, MAX_DIRECTORY_MATCHES);
}

/** True when directory / public-web intelligence should be attempted. */
export function isPublicWebScopedQuery(
  hint: string,
  buyerPack: BuyerPackId,
  queryRegion?: string,
): boolean {
  if (!hint?.trim()) return false;
  if (buyerPack !== "health-plans" && buyerPack !== "manufacturers") return false;

  if (matchDirectoryEntries(hint, buyerPack, queryRegion).length > 0) return true;

  if (buyerPack === "health-plans") {
    return (
      HEALTH_PLAN_DIRECTORY_KEYWORDS.test(hint) ||
      (REGIONAL_KEYWORDS.test(hint) && /\b(plan|payer|tpa|benefit)\b/i.test(hint))
    );
  }

  return (
    MANUFACTURER_DIRECTORY_KEYWORDS.test(hint) ||
    (REGIONAL_KEYWORDS.test(hint) &&
      /\b(manufactur|food|packag|plant|facility)\b/i.test(hint))
  );
}

/** Ranks directory entries for generic regional/criteria queries. */
export function rankDirectoryByCriteria(
  hint: string,
  buyerPack: BuyerPackId,
  queryRegion?: string,
): DirectoryMatch[] {
  const registry = directoryForPack(buyerPack);
  const states = inferStatesFromText(hint);
  const norm = hint.toLowerCase();
  const ranked: DirectoryMatch[] = [];

  for (const entry of registry) {
    let score = 0;
    const reasons: string[] = [];

    if (states.includes(entry.state)) {
      score += 10;
      reasons.push(entry.state);
    }
    if (queryRegion && queryRegion !== "any" && entry.region === queryRegion) {
      score += 8;
      reasons.push(entry.region);
    }

    if (buyerPack === "health-plans") {
      const hp = entry as HealthPlanDirectoryEntry;
      if (/\btpa\b/i.test(norm) && hp.buyerType === "tpa") {
        score += 12;
        reasons.push("TPA");
      }
      if (/\b(medicaid|mco)\b/i.test(norm) && hp.buyerType === "medicaid-mco") {
        score += 10;
        reasons.push("Medicaid MCO");
      }
      if (/\bcommunity\b/i.test(norm) && hp.buyerType === "community-plan") {
        score += 8;
        reasons.push("community plan");
      }
    }

    if (buyerPack === "manufacturers") {
      const mf = entry as ManufacturerDirectoryEntry;
      if (/\bcontract packag|co-?pack\b/i.test(norm) && mf.category === "contract-packaging") {
        score += 12;
        reasons.push("contract packaging");
      }
      if (/\bdistribut/i.test(norm) && mf.category === "distribution") {
        score += 10;
        reasons.push("distribution");
      }
      if (/\bfood\b/i.test(norm) && mf.category === "food") {
        score += 8;
        reasons.push("food");
      }
    }

    if (score > 0) {
      ranked.push({
        entry,
        matchedOn: reasons.length > 0 ? reasons.join(" · ") : "directory match",
        score,
      });
    }
  }

  return ranked.sort(
    (a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name),
  );
}

// ---------------------------------------------------------------------------
// HTML → text
// ---------------------------------------------------------------------------

export function stripHtmlToText(html: string): string {
  const noScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = noScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, MAX_TEXT_CHARS);
}

// ---------------------------------------------------------------------------
// Signal extraction
// ---------------------------------------------------------------------------

const STRENGTH_SCORE: Record<SignalStrength, number> = {
  weak: 0.45,
  moderate: 0.7,
  strong: 1,
};

function urgency(strength: SignalStrength): number {
  return STRENGTH_SCORE[strength] * 0.85;
}

interface WebSignalTemplate {
  id: string;
  label: string;
  type: SignalType;
  trailLabel: string;
  whyNow: string;
  suggestedAction: string;
}

const WEB_SIGNALS: Record<string, WebSignalTemplate> = {
  "web-expansion": {
    id: "web-expansion",
    label: "Expansion",
    type: "growth",
    trailLabel: "Expansion language",
    whyNow: "Public expansion language signals new investment and capacity needs",
    suggestedAction: "Reference their growth priorities and tie your value to scale",
  },
  "web-hiring": {
    id: "web-hiring",
    label: "Hiring activity",
    type: "growth",
    trailLabel: "Hiring activity",
    whyNow: "Active hiring indicates budget flowing toward people and programs",
    suggestedAction: "Engage while teams are staffing up and setting direction",
  },
  "web-leadership-change": {
    id: "web-leadership-change",
    label: "Leadership change",
    type: "leadership",
    trailLabel: "Leadership change",
    whyNow: "Leadership pages mentioning new executives open vendor review windows",
    suggestedAction: "Congratulate new leaders and offer a focused first-90-days plan",
  },
  "web-acquisition": {
    id: "web-acquisition",
    label: "Acquisition activity",
    type: "growth",
    trailLabel: "Acquisition language",
    whyNow: "M&A language on public pages suggests integration and vendor realignment",
    suggestedAction: "Position around consolidation savings and integration support",
  },
  "web-new-product-service": {
    id: "web-new-product-service",
    label: "New product or service",
    type: "demand",
    trailLabel: "New product / service",
    whyNow: "New offerings reshape supply, packaging, and program needs",
    suggestedAction: "Map your solution to the announced product or service line",
  },
  "web-sustainability": {
    id: "web-sustainability",
    label: "Sustainability initiative",
    type: "operational",
    trailLabel: "Sustainability initiative",
    whyNow: "Sustainability goals trigger materials and process change",
    suggestedAction: "Lead with measurable environmental impact and waste reduction",
  },
  "web-regulatory-compliance": {
    id: "web-regulatory-compliance",
    label: "Regulatory / compliance focus",
    type: "regulatory",
    trailLabel: "Regulatory / compliance language",
    whyNow: "Compliance language on public pages signals near-term regulatory investment",
    suggestedAction: "Frame your offering as audit-ready and compliance-aligned",
  },
  "web-packaging-automation": {
    id: "web-packaging-automation",
    label: "Packaging / automation focus",
    type: "operational",
    trailLabel: "Packaging / automation language",
    whyNow: "Packaging and automation mentions indicate active line investment",
    suggestedAction: "Quantify throughput, changeover, and automation ROI",
  },
  "web-pharmacy-pbm-specialty": {
    id: "web-pharmacy-pbm-specialty",
    label: "Pharmacy / PBM / specialty focus",
    type: "financial",
    trailLabel: "Pharmacy / PBM language",
    whyNow: "Pharmacy and PBM language signals active formulary and trend management",
    suggestedAction: "Lead with pharmacy trend benchmarks and PBM transition support",
  },
};

const WEB_PATTERNS: { id: string; re: RegExp }[] = [
  {
    id: "web-expansion",
    re: /\b(expan(d|ds|sion|ding)|new (facility|location|site|market|region|office|clinic)|opens? (new|a)|grow(s|ing)? footprint|additional capacity)\b/i,
  },
  {
    id: "web-hiring",
    re: /\b(hiring|careers|join our team|open positions|we.?re hiring|job openings|work with us|now hiring)\b/i,
  },
  {
    id: "web-leadership-change",
    re: /\b(appoint(ed|s|ment)?|names? new|chief executive|ceo|cfo|president|executive vice|leadership team|new leader|steps down|succeeds)\b/i,
  },
  {
    id: "web-acquisition",
    re: /\b(acqui(re|s|red|sition)|merger|merge[ds]?|business combination|combined with)\b/i,
  },
  {
    id: "web-new-product-service",
    re: /\b(new product|new service|launch(es|ed|ing)?|introduc(es|ed|ing)|unveil(s|ed|ing)?|innovation|product line)\b/i,
  },
  {
    id: "web-sustainability",
    re: /\b(sustainab(le|ility)|carbon neutral|net zero|environmental stewardship|renewable|recycl)\b/i,
  },
  {
    id: "web-regulatory-compliance",
    re: /\b(regulat(ory|ion|ed)|compliance|accreditation|hipaa|cms|fda|audit|quality system)\b/i,
  },
  {
    id: "web-packaging-automation",
    re: /\b(packaging|automation|robotics|conveyor|filling line|co-?pack|contract packag|labeling line)\b/i,
  },
  {
    id: "web-pharmacy-pbm-specialty",
    re: /\b(pharmacy|pbm|pharmacy benefit|specialty drug|formulary|part d|medicare advantage|340b)\b/i,
  },
];

function makeWebSignal(
  id: string,
  evidenceText: string,
  strength: SignalStrength = "moderate",
): ProspectSignal | null {
  const tmpl = WEB_SIGNALS[id];
  if (!tmpl) return null;
  return {
    id: tmpl.id,
    label: tmpl.label,
    type: tmpl.type,
    strength,
    strengthScore: STRENGTH_SCORE[strength],
    source: "Company",
    evidenceText,
    whyNow: tmpl.whyNow,
    suggestedAction: tmpl.suggestedAction,
    freshnessDays: 30,
    urgency: urgency(strength),
  };
}

function dedupeSignals(signals: ProspectSignal[]): ProspectSignal[] {
  const byId = new Map<string, ProspectSignal>();
  for (const s of signals) {
    if (!byId.has(s.id)) byId.set(s.id, s);
  }
  return [...byId.values()].sort((a, b) => b.urgency - a.urgency);
}

/**
 * Extracts ProspectSignals from plain page text.
 */
export function extractSignalsFromPageText(
  text: string,
  pageTrailLabel: string,
): ProspectSignal[] {
  if (!text?.trim()) return [];
  const out: ProspectSignal[] = [];

  for (const { id, re } of WEB_PATTERNS) {
    if (!re.test(text)) continue;
    const tmpl = WEB_SIGNALS[id];
    const sig = makeWebSignal(
      id,
      `${tmpl.trailLabel} · Public Web · ${pageTrailLabel}`,
    );
    if (sig) out.push(sig);
  }

  return dedupeSignals(out);
}

// ---------------------------------------------------------------------------
// Page fetch
// ---------------------------------------------------------------------------

export interface PublicPageResult {
  url: string;
  pageType: PublicPageType;
  trailLabel: string;
  text: string;
  signals: ProspectSignal[];
}

export async function fetchPublicPage(
  url: string,
  pageType: PublicPageType,
  trailLabel: string,
  origin: string,
  opts?: ProviderOpts,
): Promise<PublicPageResult | null> {
  if (!isSameOrigin(url, origin)) return null;

  const fetchImpl = resolveFetch(opts);
  const res = await fetchImpl(url, { headers: webHeaders() });
  if (!res.ok) return null;

  const html = await res.text();
  const text = stripHtmlToText(html);
  if (text.length < 80) return null;

  const signals = extractSignalsFromPageText(text, trailLabel);
  return { url, pageType, trailLabel, text, signals };
}

/**
 * Fetches known public pages from a website origin, skipping cached failures.
 */
export async function fetchPublicPages(
  website: string,
  cache: PageFailureCache,
  opts?: ProviderOpts,
): Promise<PublicPageResult[]> {
  const origin = normalizeWebsiteOrigin(website);
  const candidates = buildPageCandidates(website);
  const results: PublicPageResult[] = [];

  for (const candidate of candidates) {
    if (cache.has(candidate.url)) continue;
    try {
      const page = await fetchPublicPage(
        candidate.url,
        candidate.pageType,
        candidate.trailLabel,
        origin,
        opts,
      );
      if (!page) {
        cache.mark(candidate.url);
        continue;
      }
      results.push(page);
    } catch {
      cache.mark(candidate.url);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Prospect orchestration
// ---------------------------------------------------------------------------

export interface PublicWebPageTrail {
  pageType: PublicPageType;
  trailLabel: string;
  url: string;
}

export interface PublicWebFetchResult {
  match: DirectoryMatch;
  confidence: "named" | "criteria";
  pages: PublicPageResult[];
  signals: ProspectSignal[];
  pageTrails: PublicWebPageTrail[];
  location: string;
  region: string;
  size: "mid" | "large" | "enterprise";
}

export interface PublicWebProspectsResponse {
  results: PublicWebFetchResult[];
  allSourcesFailed: boolean;
}

function entryLocation(entry: DirectoryEntry): string {
  return `${entry.state} · ${entry.name.split(" ")[0]} region`;
}

function entrySize(entry: DirectoryEntry): "mid" | "large" | "enterprise" {
  if (entry.id.includes("kehe") || entry.id.includes("schreiber")) return "enterprise";
  if (entry.id.includes("allied") || entry.id.includes("harbor")) return "mid";
  return "large";
}

function mergePageSignals(pages: PublicPageResult[]): {
  signals: ProspectSignal[];
  pageTrails: PublicWebPageTrail[];
} {
  const signals: ProspectSignal[] = [];
  const pageTrails: PublicWebPageTrail[] = [];

  for (const page of pages) {
    if (page.signals.length > 0) {
      pageTrails.push({
        pageType: page.pageType,
        trailLabel: page.trailLabel,
        url: page.url,
      });
      signals.push(...page.signals);
    }
  }

  return { signals: dedupeSignals(signals), pageTrails };
}

async function buildPublicWebResult(
  match: DirectoryMatch,
  confidence: "named" | "criteria",
  cache: PageFailureCache,
  opts?: ProviderOpts,
): Promise<PublicWebFetchResult | null> {
  const pages = await fetchPublicPages(match.entry.website, cache, opts);
  const { signals, pageTrails } = mergePageSignals(pages);
  if (signals.length === 0) return null;

  return {
    match,
    confidence,
    pages,
    signals,
    pageTrails,
    location: entryLocation(match.entry),
    region: match.entry.region,
    size: entrySize(match.entry),
  };
}

/**
 * Resolves public-web prospects from directory matches and shallow page fetches.
 */
export async function fetchPublicWebProspects(
  hint: string,
  buyerPack: BuyerPackId,
  queryRegion?: string,
  opts?: ProviderOpts,
): Promise<PublicWebProspectsResponse> {
  if (!isPublicWebScopedQuery(hint, buyerPack, queryRegion)) {
    return { results: [], allSourcesFailed: false };
  }

  const cache = new PageFailureCache();
  const namedMatches = matchDirectoryEntries(hint, buyerPack, queryRegion);
  const namedByName = namedMatches.filter((m) => m.score >= 20);

  if (namedByName.length > 0) {
    const results: PublicWebFetchResult[] = [];
    for (const match of namedByName.slice(0, MAX_DIRECTORY_MATCHES)) {
      const result = await buildPublicWebResult(match, "named", cache, opts);
      if (result) results.push(result);
    }
    return {
      results,
      allSourcesFailed: results.length === 0 && namedByName.length > 0,
    };
  }

  const ranked = rankDirectoryByCriteria(hint, buyerPack, queryRegion);
  if (ranked.length === 0) {
    return { results: [], allSourcesFailed: false };
  }

  const results: PublicWebFetchResult[] = [];
  for (const match of ranked.slice(0, MAX_DIRECTORY_MATCHES)) {
    const result = await buildPublicWebResult(match, "criteria", cache, opts);
    if (result) results.push(result);
  }

  return {
    results,
    allSourcesFailed: results.length === 0 && ranked.length > 0,
  };
}

/** Source-trail row for a fetched public page. */
export function publicWebTrailItem(trailLabel: string): {
  source: "Public Web";
  evidenceText: string;
} {
  return { source: "Public Web", evidenceText: trailLabel };
}
