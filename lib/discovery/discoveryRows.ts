import type { Prospect } from "@/lib/search/types";
import { prospectFreshness } from "@/lib/intelligence/evidence";

/** Presentation-layer result views. Discovery is the default experience. */
export const RESULT_VIEWS = ["discovery", "list", "table"] as const;
export type ResultView = (typeof RESULT_VIEWS)[number];
export const DEFAULT_RESULT_VIEW: ResultView = "discovery";

export function normalizeResultView(value: string | null | undefined): ResultView {
  return RESULT_VIEWS.includes(value as ResultView)
    ? (value as ResultView)
    : DEFAULT_RESULT_VIEW;
}

/** Switching views is a pure client-side concern — it never triggers a refetch. */
export function shouldRefetchOnViewChange(): boolean {
  return false;
}

export const MAX_ROW_CARDS = 12;
export const MIN_ROW_PROSPECTS = 3;
const RECENTLY_ADDED_MAX_DAYS = 21;

export interface DiscoveryRow {
  id: string;
  title: string;
  description: string;
  prospects: Prospect[];
}

function hasSecEvidence(p: Prospect): boolean {
  if (p.signals.some((s) => s.source === "SEC")) return true;
  return (p.sourceRecords ?? []).some(
    (r) => r.connector === "sec" || /^sec$/i.test(r.label),
  );
}

function hasStrongOrMultipleSignals(p: Prospect): boolean {
  if (p.signals.length >= 2) return true;
  return p.signals.some((s) => s.strength === "strong");
}

function isLargeOrganization(p: Prospect): boolean {
  if (p.size === "enterprise" || p.size === "large") return true;
  if ((p.employeeEstimate ?? 0) >= 1000) return true;
  return false;
}

function isRecentlyAdded(p: Prospect): boolean {
  const fromSources = (p.sourceRecords ?? []).some((r) => {
    if (!r.lastUpdated) return false;
    const ts = Date.parse(r.lastUpdated);
    if (Number.isNaN(ts)) return false;
    const days = (Date.now() - ts) / 86_400_000;
    return days >= 0 && days <= 60;
  });
  if (fromSources) return true;
  return prospectFreshness(p) <= RECENTLY_ADDED_MAX_DAYS;
}

function isPublicCompany(p: Prospect): boolean {
  return p.publicCompany === true || hasSecEvidence(p);
}

function isNonprofit(p: Prospect): boolean {
  return (
    p.canonicalOrganizationTypeId === "nonprofit" ||
    p.sectorId === "nonprofit" ||
    p.industryId === "nonprofit"
  );
}

function isHealthPlan(p: Prospect): boolean {
  return (
    p.canonicalOrganizationTypeId === "health-plan" ||
    p.canonicalOrganizationTypeId === "health_plan" ||
    p.industryId === "payers" ||
    p.buyerPack === "health-plans"
  );
}

function isManufacturer(p: Prospect): boolean {
  return (
    p.canonicalOrganizationTypeId === "manufacturer" ||
    p.sectorId === "manufacturing" ||
    p.buyerPack === "manufacturers"
  );
}

interface RowDefinition {
  id: string;
  title: string;
  description: string;
  /** null predicate means "all prospects" (Top Matches). */
  predicate: ((p: Prospect) => boolean) | null;
}

const ROW_DEFINITIONS: RowDefinition[] = [
  {
    id: "top-matches",
    title: "Top Matches",
    description: "Highest ranked results for this search",
    predicate: null,
  },
  {
    id: "strongest-signals",
    title: "Strongest Buying Signals",
    description: "Organizations with the strongest or most numerous signals",
    predicate: hasStrongOrMultipleSignals,
  },
  {
    id: "largest-organizations",
    title: "Largest Organizations",
    description: "Enterprise-scale organizations by size indicators",
    predicate: isLargeOrganization,
  },
  {
    id: "recently-added",
    title: "Recently Added",
    description: "Organizations with the freshest source activity",
    predicate: isRecentlyAdded,
  },
  {
    id: "public-companies",
    title: "Public Companies",
    description: "Publicly traded organizations with SEC presence",
    predicate: isPublicCompany,
  },
  {
    id: "nonprofits",
    title: "Nonprofits",
    description: "Nonprofit and tax-exempt organizations",
    predicate: isNonprofit,
  },
  {
    id: "health-plans",
    title: "Health Plans",
    description: "Payers and managed care organizations",
    predicate: isHealthPlan,
  },
  {
    id: "manufacturers",
    title: "Manufacturers",
    description: "Manufacturing and industrial organizations",
    predicate: isManufacturer,
  },
];

/**
 * Group an already-ranked, already-filtered prospect list into discovery rows.
 *
 * - Preserves the incoming ranking order within each row.
 * - De-duplicates by id within a row (duplicates across rows are allowed).
 * - Caps each row at {@link MAX_ROW_CARDS}.
 * - Omits rows with fewer than {@link MIN_ROW_PROSPECTS} qualifying prospects.
 *
 * Pure: relies only on data already present on the prospects (no fetching).
 */
export function buildDiscoveryRows(prospects: Prospect[]): DiscoveryRow[] {
  const rows: DiscoveryRow[] = [];

  for (const def of ROW_DEFINITIONS) {
    const seen = new Set<string>();
    const members: Prospect[] = [];

    for (const p of prospects) {
      if (def.predicate && !def.predicate(p)) continue;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      members.push(p);
      if (members.length >= MAX_ROW_CARDS) break;
    }

    if (members.length >= MIN_ROW_PROSPECTS) {
      rows.push({
        id: def.id,
        title: def.title,
        description: def.description,
        prospects: members,
      });
    }
  }

  return rows;
}
