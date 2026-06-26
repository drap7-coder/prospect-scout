import type {
  BuyerPackId,
  ProspectSignal,
  SignalStrength,
  SignalType,
} from "@/lib/search/types";

/**
 * FDA / openFDA provider — fourth REAL public-data source.
 *
 * Queries openFDA enforcement (recall) endpoints for food, drug, and device
 * records. No auth required; optional FDA_API_KEY improves rate limits.
 *
 * Design notes:
 *   - Self-contained (type-only imports) for offline unit tests.
 *   - Injectable `fetch` for tests; global fetch in production.
 *   - HTTP failures throw; empty API results return gracefully.
 */

/** Source-trail text when FDA is unavailable (source badge adds "FDA ·"). */
export const FDA_UNAVAILABLE_EVIDENCE =
  "unavailable — showing mock regulatory signals";

const DEFAULT_WINDOW_DAYS = 1460;
const MAX_RECORDS = 25;
const MAX_GENERIC_FDA_RESULTS = 3;

export type FdaDomain = "food" | "drug" | "device";

const FDA_BASE = "https://api.fda.gov";

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface ProviderOpts {
  fetchImpl?: FetchLike;
  /** Optional openFDA API key (falls back to FDA_API_KEY env). */
  apiKey?: string;
  limit?: number;
}

function resolveFetch(opts?: ProviderOpts): FetchLike {
  const impl = opts?.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  if (!impl) {
    throw new Error("No fetch implementation available for FDA.");
  }
  return impl;
}

export function resolveFdaApiKey(opts?: ProviderOpts): string | undefined {
  const key = opts?.apiKey ?? process.env.FDA_API_KEY?.trim();
  return key || undefined;
}

export function enforcementSearchUrl(
  domain: FdaDomain,
  search: string,
  opts?: ProviderOpts,
): string {
  const params = new URLSearchParams();
  params.set("search", search);
  params.set("limit", String(opts?.limit ?? MAX_RECORDS));
  params.set("sort", "recall_initiation_date:desc");
  const apiKey = resolveFdaApiKey(opts);
  if (apiKey) params.set("api_key", apiKey);
  return `${FDA_BASE}/${domain}/enforcement.json?${params.toString()}`;
}

function fdaHeaders(): Record<string, string> {
  return { Accept: "application/json" };
}

// ---------------------------------------------------------------------------
// openFDA record shape (enforcement / recall)
// ---------------------------------------------------------------------------

export interface FdaEnforcementRecord {
  recalling_firm?: string;
  product_description?: string;
  reason_for_recall?: string;
  classification?: string;
  status?: string;
  city?: string;
  state?: string;
  country?: string;
  report_date?: string;
  recall_initiation_date?: string;
  event_id?: string;
  recall_number?: string;
  product_type?: string;
}

interface OpenFdaResponse {
  results?: FdaEnforcementRecord[];
  error?: { code?: string; message?: string };
}

export async function fetchEnforcementRecords(
  domain: FdaDomain,
  search: string,
  opts?: ProviderOpts,
): Promise<FdaEnforcementRecord[]> {
  const fetchImpl = resolveFetch(opts);
  const url = enforcementSearchUrl(domain, search, opts);
  const res = await fetchImpl(url, { headers: fdaHeaders() });

  if (res.status === 404) return [];

  const body = (await res.json()) as OpenFdaResponse;
  if (!res.ok) {
    const msg = body.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`openFDA ${domain} enforcement returned ${msg}`);
  }

  return body.results ?? [];
}

// ---------------------------------------------------------------------------
// Firm registry (curated recalling firms for named matching)
// ---------------------------------------------------------------------------

export interface FdaFirmProfile {
  id: string;
  firmName: string;
  buyerPacks: BuyerPackId[];
  aliases: string[];
  location: string;
  region: string;
  size: "mid" | "large" | "enterprise";
  /** Preferred openFDA domains for this firm (defaults to all three). */
  domains?: FdaDomain[];
}

