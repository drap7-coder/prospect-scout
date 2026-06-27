/**
 * Core domain types for Prospect Scout.
 *
 * Prospect Scout is a universal organization discovery platform. Internal
 * taxonomy targets (formerly "buyer packs") anchor signal catalogs, provider
 * routing, and scoring. The UI speaks in sectors, industries, and organization
 * types — not seller-centric buyer ecosystems.
 */

import type { HealthPlanType } from "@/lib/discovery/healthPlanType";
import type { DiscoveryMetadata } from "@/lib/discovery/coverage";

/** Stable identifier for each buyer ecosystem. */
export type BuyerPackId =
  | "health-plans"
  | "manufacturers"
  | "health-systems"
  | "employers"
  | "public-sector";

/** Category of an opportunity signal — used for problem-fit matching. */
export type SignalType =
  | "regulatory"
  | "leadership"
  | "financial"
  | "operational"
  | "demand"
  | "growth"
  | "procurement";

/**
 * Where a signal's evidence would come from once real providers are wired.
 * These mirror the future free data sources (kept to the six shown on cards).
 */
export type SignalSource = "Directory" | "CMS" | "SEC" | "FDA" | "RSS" | "Careers" | "Company" | "Public Web";

/** Qualitative signal strength, mapped to a numeric score by the builder. */
export type SignalStrength = "weak" | "moderate" | "strong";

/**
 * A signal definition in a buyer pack's catalog. Beyond the relevance
 * `weight`, each carries the metadata needed to make a prospect feel like it
 * was assembled from a real intelligence feed: its type, its (future) data
 * source, and templated evidence / timing / action copy.
 */
export interface Signal {
  id: string;
  label: string;
  /** Base relevance (0–1) of this signal within its buyer pack. */
  weight: number;
  type: SignalType;
  /** The data source this signal would be derived from. */
  source: SignalSource;
  /** Mock evidence text (placeholder for a future provider record). */
  evidence: string;
  /** Why this signal makes the prospect worth acting on *now*. */
  whyNow: string;
  /** Concrete suggested action tied to this signal. */
  suggestedAction: string;
}

/** Approximate organization size, used as a scoring input. */
export type SizeTier = "small" | "mid" | "large" | "enterprise";

/**
 * A buyer ecosystem definition. Adding a new pack = create a new file under
 * `lib/packs/` exporting one of these and register it in `lib/packs/index.ts`.
 */
export interface BuyerPack {
  id: BuyerPackId;
  /** Human label, e.g. "Health Plans". */
  label: string;
  /** Short description of who lives in this ecosystem. */
  description: string;
  /** Example buyer descriptors users might type (drives the UI hints). */
  buyerExamples: string[];
  /** Catalog of opportunity signals relevant to this ecosystem. */
  signals: Signal[];
  /** Roles typically worth reaching out to in this ecosystem. */
  contactRoles: string[];
}

/**
 * A structured representation of the user: what they sell, who they target,
 * where, the signals they consider ideal, and any targets to exclude.
 * Produced by an `IntentParser` (heuristic today, LLM-backed later).
 */
export interface UserProfile {
  /** What the user sells, e.g. "PBM consulting". */
  whatTheySell: string;
  /** Buyer ecosystem they target. */
  targetBuyer: BuyerPackId;
  /** Geography focus (region id). "any" = anywhere. */
  region: string;
  /** Catalog signal ids that best match the problem the user solves. */
  idealSignals: string[];
  /** Buyer name/keyword fragments to exclude from results. */
  excludedTargets: string[];
  /** Structured discovery filters (from builder or URL). */
  sectorId?: string | null;
  industryId?: string | null;
  organizationTypeId?: string | null;
  /** US state postal code filter. */
  state?: string | null;
}

/**
 * Structured search intent: the derived `profile` plus the raw, free-text
 * buyer descriptor and the original input (kept for transparency).
 */
export interface SearchQuery {
  profile: UserProfile;
  /** Free-text buyer descriptor, e.g. "Regional health plans". */
  targets: string;
  /** Original raw input, preserved for transparency/debugging. */
  raw: RawSearchInput;
}

