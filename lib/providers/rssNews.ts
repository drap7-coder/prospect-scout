import type {
  BuyerPackId,
  ProspectSignal,
  SignalStrength,
  SignalType,
} from "@/lib/search/types";

/**
 * RSS / press-release provider — third REAL public-data source.
 *
 * Fetches curated organization or buyer-pack RSS feeds (no general crawler,
 * no LinkedIn, no paid APIs) and extracts normalized `ProspectSignal`s from
 * recent headlines and descriptions.
 *
 * Each organization may register multiple source candidates (press room, IR,
 * PR Newswire, GlobeNewswire, SEC EDGAR Atom). Sources are tried in order;
 * failed URLs are cached for the remainder of a single request so repeated
 * 403s from blocked press rooms do not slow the response.
 *
 * Design notes:
 *   - Self-contained (type-only imports) for offline unit tests.
 *   - Injectable text `fetch` for tests; global fetch in production.
 *   - When all candidates fail, returns `allSourcesFailed` (non-throwing).
 */

/** Source-trail text when RSS is unavailable (source badge adds "RSS ·"). */
export const RSS_UNAVAILABLE_EVIDENCE =
  "unavailable — showing mock news signals";

const DEFAULT_WINDOW_DAYS = 120;
const MAX_ITEMS_SCAN = 25;
const MAX_FEED_MATCHES = 2;

// ---------------------------------------------------------------------------
// Fetch helpers (RSS returns XML text, not JSON)
// ---------------------------------------------------------------------------

export type TextFetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

interface ProviderOpts {
  fetchImpl?: TextFetchLike;
}

function resolveFetch(opts?: ProviderOpts): TextFetchLike {
  const impl = opts?.fetchImpl ?? (globalThis.fetch as unknown as TextFetchLike);
  if (!impl) {
    throw new Error("No fetch implementation available for RSS.");
  }
  return impl;
}

function rssHeaders(kind?: NewsSourceKind): Record<string, string> {
  const accept =
    "application/rss+xml, application/atom+xml, application/xml, text/xml";
  if (kind === "sec-edgar") {
    const ua =
      process.env.SEC_USER_AGENT?.trim() ||
      "Prospect Scout RSS Reader/1.0 set-SEC_USER_AGENT@example.com";
    return { Accept: accept, "User-Agent": ua };
  }
  return { Accept: accept, "User-Agent": "Prospect Scout RSS Reader/1.0" };
}

// ---------------------------------------------------------------------------
// Shared permissive public feeds (org-filtered when used as fallback)
// ---------------------------------------------------------------------------

const PR_NEWSWIRE_ALL =
  "https://www.prnewswire.com/rss/news-releases-list.rss";
const GLOBE_HEALTHCARE =
  "https://www.globenewswire.com/RssFeed/subjectcode/12-Health%20Care%20%26%20Hospitals/feedTitle/GlobeNewswire%20-%20Health%20Care%20%26%20Hospitals";
const GLOBE_CONSUMER =
  "https://www.globenewswire.com/RssFeed/subjectcode/25-Consumer%20Products%20%26%20Retail/feedTitle/GlobeNewswire%20-%20Consumer%20Products%20%26%20Retail";

