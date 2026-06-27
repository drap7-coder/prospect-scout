import type { NonprofitEnrichment } from "@/lib/discovery/connectors/propublica/types";
import { canonicalOrgTypeLabel } from "@/lib/discovery/canonicalOrgType";
import { healthPlanTypeLabel } from "@/lib/discovery/healthPlanType";
import type { Prospect, ProspectSignal } from "@/lib/search/types";
import { industryLabel, sectorLabel } from "@/lib/taxonomy";
import { formatUsdCompact, formatWebsiteDisplay } from "./format";
import { prospectFreshness, formatFreshness } from "./evidence";
import { synthesizeIntelligenceCard } from "./synthesizeCard";

/**
 * Executive Intelligence Card model.
 *
 * This is a presentation-layer synthesis that turns a {@link Prospect} into an
 * executive briefing: one thesis, a few type-specific metrics, opportunity-framed
 * insights, a recent-activity timeline, and a verified-source line. It never
 * fabricates data — every value is derived from fields already present on the
 * prospect (or its optional nonprofit enrichment).
 */

/** Coarse organization "kind" that drives adaptive metric rendering. */
export type OrgKind =
  | "health-plan"
  | "pbm"
  | "hospital"
  | "manufacturer"
  | "pharma"
  | "bank"
  | "university"
  | "nonprofit"
  | "government"
  | "other";

export interface MetricChip {
  id: string;
  value: string;
  /** Optional unit/noun. Omitted for tag-style chips (e.g. "ACA Marketplace"). */
  label?: string;
  /** Visual emphasis — accent chips highlight the defining attribute. */
  accent?: boolean;
}

export interface ActivityItem {
  id: string;
  icon: string;
  when: string;
  text: string;
}

export interface VerifiedSource {
  id: string;
  label: string;
}

export interface ExecutiveCardModel {
  name: string;
  orgType: string | null;
  orgKind: OrgKind;
  headquarters: string | null;
  website: string | null;
  websiteHref: string | null;
  scoutScore: number;
  /** Only present when meaningfully uncertain (below threshold). */
  confidencePercent: number | null;
  thesis: string | null;
  metrics: MetricChip[];
  whyThisMatters: string[];
  recentActivity: ActivityItem[];
  verifiedBy: VerifiedSource[];
  /** "Updated 2 days ago" — omitted when unknown or stale. */
  freshnessLabel: string | null;
  form990Url: string | null;
}

const CONFIDENCE_THRESHOLD = 75;
/** Activity older than this is no longer "recent". */
const RECENT_ACTIVITY_MAX_DAYS = 180;
/** Freshness older than this is omitted entirely (never show "12 months ago"). */
const FRESHNESS_MAX_DAYS = 90;

const SIZE_PHRASE: Record<string, string> = {
  enterprise: "Enterprise-scale",
  large: "Large",
  mid: "Mid-market",
  small: "Regional",
};

// ---------------------------------------------------------------------------
// Organization kind
// ---------------------------------------------------------------------------