export const FDA_FIRM_REGISTRY: FdaFirmProfile[] = [
  {
    id: "fda-general-mills",
    firmName: "General Mills",
    buyerPacks: ["manufacturers"],
    aliases: ["general mills", "generalmills"],
    location: "Minneapolis, MN",
    region: "midwest",
    size: "enterprise",
    domains: ["food"],
  },
  {
    id: "fda-pepsico",
    firmName: "PepsiCo",
    buyerPacks: ["manufacturers"],
    aliases: ["pepsico", "pepsi"],
    location: "Purchase, NY",
    region: "mid-atlantic",
    size: "enterprise",
    domains: ["food"],
  },
  {
    id: "fda-kraft-heinz",
    firmName: "Kraft Heinz",
    buyerPacks: ["manufacturers"],
    aliases: ["kraft heinz", "kraft", "heinz"],
    location: "Chicago, IL",
    region: "midwest",
    size: "enterprise",
    domains: ["food"],
  },
  {
    id: "fda-jnj",
    firmName: "Johnson & Johnson",
    buyerPacks: ["manufacturers", "health-systems"],
    aliases: ["johnson & johnson", "johnson and johnson", "j&j", "jnj"],
    location: "New Brunswick, NJ",
    region: "mid-atlantic",
    size: "enterprise",
    domains: ["drug", "device"],
  },
  {
    id: "fda-pfizer",
    firmName: "Pfizer",
    buyerPacks: ["manufacturers", "health-systems"],
    aliases: ["pfizer"],
    location: "New York, NY",
    region: "northeast",
    size: "enterprise",
    domains: ["drug"],
  },
  {
    id: "fda-abbott",
    firmName: "Abbott",
    buyerPacks: ["manufacturers", "health-systems"],
    aliases: ["abbott", "abbott laboratories"],
    location: "Abbott Park, IL",
    region: "midwest",
    size: "enterprise",
    domains: ["drug", "device"],
  },
  {
    id: "fda-medtronic",
    firmName: "Medtronic",
    buyerPacks: ["manufacturers", "health-systems"],
    aliases: ["medtronic"],
    location: "Minneapolis, MN",
    region: "midwest",
    size: "enterprise",
    domains: ["device"],
  },
  {
    id: "fda-boston-scientific",
    firmName: "Boston Scientific",
    buyerPacks: ["manufacturers", "health-systems"],
    aliases: ["boston scientific"],
    location: "Marlborough, MA",
    region: "northeast",
    size: "enterprise",
    domains: ["device"],
  },
  {
    id: "fda-baxter",
    firmName: "Baxter",
    buyerPacks: ["manufacturers", "health-systems"],
    aliases: ["baxter", "baxter international"],
    location: "Deerfield, IL",
    region: "midwest",
    size: "enterprise",
    domains: ["drug", "device"],
  },
  {
    id: "fda-tyson",
    firmName: "Tyson Foods",
    buyerPacks: ["manufacturers", "employers"],
    aliases: ["tyson", "tyson foods"],
    location: "Springdale, AR",
    region: "southwest",
    size: "enterprise",
    domains: ["food"],
  },
];

const FDA_CATEGORY_KEYWORDS =
  /\b(food|pharma|pharmaceutical|drug|device|medical device|packaging|contamination|labeling|recall|manufacturing|production|plant|facility|supply chain|quality|safety)\b/i;

const EMPLOYER_FDA_KEYWORDS =
  /\b(food|pharma|pharmaceutical|drug|device|medical device|supply chain|packaging|contamination|recall|manufacturing)\b/i;

const HEALTH_SYSTEM_FDA_KEYWORDS =
  /\b(medical device|device recall|pharma|drug supply|pharmacy supply|implant|diagnostic|sterile|contamination|medical supply|surgical supply)\b/i;