/** Builds the SEC EDGAR Atom feed URL for a company CIK. */
export function secEdgarAtomUrl(cik: string | number): string {
  const padded = String(cik).replace(/\D/g, "").padStart(10, "0");
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padded}&count=40&output=atom`;
}

export type NewsSourceKind =
  | "press-room"
  | "investor-relations"
  | "pr-newswire"
  | "business-wire"
  | "globe-newswire"
  | "sec-edgar"
  | "official-blog";

export interface NewsSourceCandidate {
  url: string;
  kind: NewsSourceKind;
  /** Short label for source trail, e.g. "PR Newswire". */
  label: string;
  /** When true, keep only items mentioning the matched organization. */
  orgFilter?: boolean;
}

/** Tracks feed URLs that failed during a single fetchRssProspects call. */
export class FeedFailureCache {
  private failed = new Set<string>();

  has(url: string): boolean {
    return this.failed.has(url);
  }

  mark(url: string): void {
    this.failed.add(url);
  }
}

function pressRoom(url: string): NewsSourceCandidate {
  return { url, kind: "press-room", label: "Press room" };
}

function investorRelations(url: string): NewsSourceCandidate {
  return { url, kind: "investor-relations", label: "Investor relations" };
}

function secFilings(cik: string | number): NewsSourceCandidate {
  return {
    url: secEdgarAtomUrl(cik),
    kind: "sec-edgar",
    label: "SEC EDGAR filings",
  };
}

function prNewswire(orgFilter = true): NewsSourceCandidate {
  return {
    url: PR_NEWSWIRE_ALL,
    kind: "pr-newswire",
    label: "PR Newswire",
    orgFilter,
  };
}

function globeHealthcare(orgFilter = true): NewsSourceCandidate {
  return {
    url: GLOBE_HEALTHCARE,
    kind: "globe-newswire",
    label: "GlobeNewswire",
    orgFilter,
  };
}

function globeConsumer(orgFilter = true): NewsSourceCandidate {
  return {
    url: GLOBE_CONSUMER,
    kind: "globe-newswire",
    label: "GlobeNewswire",
    orgFilter,
  };
}

function officialBlog(url: string): NewsSourceCandidate {
  return { url, kind: "official-blog", label: "Official blog" };
}

// ---------------------------------------------------------------------------
// Curated feed registry
// ---------------------------------------------------------------------------

export interface RssFeedSource {
  id: string;
  organizationName: string;
  buyerPacks: BuyerPackId[];
  /** Ordered source candidates — first success wins. */
  sources: NewsSourceCandidate[];
  aliases: string[];
  location: string;
  region: string;
  size: "mid" | "large" | "enterprise";
}

/**
 * Curated RSS feeds per organization and buyer pack.
 * URLs are public press/newsroom feeds — no auth, no scraping.
 */
export const RSS_FEED_SOURCES: RssFeedSource[] = [
  {
    id: "rss-humana",
    organizationName: "Humana Inc.",
    buyerPacks: ["health-plans"],
    sources: [
      pressRoom("https://press.humana.com/news-releases/rss"),
      investorRelations("https://investors.humana.com/rss/news-releases.xml"),
      secFilings("49071"),
      globeHealthcare(),
      prNewswire(),
    ],
    aliases: ["humana"],
    location: "Louisville, KY",
    region: "southeast",
    size: "enterprise",
  },
  {
    id: "rss-uhc",
    organizationName: "UnitedHealthcare",
    buyerPacks: ["health-plans"],
    sources: [
      pressRoom("https://www.uhc.com/newsroom/rss.xml"),
      secFilings("731766"),
      globeHealthcare(),
      prNewswire(),
    ],
    aliases: ["unitedhealthcare", "united healthcare", "uhc", "unitedhealth"],
    location: "Minnetonka, MN",
    region: "midwest",
    size: "enterprise",
  },
  {
    id: "rss-cvs-aetna",
    organizationName: "Aetna",
    buyerPacks: ["health-plans"],
    sources: [
      pressRoom("https://news.cvshealth.com/news-releases/rss"),
      secFilings("64803"),
      globeHealthcare(),
      prNewswire(),
    ],
    aliases: ["aetna", "cvs health", "cvs aetna"],
    location: "Hartford, CT",
    region: "northeast",
    size: "enterprise",
  },
  {
    id: "rss-pepsico",
    organizationName: "PepsiCo",
    buyerPacks: ["manufacturers"],
    sources: [
      pressRoom("https://www.pepsico.com/news/rss"),
      secFilings("77476"),
      globeConsumer(),
      prNewswire(),
    ],
    aliases: ["pepsico", "pepsi"],
    location: "Purchase, NY",
    region: "mid-atlantic",
    size: "enterprise",
  },
  {
    id: "rss-general-mills",
    organizationName: "General Mills",
    buyerPacks: ["manufacturers"],
    sources: [
      investorRelations("https://investors.generalmills.com/press-releases/rss"),
      pressRoom("https://www.generalmills.com/news/releases"),
      secFilings("40704"),
      globeConsumer(),
      prNewswire(),
    ],
    aliases: ["general mills", "generalmills"],
    location: "Minneapolis, MN",
    region: "midwest",
    size: "enterprise",
  },
  {
    id: "rss-hca",
    organizationName: "HCA Healthcare",
    buyerPacks: ["health-systems"],
    sources: [
      pressRoom("https://hcahealthcare.com/util/pages/rss/news-releases.rss"),
      secFilings("860730"),
      globeHealthcare(),
      prNewswire(),
    ],
    aliases: ["hca", "hca healthcare"],
    location: "Nashville, TN",
    region: "southeast",
    size: "enterprise",
  },
  {
    id: "rss-ascension",
    organizationName: "Ascension",
    buyerPacks: ["health-systems"],
    sources: [
      pressRoom("https://about.ascension.org/news/rss"),
      globeHealthcare(),
      prNewswire(),
    ],
    aliases: ["ascension", "ascension health"],
    location: "St. Louis, MO",
    region: "midwest",
    size: "enterprise",
  },
  {
    id: "rss-walmart",
    organizationName: "Walmart",
    buyerPacks: ["employers"],
    sources: [
      pressRoom("https://corporate.walmart.com/newsroom/rss"),
      secFilings("104169"),
      globeConsumer(),
      prNewswire(),
    ],
    aliases: ["walmart", "wal-mart"],
    location: "Bentonville, AR",
    region: "southwest",
    size: "enterprise",
  },
  {
    id: "rss-starbucks",
    organizationName: "Starbucks",
    buyerPacks: ["employers"],
    sources: [
      officialBlog("https://stories.starbucks.com/feed"),
      secFilings("829224"),
      globeConsumer(),
      prNewswire(),
    ],
    aliases: ["starbucks"],
    location: "Seattle, WA",
    region: "west",
    size: "enterprise",
  },
  {
    id: "rss-elevance",
    organizationName: "Elevance Health",
    buyerPacks: ["health-plans", "employers"],
    sources: [
      pressRoom("https://www.elevancehealth.com/newsroom/rss"),
      secFilings("1156039"),
      globeHealthcare(),
      prNewswire(),
    ],
    aliases: ["elevance", "anthem", "elevance health"],
    location: "Indianapolis, IN",
    region: "midwest",
    size: "enterprise",
  },
];

const GENERIC_TERMS = new Set([
  "the", "and", "for", "with", "that", "may", "need", "find", "show", "help",
  "want", "looking", "target", "targeting", "sell", "selling", "reduce", "spend",
  "regional", "national", "company", "companies", "organization", "org",
  "consulting", "services", "service", "solutions", "manufacturer",
  "manufacturers", "manufacturing", "employer", "employers", "health", "plan",
  "plans", "system", "systems", "hospital", "hospitals",
]);

function normalizeHint(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeHint(hint: string): string[] {
  return normalizeHint(hint)
    .split(/\s+/)
    .filter((t) => t.length > 1 && !GENERIC_TERMS.has(t));
}

export interface RssFeedMatch {
  feed: RssFeedSource;
  matchedOn: string;
  score: number;
}

/** Matches curated RSS feeds from a query hint and buyer pack. */
export function matchFeedSources(
  hint: string,
  buyerPack: BuyerPackId,
  registry: RssFeedSource[] = RSS_FEED_SOURCES,
): RssFeedMatch[] {
  if (!hint?.trim()) return [];
  const normHint = normalizeHint(hint);
  const candidates: RssFeedMatch[] = [];

  for (const feed of registry) {
    if (!feed.buyerPacks.includes(buyerPack)) continue;

    const names = [feed.organizationName, ...feed.aliases].map(normalizeHint);
    for (const alias of names) {
      if (alias.length >= 3 && normHint.includes(alias)) {
        candidates.push({ feed, matchedOn: alias, score: alias.length + 10 });
      }
    }

    const tokens = tokenizeHint(hint);
    const haystack = names.join(" ");
    for (const token of tokens) {
      if (token.length >= 4 && haystack.includes(token)) {
        candidates.push({ feed, matchedOn: token, score: token.length });
      }
    }
  }

  const byId = new Map<string, RssFeedMatch>();
  for (const c of candidates) {
    const existing = byId.get(c.feed.id);
    if (!existing || c.score > existing.score) byId.set(c.feed.id, c);
  }

  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.feed.organizationName.localeCompare(b.feed.organizationName))
    .slice(0, MAX_FEED_MATCHES);
}

/** True when the query hint resolves to at least one RSS feed for this pack. */
export function isRssScopedQuery(hint: string, buyerPack: BuyerPackId): boolean {
  return matchFeedSources(hint, buyerPack).length > 0;
}

/** Keeps items whose title/description mention the organization or an alias. */
export function filterItemsForOrganization(
  items: RssItem[],
  orgNames: string[],
): RssItem[] {
  const needles = orgNames
    .map(normalizeHint)
    .filter((n) => n.length >= 3);
  if (needles.length === 0) return items;

  return items.filter((item) => {
    const text = normalizeHint(`${item.title} ${item.description}`);
    return needles.some((needle) => text.includes(needle));
  });
}

// ---------------------------------------------------------------------------
// RSS / Atom parsing
// ---------------------------------------------------------------------------

export interface RssItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractTagContent(block: string, tag: string): string {
  const cdataRe = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`,
    "i",
  );
  const cdata = block.match(cdataRe);
  if (cdata?.[1]) return stripHtml(cdata[1]);

  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const plain = block.match(plainRe);
  if (plain?.[1]) return stripHtml(plain[1]);
  return "";
}