function metaHaystack(prospect: Prospect): string {
  return [
    prospect.canonicalOrganizationTypeId,
    prospect.organizationTypeId,
    prospect.industryId,
    prospect.sectorId,
    prospect.buyerType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function resolveOrgKind(prospect: Prospect): OrgKind {
  const canonical = prospect.canonicalOrganizationTypeId ?? "";
  const hay = metaHaystack(prospect);

  const looksPharma = /pharma|biotech|life[- ]?science|drug|medical[- ]?device|therapeutic/.test(hay);
  const looksBank = /\bbank|credit[- ]?union|financial[- ]?services|asset[- ]?manager|capital\b/.test(hay);

  switch (canonical) {
    case "health-plan":
      return "health-plan";
    case "pbm":
      return "pbm";
    case "hospital-health-system":
    case "provider-group":
      return "hospital";
    case "manufacturer":
      return looksPharma ? "pharma" : "manufacturer";
    case "university":
      return "university";
    case "nonprofit":
      return "nonprofit";
    case "government":
      return "government";
    case "employer":
      if (looksBank) return "bank";
      if (looksPharma) return "pharma";
      return "other";
    default:
      if (looksPharma) return "pharma";
      if (looksBank) return "bank";
      return "other";
  }
}

// ---------------------------------------------------------------------------
// Signal flags (derived, never fabricated)
// ---------------------------------------------------------------------------

interface SignalFlags {
  medicareAdvantage: boolean;
  partD: boolean;
  marketplace: boolean;
  hiring: boolean;
  fda: boolean;
  recall: boolean;
  news: boolean;
  starRating: string | null;
}

function deriveSignalFlags(prospect: Prospect): SignalFlags {
  const flags: SignalFlags = {
    medicareAdvantage: false,
    partD: false,
    marketplace: false,
    hiring: false,
    fda: false,
    recall: false,
    news: false,
    starRating: null,
  };

  for (const s of prospect.signals) {
    const hay = `${s.label} ${s.evidenceText} ${s.whyNow}`.toLowerCase();
    if (/medicare advantage|\bma plan|advantage plan/.test(hay)) flags.medicareAdvantage = true;
    if (/\bpart\s?d\b/.test(hay)) flags.partD = true;
    if (/marketplace|exchange|aca\b|qhp/.test(hay)) flags.marketplace = true;
    if (/hiring|career|job opening|recruit|workforce/.test(hay)) flags.hiring = true;
    if (s.source === "FDA" || /\bfda\b|approval|clearance|recall/.test(hay)) flags.fda = true;
    if (/recall|enforcement|warning letter/.test(hay)) flags.recall = true;
    if (s.source === "RSS" || /news|press|announce/.test(hay)) flags.news = true;
    const star = hay.match(/([1-5](?:\.\d)?)\s*[- ]?star/);
    if (star) flags.starRating = star[1] ?? null;
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function stateScope(prospect: Prospect): number {
  return prospect.stateCodes?.length ?? (prospect.stateCode ? 1 : 0);
}

function ownershipWord(prospect: Prospect): string | null {
  const hay = metaHaystack(prospect);
  if (prospect.sectorId === "nonprofit" || /nonprofit|non-profit/.test(hay)) return "Nonprofit";
  if (prospect.publicCompany === true) return "Public";
  if (prospect.publicCompany === false) return "Private";
  return null;
}

function resolveIndustryPhrase(prospect: Prospect): string | null {
  if (prospect.industryId) return industryLabel(prospect.industryId);
  if (prospect.sectorId) return sectorLabel(prospect.sectorId);
  return null;
}

// ---------------------------------------------------------------------------
// Metric builders (adaptive by org kind)
// ---------------------------------------------------------------------------

interface MetricContext {
  prospect: Prospect;
  nonprofit: NonprofitEnrichment | null;
  flags: SignalFlags;
}

function statesMetric(ctx: MetricContext): MetricChip | null {
  const n = stateScope(ctx.prospect);
  if (n < 2) return null;
  return { id: "states", value: String(n), label: n === 1 ? "State" : "States" };
}

function employeesMetric(ctx: MetricContext): MetricChip | null {
  const e = ctx.prospect.employeeEstimate;
  // Plausibility guard: no employer has >3M staff. Larger figures are almost
  // always membership/covered-lives data and must never be mislabeled.
  if (!e || e < 100 || e > 3_000_000) return null;
  return { id: "employees", value: formatCompactCount(e), label: "Employees" };
}

function coveredLivesMetric(ctx: MetricContext): MetricChip | null {
  const m = ctx.prospect.coveredLives;
  if (!m || m < 1_000) return null;
  return { id: "covered", value: formatCompactCount(m), label: "Covered Lives", accent: true };
}

function ownershipMetric(ctx: MetricContext): MetricChip | null {
  const word = ownershipWord(ctx.prospect);
  if (!word) return null;
  return { id: "ownership", value: word === "Nonprofit" ? "Nonprofit" : `${word} Co.` };
}

function nonprofitFinancialMetrics(ctx: MetricContext): MetricChip[] {
  const out: MetricChip[] = [];
  const rev = formatUsdCompact(ctx.nonprofit?.revenue);
  const assets = formatUsdCompact(ctx.nonprofit?.assets);
  if (rev) out.push({ id: "revenue", value: rev, label: "Revenue", accent: true });
  if (assets) out.push({ id: "assets", value: assets, label: "Assets" });
  const subsection = ctx.nonprofit?.subsection501c;
  if (subsection) out.push({ id: "subsection", value: subsection });
  return out;
}

function healthPlanMetrics(ctx: MetricContext): MetricChip[] {
  const out: MetricChip[] = [];
  const hpt = ctx.prospect.healthPlanType;
  if (hpt) out.push({ id: "hpt", value: healthPlanTypeLabel(hpt), accent: true });
  // Payers report covered lives, never "employees" (the catalog conflates them).
  const lives = coveredLivesMetric(ctx);
  if (lives) out.push(lives);
  if (ctx.flags.medicareAdvantage && hpt !== "medicare_advantage") {
    out.push({ id: "ma", value: "Medicare Advantage" });
  }
  if (ctx.flags.partD) out.push({ id: "partd", value: "Part D" });
  if (ctx.flags.marketplace && hpt !== "aca_marketplace") {
    out.push({ id: "mkt", value: "Marketplace" });
  }
  if (ctx.flags.starRating) {
    out.push({ id: "star", value: `${ctx.flags.starRating}★`, label: "CMS Stars" });
  }
  const states = statesMetric(ctx);
  if (states) out.push(states);
  const own = ownershipMetric(ctx);
  if (own) out.push(own);
  return out;
}

const METRIC_BUILDERS: Record<OrgKind, (ctx: MetricContext) => MetricChip[]> = {
  "health-plan": healthPlanMetrics,
  pbm: (ctx) => {
    const out: MetricChip[] = [];
    const states = statesMetric(ctx);
    if (states) out.push(states);
    const emp = employeesMetric(ctx);
    if (emp) out.push(emp);
    if (ctx.flags.hiring) out.push({ id: "hiring", value: "Hiring" });
    const own = ownershipMetric(ctx);
    if (own) out.push(own);
    return out;
  },
  hospital: (ctx) => {
    const out: MetricChip[] = [...nonprofitFinancialMetrics(ctx)];
    const states = statesMetric(ctx);
    if (states) out.push(states);
    const emp = employeesMetric(ctx);
    if (emp) out.push(emp);
    if (!out.some((m) => m.id === "subsection")) {
      const own = ownershipMetric(ctx);
      if (own) out.push(own);
    }
    return out;
  },
  manufacturer: (ctx) => {
    const out: MetricChip[] = [];
    const emp = employeesMetric(ctx);
    if (emp) out.push(emp);
    const states = statesMetric(ctx);
    if (states) out.push(states);
    if (ctx.flags.fda) out.push({ id: "fda", value: "FDA-regulated" });
    const own = ownershipMetric(ctx);
    if (own) out.push(own);
    return out;
  },
  pharma: (ctx) => {
    const out: MetricChip[] = [];
    if (ctx.flags.fda) out.push({ id: "fda", value: "FDA-regulated", accent: true });
    if (ctx.flags.recall) out.push({ id: "recall", value: "Recall activity" });
    const emp = employeesMetric(ctx);
    if (emp) out.push(emp);
    const states = statesMetric(ctx);
    if (states) out.push(states);
    const own = ownershipMetric(ctx);
    if (own) out.push(own);
    return out;
  },
  bank: (ctx) => {
    const out: MetricChip[] = [];
    const emp = employeesMetric(ctx);
    if (emp) out.push(emp);
    const states = statesMetric(ctx);
    if (states) out.push(states);
    const own = ownershipMetric(ctx);
    if (own) out.push(own);
    return out;
  },
  university: (ctx) => {
    const out: MetricChip[] = [];
    const states = statesMetric(ctx);
    if (states) out.push(states);
    const own = ownershipMetric(ctx);
    if (own) out.push({ id: own.id, value: own.value === "Public Co." ? "Public" : own.value });
    return out;
  },
  nonprofit: (ctx) => {
    const out: MetricChip[] = [...nonprofitFinancialMetrics(ctx)];
    const states = statesMetric(ctx);
    if (states) out.push(states);
    if (out.length === 0) out.push({ id: "ownership", value: "Nonprofit" });
    return out;
  },
  government: (ctx) => {
    const out: MetricChip[] = [];
    const states = statesMetric(ctx);
    if (states) out.push(states);
    const emp = employeesMetric(ctx);
    if (emp) out.push(emp);
    out.push({ id: "ownership", value: "Public Sector" });
    return out;
  },
  other: (ctx) => {
    const out: MetricChip[] = [];
    const states = statesMetric(ctx);
    if (states) out.push(states);
    const emp = employeesMetric(ctx);
    if (emp) out.push(emp);
    const own = ownershipMetric(ctx);
    if (own) out.push(own);
    return out;
  },
};

function buildMetrics(kind: OrgKind, ctx: MetricContext): MetricChip[] {
  const seen = new Set<string>();
  return METRIC_BUILDERS[kind](ctx)
    .filter((m) => {
      const key = m.value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// Executive thesis (one synthesized sentence)
// ---------------------------------------------------------------------------

function scopeClause(prospect: Prospect): string {
  const n = stateScope(prospect);
  if (n >= 5) return ` operating across ${n} states`;
  if (prospect.stateCode) return ` based in ${prospect.stateCode}`;
  return "";
}

function buildThesis(
  prospect: Prospect,
  kind: OrgKind,
  nonprofit: NonprofitEnrichment | null,
): string | null {
  const size = prospect.size ? SIZE_PHRASE[prospect.size] : null;
  const sizePrefix = size ? `${size} ` : "";
  const industry = resolveIndustryPhrase(prospect);
  const scope = scopeClause(prospect);

  switch (kind) {
    case "health-plan": {
      const subtype =
        prospect.healthPlanType === "aca_marketplace"
          ? "on-exchange ACA Marketplace health plan"
          : prospect.healthPlanType === "medicare_advantage"
            ? "Medicare Advantage carrier"
            : prospect.healthPlanType === "medicaid_managed_care"
              ? "Medicaid managed care organization"
              : "health plan";
      const n = stateScope(prospect);
      const geo = n >= 5 ? ` across ${n} states` : prospect.stateCode ? ` in ${prospect.stateCode}` : "";
      if (prospect.coveredLives && prospect.coveredLives >= 1_000) {
        return capitalize(
          `${sizePrefix}${subtype} covering ~${formatCompactCount(prospect.coveredLives)} lives${geo}.`,
        );
      }
      return capitalize(`${sizePrefix}${subtype}${scope}.`);
    }
    case "pbm":
      return capitalize(`${sizePrefix}pharmacy benefit manager${scope}.`);
    case "hospital": {
      const np = ownershipWord(prospect) === "Nonprofit" ? "nonprofit " : "";
      return capitalize(`${sizePrefix}${np}health system${scope}.`);
    }
    case "manufacturer": {
      const ind = industry ? `${industry.toLowerCase()} ` : "";
      return capitalize(`${sizePrefix}${ind}manufacturer${scope}.`);
    }
    case "pharma":
      return capitalize(`${sizePrefix}pharmaceutical & life-sciences manufacturer${scope}.`);
    case "bank": {
      const pub = prospect.publicCompany === true ? "publicly traded " : "";
      return capitalize(`${sizePrefix}${pub}bank${scope}.`);
    }
    case "university": {
      const pub = prospect.publicCompany === false ? "private " : "";
      return capitalize(`${pub}university${scope}.`);
    }
    case "nonprofit": {
      const subsection = nonprofit?.subsection501c ?? "Nonprofit";
      const ntee = nonprofit?.nteeCategory ? `${nonprofit.nteeCategory.toLowerCase()} ` : "";
      const rev = formatUsdCompact(nonprofit?.revenue);
      const tail = rev ? ` with ${rev} in reported annual revenue` : scope;
      return capitalize(`${subsection} ${ntee}organization${tail}.`.replace(/\s+/g, " "));
    }
    case "government":
      return capitalize(`Public-sector organization${scope}.`);
    default: {
      const orgType = prospect.canonicalOrganizationTypeId
        ? canonicalOrgTypeLabel(prospect.canonicalOrganizationTypeId)
        : prospect.buyerType;
      if (industry) return capitalize(`${sizePrefix}${industry.toLowerCase()} organization${scope}.`);
      if (orgType) return capitalize(`${sizePrefix}${orgType.toLowerCase()}${scope}.`);
      if (prospect.description) return clampSentences(prospect.description, 2);
      return null;
    }
  }
}

function capitalize(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function clampSentences(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const parts = clean.match(/[^.!?]+[.!?]+/g);
  const out = parts ? parts.slice(0, max).join(" ").trim() : clean;
  return out.length > 180 ? `${out.slice(0, 177).trim()}…` : out;
}

// ---------------------------------------------------------------------------
// Why this matters (opportunity-framed insights)
// ---------------------------------------------------------------------------

const GENERIC_INSIGHT =
  /^(public(ly)?[\s-]?(traded\s)?compan|privately held organization|enterprise(?:[- ]scale)? organization|.*organization by scale|recent news or press coverage|.*(sector|industry|buyer type|region|state)\s+match)/i;

function buildWhyThisMatters(
  prospect: Prospect,
  kind: OrgKind,
  flags: SignalFlags,
  intelligence: { text: string }[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function add(text: string) {
    const fragment = text.replace(/\s+/g, " ").trim().replace(/\.$/, "");
    if (fragment.length < 4) return;
    const key = fragment.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(fragment);
  }

  // Punchy, opportunity-framed fragments from flags/kind.
  if (flags.recall) add("Recent FDA enforcement activity");
  if (kind === "health-plan" && flags.medicareAdvantage) add("Active Medicare Advantage participation");
  if (kind === "health-plan" && prospect.healthPlanType === "aca_marketplace") {
    add("On-exchange ACA Marketplace presence");
  }
  if (kind === "pharma" && flags.fda) add("FDA-regulated pipeline activity");
  if (flags.hiring) add("Actively hiring — expansion signal");
  if (stateScope(prospect) >= 8) add("Broad multi-state operating footprint");

  // Filtered, de-genericized intelligence bullets.
  for (const bullet of intelligence) {
    const text = bullet.text.trim();
    if (GENERIC_INSIGHT.test(text)) continue;
    // Payer "employee" counts are unreliable (membership conflation) — skip.
    if (kind === "health-plan" && /^employs approximately/i.test(text)) continue;
    add(text);
    if (out.length >= 5) break;
  }

  return out.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Recent activity timeline
// ---------------------------------------------------------------------------

function activityIcon(signal: ProspectSignal): string {
  const hay = `${signal.label} ${signal.evidenceText}`.toLowerCase();
  if (/hiring|career|job|recruit/.test(hay)) return "💼";
  if (signal.source === "FDA" || /recall|fda|approval/.test(hay)) return "⚠️";
  if (signal.source === "SEC" || /filing|10-k|8-k|edgar/.test(hay)) return "📄";
  if (signal.source === "CMS" || /medicare|medicaid|enrollment|star rating/.test(hay)) return "🏥";
  if (signal.source === "RSS" || /news|press|announce/.test(hay)) return "📰";
  if (signal.strength === "strong") return "🔥";
  return "•";
}

function relativeWhen(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 31) return `${Math.round(days / 7)} weeks ago`;
  if (days < 60) return "Last month";
  return `${Math.round(days / 30)} months ago`;
}

function cleanActivityText(signal: ProspectSignal): string {
  let label = signal.label.replace(/\s+/g, " ").trim();
  const cat = signal.source;
  if (/^hiring/i.test(label)) {
    label = label.replace(/^hiring:?\s*/i, "Hiring: ");
  } else if (cat === "SEC" && !/^sec/i.test(label)) {
    label = `SEC: ${label}`;
  } else if (cat === "FDA" && !/^fda/i.test(label)) {
    label = `FDA: ${label}`;
  } else if (cat === "CMS" && !/^cms/i.test(label)) {
    label = `CMS: ${label}`;
  }
  return label;
}

function isActionableSignal(signal: ProspectSignal): boolean {
  if (signal.freshnessDays > RECENT_ACTIVITY_MAX_DAYS) return false;
  if (signal.strength === "weak" && signal.urgency < 0.35) return false;
  const label = signal.label.trim().toLowerCase();
  if (label.length < 4) return false;
  if (/placeholder|mock|sample|pending|unavailable/.test(label)) return false;
  return true;
}

function buildRecentActivity(prospect: Prospect): ActivityItem[] {
  const items = prospect.signals
    .filter(isActionableSignal)
    .sort((a, b) => b.urgency - a.urgency || a.freshnessDays - b.freshnessDays);

  const out: ActivityItem[] = [];
  const seen = new Set<string>();
  for (const signal of items) {
    const text = cleanActivityText(signal);
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `${signal.id}`,
      icon: activityIcon(signal),
      when: relativeWhen(signal.freshnessDays),
      text,
    });
    if (out.length >= 4) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Verified sources
// ---------------------------------------------------------------------------

const VERIFIED_LABELS: Record<string, string> = {
  directory: "Catalog",
  nces: "NCES",
  sec: "SEC",
  cms: "CMS",
  "aca-marketplace": "CMS Marketplace",
  fda: "FDA",
  "irs-nonprofits": "IRS",
  propublica: "IRS Form 990",
  "propublica-nonprofit-explorer": "IRS Form 990",
  census: "Census",
  rss: "News",
  "public-web": "Company Website",
};

const VERIFIED_ORDER = [
  "CMS",
  "CMS Marketplace",
  "SEC",
  "FDA",
  "IRS",
  "IRS Form 990",
  "Company Website",
  "News",
  "NCES",
  "Catalog",
  "Census",
];

function buildVerifiedBy(dataSources: { id: string }[]): VerifiedSource[] {
  const seen = new Set<string>();
  const out: VerifiedSource[] = [];
  for (const src of dataSources) {
    const label =
      VERIFIED_LABELS[src.id] ??
      src.id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ id: src.id, label });
  }
  return out.sort(
    (a, b) =>
      (VERIFIED_ORDER.indexOf(a.label) === -1 ? 99 : VERIFIED_ORDER.indexOf(a.label)) -
      (VERIFIED_ORDER.indexOf(b.label) === -1 ? 99 : VERIFIED_ORDER.indexOf(b.label)),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function synthesizeExecutiveCard(
  prospect: Prospect,
  nonprofitEnrichment: NonprofitEnrichment | null = null,
): ExecutiveCardModel {
  const base = synthesizeIntelligenceCard(prospect, nonprofitEnrichment);
  const kind = resolveOrgKind(prospect);
  const flags = deriveSignalFlags(prospect);
  const ctx: MetricContext = { prospect, nonprofit: nonprofitEnrichment, flags };

  const freshDays = prospectFreshness(prospect);
  const freshnessLabel =
    prospect.signals.length > 0 && freshDays < FRESHNESS_MAX_DAYS
      ? `Updated ${formatFreshness(freshDays)}`
      : null;

  const confidencePercent =
    base.identity.confidencePercent != null &&
    base.identity.confidencePercent < CONFIDENCE_THRESHOLD
      ? base.identity.confidencePercent
      : null;

  return {
    name: prospect.name,
    orgType: base.identity.orgType,
    orgKind: kind,
    headquarters: base.identity.headquarters,
    website: prospect.website ? formatWebsiteDisplay(prospect.website) : null,
    websiteHref: base.identity.websiteHref,
    scoutScore: prospect.score,
    confidencePercent,
    thesis: buildThesis(prospect, kind, nonprofitEnrichment),
    metrics: buildMetrics(kind, ctx),
    whyThisMatters: buildWhyThisMatters(prospect, kind, flags, base.intelligence),
    recentActivity: buildRecentActivity(prospect),
    verifiedBy: buildVerifiedBy(base.dataSources),
    freshnessLabel,
    form990Url: base.form990Url,
  };
}