/** Raw, unparsed input straight from the UI or API caller. */
export interface RawSearchInput {
  /** Primary company-discovery query (preferred over sells). */
  query?: string;
  sells: string;
  buyerPack?: BuyerPackId | string;
  targets?: string;
  region?: string;
  /** Optional advanced seller capability context. */
  sellerContext?: string;
  /** Optional explicit exclusions (also inferred from free text). */
  excludedTargets?: string[];
  /** Structured taxonomy filters — preserved for discovery ranking. */
  sectorId?: string | null;
  industryId?: string | null;
  organizationTypeId?: string | null;
  state?: string | null;
}

/**
 * Contract for anything that turns raw input into a structured SearchQuery.
 * The MVP ships a heuristic implementation; an LLM-backed parser can
 * implement the same interface later with no downstream changes.
 */
export interface IntentParser {
  parse(input: RawSearchInput): SearchQuery;
}

/** Identifier for a (future or current) data source. */
export type ProviderId =
  | "mock"
  | "cms"
  | "sec-edgar"
  | "census"
  | "fda"
  | "nppes"
  | "wikipedia"
  | "news-rss"
  | "company-site";

/**
 * A plan describing which buyer pack(s) and providers a search should hit.
 * Today this resolves to a single buyer pack + the mock provider, but the
 * shape supports fanning out across multiple real providers later.
 */
export interface SourcePlan {
  query: SearchQuery;
  buyerPacks: BuyerPackId[];
  providers: ProviderId[];
}

/**
 * A signal instance as observed on a specific organization, before the
 * catalog metadata is merged in. Providers emit these; the signal builder
 * enriches them into full `ProspectSignal`s.
 */
export interface RawSignalInstance {
  /** Catalog signal id (must exist in the org's buyer pack). */
  signalId: string;
  strength: SignalStrength;
  /** How many days ago the signal was observed (freshness input). */
  freshnessDays: number;
  /** Optional org-specific evidence override. */
  evidenceOverride?: string;
}

/**
 * Raw candidate organization emitted by a provider, before scoring and
 * synthesis. Providers only need to produce this; the pipeline does the rest.
 */
export interface RawProspect {
  id: string;
  name: string;
  location: string;
  /** Region bucket this org belongs to (matches RegionSelector values). */
  region: string;
  buyerPack: BuyerPackId;
  size: SizeTier;
  /** Observed signals (references catalog signals by id). */
  signals: RawSignalInstance[];
  /** Seller offerings this org is an especially good fit for (keywords). */
  fitKeywords: string[];
  /** Master directory id when sourced from lib/directories. */
  directoryId?: string;
  /** True when the org exists in the curated master directory. */
  directoryMatch?: boolean;
  /** Taxonomy metadata from directory record. */
  sectorId?: string;
  industryId?: string;
  organizationTypeId?: string;
  /** Canonical organization type for catalog-scoped filters. */
  canonicalOrganizationTypeId?: string;
  /** Optional health-plan subtype (e.g. aca_marketplace). */
  healthPlanType?: HealthPlanType;
  /** US state code when known from directory. */
  stateCode?: string;
  /** All US states where the organization operates or is represented. */
  stateCodes?: string[];
  publicCompany?: boolean;
  /** Official website when known from catalog or enrichment. */
  website?: string;
  /** Short org description from catalog. */
  description?: string;
  /** Estimated employee count when available. */
  employeeEstimate?: number;
  /** Estimated covered lives / members (payers) when available. */
  coveredLives?: number;
  /** Machine-readable discovery match codes (from rank.ts). */
  discoveryMatchReasons?: string[];
  /** Discovery confidence (0–1) when from catalog. */
  discoveryConfidence?: number;
  /** IRS EIN when known (nonprofit catalog records). */
  ein?: string;
  /** Connector provenance from discovery catalog. */
  sourceRecords?: ProspectSourceRecord[];
}

/** Provenance record for a data connector backing this organization. */
export interface ProspectSourceRecord {
  connector: string;
  label: string;
  confidence: number;
  lastUpdated?: string;
  sourceUrl?: string;
  evidenceText?: string;
}