function extractLink(block: string): string {
  const atomLink = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (atomLink?.[1]) return atomLink[1].trim();
  return extractTagContent(block, "link");
}

function parsePubDate(raw: string): string {
  if (!raw?.trim()) return "";
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Parses RSS 2.0 or Atom XML into normalized items.
 * Pure function — no network.
 */
export function parseRssXml(xml: string): RssItem[] {
  if (!xml?.trim()) return [];

  const blocks: string[] = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  const entryRe = /<entry[\s>][\s\S]*?<\/entry>/gi;

  for (const match of xml.match(itemRe) ?? []) blocks.push(match);
  if (blocks.length === 0) {
    for (const match of xml.match(entryRe) ?? []) blocks.push(match);
  }

  const items: RssItem[] = [];
  for (const block of blocks.slice(0, MAX_ITEMS_SCAN)) {
    const title = extractTagContent(block, "title");
    const description =
      extractTagContent(block, "description") ||
      extractTagContent(block, "summary") ||
      extractTagContent(block, "content");
    const pubDate =
      parsePubDate(extractTagContent(block, "pubDate")) ||
      parsePubDate(extractTagContent(block, "published")) ||
      parsePubDate(extractTagContent(block, "updated"));
    const link = extractLink(block);

    if (title || description) {
      items.push({ title: title || description.slice(0, 120), description, link, pubDate });
    }
  }
  return items;
}

export function daysSince(dateStr: string, now: Date = new Date()): number {
  if (!dateStr) return 999;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return 999;
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
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

interface RssSignalTemplate {
  id: string;
  label: string;
  type: SignalType;
  /** Source-trail label (rendered after the "RSS" badge). */
  trailLabel: string;
  whyNow: string;
  suggestedAction: string;
}

const RSS_SIGNALS: Record<string, RssSignalTemplate> = {
  "rss-leadership-change": {
    id: "rss-leadership-change",
    label: "Leadership change",
    type: "leadership",
    trailLabel: "Leadership announcement",
    whyNow: "A public leadership announcement often triggers vendor and strategy review",
    suggestedAction: "Congratulate the new leader and offer a focused first-90-days plan",
  },
  "rss-acquisition-merger": {
    id: "rss-acquisition-merger",
    label: "Acquisition / merger",
    type: "growth",
    trailLabel: "Acquisition announcement",
    whyNow: "M&A press releases reopen systems, vendors, and integration decisions",
    suggestedAction: "Position around integration savings and consolidation value",
  },
  "rss-expansion": {
    id: "rss-expansion",
    label: "Expansion",
    type: "growth",
    trailLabel: "Expansion announcement",
    whyNow: "Expansion announcements signal new capacity and program investment",
    suggestedAction: "Tie your offering to their stated expansion priorities",
  },
  "rss-new-product-launch": {
    id: "rss-new-product-launch",
    label: "New product launch",
    type: "demand",
    trailLabel: "Product launch announcement",
    whyNow: "A product launch reshapes packaging, supply, and go-to-market needs",
    suggestedAction: "Reference the launch and map your value to launch support",
  },
  "rss-contract-award": {
    id: "rss-contract-award",
    label: "Contract award",
    type: "procurement",
    trailLabel: "Contract award announcement",
    whyNow: "A contract award creates a defined delivery and vendor window",
    suggestedAction: "Offer support aligned to contract fulfillment timelines",
  },
  "rss-partnership": {
    id: "rss-partnership",
    label: "Partnership",
    type: "operational",
    trailLabel: "Partnership announcement",
    whyNow: "New partnerships often precede program and vendor realignment",
    suggestedAction: "Connect your solution to the goals of the announced partnership",
  },
  "rss-regulatory-issue": {
    id: "rss-regulatory-issue",
    label: "Regulatory issue",
    type: "regulatory",
    trailLabel: "Regulatory announcement",
    whyNow: "Regulatory press coverage forces near-term compliance action",
    suggestedAction: "Frame your solution as a fast path to compliance",
  },
  "rss-hiring-workforce": {
    id: "rss-hiring-workforce",
    label: "Hiring / workforce growth",
    type: "growth",
    trailLabel: "Workforce announcement",
    whyNow: "Workforce growth signals budget flowing toward people and programs",
    suggestedAction: "Lead with scalable programs that support a growing workforce",
  },
  "rss-cost-pressure": {
    id: "rss-cost-pressure",
    label: "Cost pressure",
    type: "financial",
    trailLabel: "Cost pressure announcement",
    whyNow: "Public cost pressure language sharpens appetite for savings",
    suggestedAction: "Lead with measurable cost reduction and ROI proof points",
  },
};

interface RssPattern {
  id: string;
  re: RegExp;
}

const RSS_PATTERNS: RssPattern[] = [
  {
    id: "rss-leadership-change",
    re: /\b(appoint(ed|s|ment)?|names? new|named|chief executive|ceo|cfo|coo|cmo|president|executive vice|leadership change|new leader|steps down|resign(s|ed|ation)?|succeeds|joins as)\b/i,
  },
  {
    id: "rss-acquisition-merger",
    re: /\b(acqui(re|s|red|sition)|merger|merge[ds]?|business combination|takeover|buyout)\b/i,
  },
  {
    id: "rss-expansion",
    re: /\b(expan(d|ds|sion|ding)|new (facility|location|site|market|region|office|campus|clinic|hospital)|opens? (new|a)|grow(s|ing)? footprint)\b/i,
  },
  {
    id: "rss-new-product-launch",
    re: /\b(launch(es|ed|ing)?|introduc(es|ed|ing)|unveil(s|ed|ing)?|debuts?|new product|product line|innovation)\b/i,
  },
  {
    id: "rss-contract-award",
    re: /\b(award(ed|s)?|contract (win|awarded|signed)|selected (as|by|for)|wins? (contract|bid)|RFP|procurement)\b/i,
  },
  {
    id: "rss-partnership",
    re: /\b(partner(s|ship|ed|ing)?|collaborat(es|ed|ion)|alliance|joint venture|strategic agreement|memorandum of understanding)\b/i,
  },
  {
    id: "rss-regulatory-issue",
    re: /\b(regulat(ory|ion|ed)|compliance|consent decree|settlement with|FDA|CMS|investigation|violation|fine|penalty)\b/i,
  },
  {
    id: "rss-hiring-workforce",
    re: /\b(hiring|workforce|add(s|ing)? (jobs|roles|positions)|talent|recruit(s|ing|ment)|headcount|new jobs|career(s)?)\b/i,
  },
  {
    id: "rss-cost-pressure",
    re: /\b(cost (pressure|reduction|savings)|reduce(s|d|ing)? costs|margin pressure|efficiency initiative|restructur(e|ing)|layoff(s)?|workforce reduction)\b/i,
  },
];

function freshnessStrength(days: number): SignalStrength {
  if (days <= 14) return "strong";
  if (days <= 45) return "moderate";
  return "weak";
}

function makeRssSignal(
  id: string,
  strength: SignalStrength,
  freshnessDays: number,
  evidenceText: string,
): ProspectSignal | null {
  const tmpl = RSS_SIGNALS[id];
  if (!tmpl) return null;
  return {
    id: tmpl.id,
    label: tmpl.label,
    type: tmpl.type,
    strength,
    strengthScore: STRENGTH_SCORE[strength],
    source: "RSS",
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

/**
 * Extracts ProspectSignals from parsed RSS items using headline / description
 * pattern matching. Only items within `windowDays` are considered.
 */
export function extractSignalsFromRssItems(
  items: RssItem[],
  now: Date = new Date(),
  windowDays = DEFAULT_WINDOW_DAYS,
): ProspectSignal[] {
  const out: ProspectSignal[] = [];

  for (const item of items) {
    const text = `${item.title} ${item.description}`.trim();
    if (!text) continue;
    const days = daysSince(item.pubDate, now);
    if (days > windowDays) continue;

    const strength = freshnessStrength(days);
    const headline = item.title || text.slice(0, 100);

    for (const { id, re } of RSS_PATTERNS) {
      if (!re.test(text)) continue;
      const tmpl = RSS_SIGNALS[id];
      const sig = makeRssSignal(
        id,
        strength,
        days,
        `${tmpl.trailLabel} · ${headline.length > 60 ? headline.slice(0, 57) + "…" : headline}`,
      );
      if (sig) out.push(sig);
    }
  }

  return dedupeSignals(out);
}

// ---------------------------------------------------------------------------
// Fetch + orchestration
// ---------------------------------------------------------------------------

export async function fetchRssFeed(
  url: string,
  opts?: ProviderOpts,
  kind?: NewsSourceKind,
): Promise<RssItem[]> {
  const fetchImpl = resolveFetch(opts);
  const res = await fetchImpl(url, { headers: rssHeaders(kind) });
  if (!res.ok) {
    throw new Error(`RSS feed returned ${res.status} for ${url}`);
  }
  const xml = await res.text();
  return parseRssXml(xml);
}

/**
 * Tries source candidates in order until one returns parseable items.
 * Skips URLs already marked failed in `cache` for this request.
 */
export async function fetchFeedWithFallback(
  candidates: NewsSourceCandidate[],
  cache: FeedFailureCache,
  orgNames: string[],
  opts?: ProviderOpts,
): Promise<{ items: RssItem[]; source: NewsSourceCandidate } | null> {
  for (const candidate of candidates) {
    if (cache.has(candidate.url)) continue;
    try {
      const items = await fetchRssFeed(candidate.url, opts, candidate.kind);
      const filtered = candidate.orgFilter
        ? filterItemsForOrganization(items, orgNames)
        : items;
      if (filtered.length === 0) continue;
      return { items: filtered, source: candidate };
    } catch {
      cache.mark(candidate.url);
    }
  }
  return null;
}

export interface RssFetchResult {
  match: RssFeedMatch;
  items: RssItem[];
  signals: ProspectSignal[];
  sourceUsed: NewsSourceCandidate;
}

export interface RssProspectsResponse {
  results: RssFetchResult[];
  /** True when feeds matched but no source returned usable signals. */
  allSourcesFailed: boolean;
}

export async function fetchRssProspects(
  hint: string,
  buyerPack: BuyerPackId,
  opts?: ProviderOpts,
): Promise<RssProspectsResponse> {
  const matches = matchFeedSources(hint, buyerPack);
  if (matches.length === 0) {
    return { results: [], allSourcesFailed: false };
  }

  const cache = new FeedFailureCache();
  const results: RssFetchResult[] = [];

  for (const match of matches) {
    const orgNames = [match.feed.organizationName, ...match.feed.aliases];
    const hit = await fetchFeedWithFallback(
      match.feed.sources,
      cache,
      orgNames,
      opts,
    );
    if (!hit) continue;

    const signals = extractSignalsFromRssItems(hit.items);
    if (signals.length === 0) continue;

    results.push({
      match,
      items: hit.items,
      signals,
      sourceUsed: hit.source,
    });
  }

  return {
    results,
    allSourcesFailed: results.length === 0,
  };
}

/** Returns the default source-trail row for a set of RSS signals. */
export function rssSourceTrailForSignals(signals: ProspectSignal[]): string {
  if (signals.length === 0) return "Recent press release";
  return signals[0].evidenceText.split(" · ")[0] || "Recent press release";
}