function normalizeHint(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface FdaFirmMatch {
  firm: FdaFirmProfile;
  matchedOn: string;
}

/** Matches a curated recalling firm from query text and buyer pack. */
export function matchFdaFirm(
  hint: string,
  buyerPack: BuyerPackId,
  registry: FdaFirmProfile[] = FDA_FIRM_REGISTRY,
): FdaFirmMatch | null {
  if (!hint?.trim()) return null;
  const normHint = normalizeHint(hint);

  for (const firm of registry) {
    if (!firm.buyerPacks.includes(buyerPack)) continue;
    const names = [firm.firmName, ...firm.aliases].map(normalizeHint);
    for (const alias of names) {
      if (alias.length >= 3 && normHint.includes(alias)) {
        return { firm, matchedOn: alias };
      }
    }
  }
  return null;
}

export interface FdaSearchCriteria {
  domains: FdaDomain[];
  reasonTerms: string[];
}

/** Infers openFDA domains and reason-for-recall terms from free text. */
export function parseFdaSearchCriteria(hint: string): FdaSearchCriteria {
  const norm = hint.toLowerCase();
  const domains: FdaDomain[] = [];

  if (/\b(food|beverage|snack|cpg|consumer goods|grocery)\b/.test(norm)) {
    domains.push("food");
  }
  if (/\b(pharma|pharmaceutical|drug|medicine|biologic|vaccine)\b/.test(norm)) {
    domains.push("drug");
  }
  if (/\b(device|medical device|implant|diagnostic|surgical)\b/.test(norm)) {
    domains.push("device");
  }
  if (domains.length === 0) {
    domains.push("food", "drug", "device");
  }

  const reasonTerms: string[] = [];
  if (/\bpackaging\b/.test(norm)) reasonTerms.push("packaging");
  if (/\bcontamination\b/.test(norm)) reasonTerms.push("contamination");
  if (/\blabel(ing)?\b/.test(norm)) reasonTerms.push("label");
  if (/\bquality\b/.test(norm)) reasonTerms.push("quality");
  if (/\brecall\b/.test(norm)) reasonTerms.push("recall");
  if (/\bsafety\b/.test(norm)) reasonTerms.push("safety");

  return { domains, reasonTerms };
}

export function buildGenericEnforcementSearch(
  criteria: FdaSearchCriteria,
): string {
  if (criteria.reasonTerms.length === 0) {
    const year = new Date().getFullYear();
    const start = `${year - 1}0101`;
    const end = `${year}1231`;
    return `report_date:[${start}+TO+${end}]`;
  }
  if (criteria.reasonTerms.length === 1) {
    return `reason_for_recall:${criteria.reasonTerms[0]}`;
  }
  return criteria.reasonTerms
    .map((t) => `reason_for_recall:${t}`)
    .join("+OR+");
}

export function buildFirmEnforcementSearch(firmName: string): string {
  return `recalling_firm:"${firmName}"`;
}

/** True when employers pack query clearly references food/pharma/device supply chain. */
export function isEmployerFdaScopedQuery(hint: string, sells?: string): boolean {
  const combined = `${hint} ${sells ?? ""}`.trim();
  return EMPLOYER_FDA_KEYWORDS.test(combined);
}

/** True when the query is scoped enough to attempt FDA for the buyer pack. */
export function isFdaScopedQuery(
  hint: string,
  buyerPack: BuyerPackId,
  sells?: string,
): boolean {
  if (!hint?.trim()) return false;
  if (buyerPack === "health-plans") return false;

  if (matchFdaFirm(hint, buyerPack)) return true;

  if (buyerPack === "manufacturers") {
    if (FDA_CATEGORY_KEYWORDS.test(hint)) return true;
    return /\b(manufacturer|manufacturers|manufacturing|plant|production|facility)\b/i.test(
      hint,
    );
  }

  if (buyerPack === "health-systems") {
    if (HEALTH_SYSTEM_FDA_KEYWORDS.test(hint)) return true;
    return false;
  }

  if (buyerPack === "employers") {
    return isEmployerFdaScopedQuery(hint, sells);
  }

  return false;
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
  return Math.max(0, Math.min(1, 1 - days / 365));
}

function urgency(strength: SignalStrength, days: number): number {
  return STRENGTH_SCORE[strength] * 0.6 + freshnessFactor(days) * 0.4;
}

interface FdaSignalTemplate {
  id: string;
  label: string;
  type: SignalType;
  trailLabel: string;
  whyNow: string;
  suggestedAction: string;
}

const FDA_SIGNALS: Record<string, FdaSignalTemplate> = {
  "fda-food-recall": {
    id: "fda-food-recall",
    label: "Food recall",
    type: "regulatory",
    trailLabel: "Food recall · openFDA",
    whyNow: "A food recall forces rapid corrective action and supplier review",
    suggestedAction: "Offer quality controls and traceability aligned to recall response",
  },
  "fda-drug-recall": {
    id: "fda-drug-recall",
    label: "Drug recall",
    type: "regulatory",
    trailLabel: "Drug recall · openFDA",
    whyNow: "Drug recalls trigger compliance remediation and supply disruption",
    suggestedAction: "Position around batch integrity and GMP remediation support",
  },
  "fda-device-recall": {
    id: "fda-device-recall",
    label: "Device recall",
    type: "regulatory",
    trailLabel: "Device recall · openFDA",
    whyNow: "Device recalls create urgent clinical supply and liability pressure",
    suggestedAction: "Engage supply chain and quality leaders on replacement workflows",
  },
  "fda-manufacturing-quality": {
    id: "fda-manufacturing-quality",
    label: "Manufacturing quality issue",
    type: "regulatory",
    trailLabel: "Manufacturing quality · openFDA",
    whyNow: "Quality deviations expose process gaps and remediation spend",
    suggestedAction: "Lead with CAPA support and process validation expertise",
  },
  "fda-labeling-issue": {
    id: "fda-labeling-issue",
    label: "Labeling issue",
    type: "regulatory",
    trailLabel: "Labeling issue · openFDA",
    whyNow: "Labeling errors force relabeling and compliance corrections",
    suggestedAction: "Offer labeling verification and change-control support",
  },
  "fda-packaging-contamination": {
    id: "fda-packaging-contamination",
    label: "Packaging / contamination issue",
    type: "regulatory",
    trailLabel: "Packaging / contamination · openFDA",
    whyNow: "Packaging or contamination events demand immediate containment action",
    suggestedAction: "Pitch packaging integrity and contamination prevention solutions",
  },
  "fda-regulatory-pressure": {
    id: "fda-regulatory-pressure",
    label: "Regulatory pressure",
    type: "regulatory",
    trailLabel: "Regulatory enforcement · openFDA",
    whyNow: "FDA enforcement activity sharpens appetite for compliance investment",
    suggestedAction: "Frame your solution as a fast path to audit readiness",
  },
  "fda-product-safety": {
    id: "fda-product-safety",
    label: "Product safety event",
    type: "regulatory",
    trailLabel: "Product safety event · openFDA",
    whyNow: "Product safety events elevate risk management and remediation urgency",
    suggestedAction: "Lead with safety monitoring and incident response capabilities",
  },
};

const DOMAIN_RECALL_ID: Record<FdaDomain, string> = {
  food: "fda-food-recall",
  drug: "fda-drug-recall",
  device: "fda-device-recall",
};

interface FdaPattern {
  id: string;
  re: RegExp;
}

const FDA_PATTERNS: FdaPattern[] = [
  {
    id: "fda-manufacturing-quality",
    re: /\b(quality|gmp|good manufacturing|process deviation|sterility|specification|nonconform)\b/i,
  },
  {
    id: "fda-labeling-issue",
    re: /\b(label(ing)?|mislabel|undeclared allergen|incorrect label|misbranded)\b/i,
  },
  {
    id: "fda-packaging-contamination",
    re: /\b(packaging|container|contaminat|salmonella|listeria|e\.?\s*coli|bacterial|foreign material|particulate)\b/i,
  },
  {
    id: "fda-regulatory-pressure",
    re: /\b(class i|mandatory recall|fda inspection|enforcement|violation|consent decree)\b/i,
  },
  {
    id: "fda-product-safety",
    re: /\b(safety|injury|adverse|hazard|risk of harm|health risk|potentially harmful)\b/i,
  },
];

export function parseFdaDate(dateStr: string): Date | null {
  if (!dateStr?.trim()) return null;
  const raw = dateStr.trim();
  if (/^\d{8}$/.test(raw)) {
    const y = Number(raw.slice(0, 4));
    const m = Number(raw.slice(4, 6)) - 1;
    const d = Number(raw.slice(6, 8));
    const dt = new Date(Date.UTC(y, m, d));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function daysSinceFdaDate(
  dateStr: string,
  now: Date = new Date(),
): number {
  const dt = parseFdaDate(dateStr);
  if (!dt) return 999;
  return Math.max(0, Math.floor((now.getTime() - dt.getTime()) / 86_400_000));
}

function classificationStrength(classification?: string): SignalStrength {
  const c = classification?.toLowerCase() ?? "";
  if (c.includes("class i")) return "strong";
  if (c.includes("class ii")) return "moderate";
  if (c.includes("class iii")) return "weak";
  return "moderate";
}

function freshnessStrength(days: number): SignalStrength {
  if (days <= 30) return "strong";
  if (days <= 120) return "moderate";
  return "weak";
}

function combineStrength(a: SignalStrength, b: SignalStrength): SignalStrength {
  const order: SignalStrength[] = ["weak", "moderate", "strong"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

function makeFdaSignal(
  id: string,
  strength: SignalStrength,
  freshnessDays: number,
  evidenceText: string,
): ProspectSignal | null {
  const tmpl = FDA_SIGNALS[id];
  if (!tmpl) return null;
  return {
    id: tmpl.id,
    label: tmpl.label,
    type: tmpl.type,
    strength,
    strengthScore: STRENGTH_SCORE[strength],
    source: "FDA",
    evidenceText,
    whyNow: tmpl.whyNow,
    suggestedAction: tmpl.suggestedAction,
    freshnessDays,
    urgency: urgency(strength, freshnessDays),
  };
}

function dedupeSignals(signals: ProspectSignal[]): ProspectSignal[] {
  const byId = new Map<string, ProspectSignal>();
  for (const s of signals) {
    const existing = byId.get(s.id);
    if (!existing || s.freshnessDays < existing.freshnessDays) {
      byId.set(s.id, s);
    }
  }
  return [...byId.values()].sort((a, b) => b.urgency - a.urgency);
}

function recordText(record: FdaEnforcementRecord): string {
  return [
    record.reason_for_recall,
    record.product_description,
    record.classification,
    record.status,
  ]
    .filter(Boolean)
    .join(" ");
}

function recordFreshnessDays(record: FdaEnforcementRecord, now: Date): number {
  const dates = [
    record.recall_initiation_date,
    record.report_date,
  ].filter(Boolean) as string[];
  if (dates.length === 0) return 999;
  return Math.min(...dates.map((d) => daysSinceFdaDate(d, now)));
}

/**
 * Extracts ProspectSignals from openFDA enforcement records for a domain.
 */
export function extractSignalsFromRecalls(
  records: FdaEnforcementRecord[],
  domain: FdaDomain,
  now: Date = new Date(),
  windowDays = DEFAULT_WINDOW_DAYS,
): ProspectSignal[] {
  const out: ProspectSignal[] = [];

  for (const record of records) {
    const days = recordFreshnessDays(record, now);
    if (days > windowDays) continue;

    const text = recordText(record);
    if (!text.trim()) continue;

    const classStrength = classificationStrength(record.classification);
    const freshStrength = freshnessStrength(days);
    const strength = combineStrength(classStrength, freshStrength);

    const headline =
      record.reason_for_recall?.slice(0, 80) ??
      record.product_description?.slice(0, 80) ??
      "Recall event";
    const shortHeadline =
      headline.length > 60 ? `${headline.slice(0, 57)}…` : headline;

    const recallId = DOMAIN_RECALL_ID[domain];
    const recallTmpl = FDA_SIGNALS[recallId];
    const recallSig = makeFdaSignal(
      recallId,
      strength,
      days,
      `${recallTmpl.trailLabel} · ${shortHeadline}`,
    );
    if (recallSig) out.push(recallSig);

    for (const { id, re } of FDA_PATTERNS) {
      if (!re.test(text)) continue;
      const tmpl = FDA_SIGNALS[id];
      const sig = makeFdaSignal(
        id,
        strength,
        days,
        `${tmpl.trailLabel} · ${shortHeadline}`,
      );
      if (sig) out.push(sig);
    }
  }

  return dedupeSignals(out);
}

// ---------------------------------------------------------------------------
// Prospect orchestration
// ---------------------------------------------------------------------------

export interface InferredFdaFirm {
  id: string;
  firmName: string;
  location: string;
  region: string;
  size: "mid" | "large";
}

export type FdaMatchedFirm = FdaFirmProfile | InferredFdaFirm;

export interface FdaFetchResult {
  firm: FdaMatchedFirm;
  matchedOn: string;
  confidence: "named" | "criteria";
  domains: FdaDomain[];
  records: FdaEnforcementRecord[];
  signals: ProspectSignal[];
}

export interface FdaProspectsResponse {
  results: FdaFetchResult[];
  allSourcesFailed: boolean;
}

function slugifyFirm(name: string): string {
  return normalizeHint(name).replace(/\s+/g, "-").slice(0, 40);
}

function inferRegionFromState(state?: string): string {
  const s = state?.toUpperCase()?.trim();
  if (!s) return "any";
  const northeast = new Set(["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA"]);
  const southeast = new Set(["DE", "MD", "DC", "VA", "WV", "NC", "SC", "GA", "FL", "KY", "TN", "AL", "MS", "LA", "AR"]);
  const midwest = new Set(["OH", "MI", "IN", "IL", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"]);
  const southwest = new Set(["TX", "OK", "NM", "AZ"]);
  const west = new Set(["CO", "WY", "MT", "ID", "UT", "NV", "CA", "OR", "WA", "AK", "HI"]);
  if (northeast.has(s)) return "northeast";
  if (southeast.has(s)) return "southeast";
  if (midwest.has(s)) return "midwest";
  if (southwest.has(s)) return "southwest";
  if (west.has(s)) return "west";
  return "any";
}

function locationFromRecord(record: FdaEnforcementRecord): string {
  const city = record.city?.trim();
  const state = record.state?.trim();
  if (city && state) return `${city}, ${state}`;
  if (state) return state;
  return "United States";
}

function buildInferredFirm(
  firmName: string,
  record: FdaEnforcementRecord,
): InferredFdaFirm {
  return {
    id: `fda-${slugifyFirm(firmName)}`,
    firmName,
    location: locationFromRecord(record),
    region: inferRegionFromState(record.state),
    size: "large",
  };
}

async function fetchRecordsForFirm(
  firmName: string,
  domains: FdaDomain[],
  opts?: ProviderOpts,
): Promise<{ domain: FdaDomain; records: FdaEnforcementRecord[] }[]> {
  const search = buildFirmEnforcementSearch(firmName);
  const batches: { domain: FdaDomain; records: FdaEnforcementRecord[] }[] = [];

  for (const domain of domains) {
    const records = await fetchEnforcementRecords(domain, search, opts);
    if (records.length > 0) batches.push({ domain, records });
  }
  return batches;
}

async function fetchGenericRecords(
  criteria: FdaSearchCriteria,
  opts?: ProviderOpts,
): Promise<{ domain: FdaDomain; records: FdaEnforcementRecord[] }[]> {
  const search = buildGenericEnforcementSearch(criteria);
  const batches: { domain: FdaDomain; records: FdaEnforcementRecord[] }[] = [];

  for (const domain of criteria.domains) {
    const records = await fetchEnforcementRecords(domain, search, opts);
    if (records.length > 0) batches.push({ domain, records });
  }
  return batches;
}

function groupRecordsByFirm(
  batches: { domain: FdaDomain; records: FdaEnforcementRecord[] }[],
): Map<string, { domains: Set<FdaDomain>; records: FdaEnforcementRecord[] }> {
  const groups = new Map<
    string,
    { domains: Set<FdaDomain>; records: FdaEnforcementRecord[] }
  >();

  for (const { domain, records } of batches) {
    for (const record of records) {
      const name = record.recalling_firm?.trim() || "Unknown firm";
      const key = normalizeHint(name);
      let group = groups.get(key);
      if (!group) {
        group = { domains: new Set(), records: [] };
        groups.set(key, group);
      }
      group.domains.add(domain);
      group.records.push(record);
    }
  }
  return groups;
}

interface TaggedRecord {
  domain: FdaDomain;
  record: FdaEnforcementRecord;
}

function tagBatches(
  batches: { domain: FdaDomain; records: FdaEnforcementRecord[] }[],
): TaggedRecord[] {
  const tagged: TaggedRecord[] = [];
  for (const { domain, records } of batches) {
    for (const record of records) tagged.push({ domain, record });
  }
  return tagged;
}

function extractSignalsFromTagged(
  tagged: TaggedRecord[],
  now: Date = new Date(),
): ProspectSignal[] {
  const byDomain = new Map<FdaDomain, FdaEnforcementRecord[]>();
  for (const { domain, record } of tagged) {
    const list = byDomain.get(domain) ?? [];
    list.push(record);
    byDomain.set(domain, list);
  }
  const out: ProspectSignal[] = [];
  for (const [domain, records] of byDomain) {
    out.push(...extractSignalsFromRecalls(records, domain, now));
  }
  const deduped = dedupeSignals(out);
  if (deduped.length > 0) return deduped;

  // openFDA retains years of history; if nothing falls in the freshness window,
  // still surface the single most recent recall as a weak signal.
  let newest: TaggedRecord | null = null;
  let newestDays = Infinity;
  for (const entry of tagged) {
    const days = recordFreshnessDays(entry.record, now);
    if (days < newestDays) {
      newestDays = days;
      newest = entry;
    }
  }
  if (!newest) return [];
  return extractSignalsFromRecalls(
    [newest.record],
    newest.domain,
    now,
    9999,
  );
}

function buildFetchResult(
  firm: FdaMatchedFirm,
  matchedOn: string,
  confidence: "named" | "criteria",
  tagged: TaggedRecord[],
): FdaFetchResult | null {
  if (tagged.length === 0) return null;
  const signals = extractSignalsFromTagged(tagged);
  if (signals.length === 0) return null;
  const domains = [...new Set(tagged.map((t) => t.domain))];
  return {
    firm,
    matchedOn,
    confidence,
    domains,
    records: tagged.map((t) => t.record),
    signals,
  };
}

/**
 * Resolves FDA prospects from openFDA enforcement data: named firm match
 * (highest confidence) or generic recall search grouped by recalling firm.
 */
export async function fetchFdaProspects(
  hint: string,
  buyerPack: BuyerPackId,
  opts?: ProviderOpts,
): Promise<FdaProspectsResponse> {
  if (!isFdaScopedQuery(hint, buyerPack)) {
    return { results: [], allSourcesFailed: false };
  }

  const named = matchFdaFirm(hint, buyerPack);
  if (named) {
    const domains = named.firm.domains ?? ["food", "drug", "device"];
    const batches = await fetchRecordsForFirm(named.firm.firmName, domains, opts);
    const filterNorm = normalizeHint(named.firm.firmName);
    const tagged = tagBatches(batches).filter((t) => {
      const firmNorm = normalizeHint(t.record.recalling_firm ?? "");
      return firmNorm.includes(filterNorm) || filterNorm.includes(firmNorm);
    });
    const result = buildFetchResult(
      named.firm,
      named.matchedOn,
      "named",
      tagged,
    );
    return {
      results: result ? [result] : [],
      allSourcesFailed: !result,
    };
  }

  const criteria = parseFdaSearchCriteria(hint);
  const batches = await fetchGenericRecords(criteria, opts);
  if (batches.length === 0) {
    return { results: [], allSourcesFailed: true };
  }

  const groups = groupRecordsByFirm(batches);
  const ranked = [...groups.entries()]
    .map(([key, group]) => ({
      key,
      group,
      count: group.records.length,
    }))
    .sort((a, b) => b.count - a.count);

  const results: FdaFetchResult[] = [];
  for (const entry of ranked.slice(0, MAX_GENERIC_FDA_RESULTS)) {
    const sample = entry.group.records[0];
    const firmName = sample.recalling_firm?.trim() ?? "Unknown firm";
    const inferred = buildInferredFirm(firmName, sample);
    const firmNorm = normalizeHint(firmName);
    const tagged = tagBatches(batches).filter(
      (t) => normalizeHint(t.record.recalling_firm ?? "") === firmNorm,
    );
    const result = buildFetchResult(
      inferred,
      criteria.reasonTerms.length > 0
        ? criteria.reasonTerms.join(" · ")
        : "openFDA recall search",
      "criteria",
      tagged,
    );
    if (result) results.push(result);
  }

  return {
    results,
    allSourcesFailed: results.length === 0,
  };
}