/** A fully enriched signal ready to score, explain, and display. */
export interface ProspectSignal {
  id: string;
  label: string;
  type: SignalType;
  strength: SignalStrength;
  /** Numeric strength (0–1) derived from `strength`. */
  strengthScore: number;
  source: SignalSource;
  evidenceText: string;
  whyNow: string;
  suggestedAction: string;
  freshnessDays: number;
  /** Combined recency + strength urgency (0–1). */
  urgency: number;
}

/** One line of the "source trail" shown on a card. */
export interface SourceTrailItem {
  source: SignalSource;
  evidenceText: string;
}

/** One factor's contribution to the opportunity score. */
export interface ScoreFactor {
  key:
    | "buyerMatch"
    | "regionMatch"
    | "industryMatch"
    | "sectorMatch"
    | "orgTypeMatch"
    | "stateMatch"
    | "structurePenalty"
    | "problemFit"
    | "signalStrength"
    | "signalFreshness"
    | "outreachUrgency";
  label: string;
  /** Points this factor contributed (already weighted), 0-based. */
  points: number;
  /** Max points this factor could contribute, for explainability. */
  maxPoints: number;
  /** Short human explanation of why these points were awarded. */
  detail: string;
}

/** Full, explainable breakdown of how an opportunity score was computed. */
export interface ScoreBreakdown {
  total: number;
  factors: ScoreFactor[];
}

/** A fully synthesized prospect ready to render as a card. */
export interface Prospect {
  id: string;
  name: string;
  location: string;
  /** Region bucket (matches RegionSelector values). */
  region: string;
  /** Human label for organization type, e.g. "Health Plan". */
  buyerType: string;
  /** Internal taxonomy target (pipeline anchor). */
  buyerPack: BuyerPackId;
  /** 0–100 opportunity score. */
  score: number;
  scoreBreakdown: ScoreBreakdown;
  /** Bullet points explaining why this prospect matters. */
  whyItMatters: string[];
  /** Enriched signals (drives chips + detail). */
  signals: ProspectSignal[];
  /** Card-level timing narrative. */
  whyNow: string;
  /** Provenance lines, e.g. "CMS · Medicare enrollment placeholder". */
  sourceTrail: SourceTrailItem[];
  /** One-line suggested outreach angle. */
  outreachAngle: string;
  /** Suggested contact roles to target. */
  contactRoles: string[];
  /** Approximate organization size tier when available. */
  size?: SizeTier;
  /** Taxonomy metadata for client-side filtering. */
  sectorId?: string;
  industryId?: string;
  organizationTypeId?: string;
  /** Canonical organization type for catalog-scoped filters. */
  canonicalOrganizationTypeId?: string;
  /** Optional health-plan subtype (e.g. aca_marketplace). */
  healthPlanType?: HealthPlanType;
  stateCode?: string;
  /** All US states where the organization operates or is represented. */
  stateCodes?: string[];
  publicCompany?: boolean;
  /** True when sourced from master directory without live enrichment. */
  directoryMatch?: boolean;
  /** Official website when known. */
  website?: string;
  /** Short org description from catalog or enrichment. */
  description?: string;
  /** Estimated employee count when available. */
  employeeEstimate?: number;
  /** Estimated covered lives / members (payers) when available. */
  coveredLives?: number;
  /** Human-readable bullets explaining why this org matched the search. */
  matchReasons: string[];
  /** Discovery confidence (0–1) when from catalog. */
  discoveryConfidence?: number;
  /** IRS EIN when known from nonprofit catalog records. */
  ein?: string;
  /** Connector provenance with metadata for rich source badges. */
  sourceRecords: ProspectSourceRecord[];
}

/** Response shape returned by `/api/search`. */
export interface SearchResponse {
  query: SearchQuery;
  prospects: Prospect[];
  coverage: {
    totalCatalogRecords: number;
    searchedRecords: number;
    coveragePercent: number;
    confidence: number;
  };
  /** Discovery pipeline totals when search uses the catalog index. */
  discovery?: {
    totalAfterRank: number;
    totalReturned: number;
    catalogTotal: number;
    /** Staged-discovery coverage metadata (fallback status, sources, benchmark). */
    metadata?: DiscoveryMetadata;
  };
}
