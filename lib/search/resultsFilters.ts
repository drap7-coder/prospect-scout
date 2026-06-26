import type { Prospect, SignalSource } from "@/lib/search/types";
import {
  displaySource,
  evidenceSourceCount,
  prospectFreshness,
} from "@/lib/intelligence/evidence";
import type { SearchState } from "@/lib/search/searchState";
import {
  allowedTaxonomyTargets,
  FRESHNESS_FILTERS,
  mountainWestRegions,
  ORGANIZATION_TYPES,
  resolveSearchState,
  SIGNAL_FILTERS,
} from "@/lib/search/searchState";
import { ANY_REGION } from "@/lib/search/regions";

export type ResultsSortKey =
  | "score"
  | "freshness"
  | "evidence"
  | "name";

const SIZE_MAP: Record<string, string[]> = {
  Small: ["small"],
  "Mid-Market": ["mid"],
  Large: ["large"],
  Enterprise: ["enterprise"],
};

const SIGNAL_FILTER_MATCH: Record<
  string,
  (p: Prospect) => boolean
> = {
  "leadership-change": (p) =>
    p.signals.some(
      (s) =>
        s.type === "leadership" ||
        /leadership|executive|chief|ceo|cfo|president/i.test(
          `${s.label} ${s.evidenceText}`,
        ),
    ),
  "growth-expansion": (p) =>
    p.signals.some(
      (s) =>
        s.type === "growth" ||
        /expan|merger|acquisition|footprint|growth/i.test(
          `${s.label} ${s.id}`,
        ),
    ),
  "regulatory-pressure": (p) =>
    p.signals.some(
      (s) =>
        s.type === "regulatory" ||
        /regulat|compliance|340b|star rating/i.test(`${s.label} ${s.id}`),
    ),
  "fda-recall": (p) =>
    p.signals.some(
      (s) =>
        s.source === "FDA" ||
        /^fda-/.test(s.id) ||
        /recall|enforcement/i.test(s.label),
    ),
  "cms-enrollment": (p) =>
    p.signals.some(
      (s) =>
        s.source === "CMS" ||
        /^cms-/.test(s.id) ||
        /enrollment|medicare|advantage/i.test(s.label),
    ),
  "star-ratings": (p) =>
    p.signals.some((s) => /star rating|star-ratings/i.test(`${s.label} ${s.id}`)),
  "sec-filing": (p) =>
    p.signals.some(
      (s) =>
        s.source === "SEC" ||
        /filing|10-k|8-k|edgar/i.test(`${s.label} ${s.evidenceText}`),
    ),
  hiring: (p) =>
    p.signals.some((s) =>
      /hiring|workforce|director|engineer|recruit/i.test(
        `${s.label} ${s.evidenceText}`,
      ),
    ),
  "partnership-acquisition": (p) =>
    p.signals.some((s) =>
      /partnership|acquisition|merger|joint venture/i.test(
        `${s.label} ${s.evidenceText}`,
      ),
    ),
};

function matchesSourceFilter(
  prospect: Prospect,
  sourceId: string,
): boolean {
  if (sourceId === "Mock") {
    const real = activeRealSources(prospect);
    return real.length === 0;
  }
  if (sourceId === "SEC") {
    return prospectHasSource(prospect, "SEC");
  }
  return prospectHasSource(prospect, sourceId as SignalSource);
}

function activeRealSources(prospect: Prospect): SignalSource[] {
  const sources = new Set<SignalSource>();
  for (const s of prospect.signals) {
    const d = displaySource(s.source);
    if (d !== "Public Web" || !/^mock/i.test(s.evidenceText)) {
      sources.add(d);
    }
  }
  for (const t of prospect.sourceTrail) {
    if (!/unavailable|placeholder|mock/i.test(t.evidenceText)) {
      sources.add(displaySource(t.source));
    }
  }
  return [...sources];
}

function prospectHasSource(
  prospect: Prospect,
  source: SignalSource | "SEC",
): boolean {
  const normalized = source === "SEC" ? "SEC" : displaySource(source);
  return (
    prospect.signals.some((s) => displaySource(s.source) === normalized) ||
    prospect.sourceTrail.some(
      (t) =>
        displaySource(t.source) === normalized &&
        !/unavailable/i.test(t.evidenceText),
    )
  );
}

function matchesFreshness(prospect: Prospect, freshnessId: string): boolean {
  const filter = FRESHNESS_FILTERS.find((f) => f.id === freshnessId);
  if (!filter || filter.id === "any" || !("maxDays" in filter)) return true;
  return prospectFreshness(prospect) <= filter.maxDays;
}

export function applyResultsFilters(
  prospects: Prospect[],
  state: SearchState,
): Prospect[] {
  const resolved = resolveSearchState(state);
  const allowedTargets = allowedTaxonomyTargets(resolved);

  return prospects.filter((p) => {
    if (resolved.organizationType) {
      const org = ORGANIZATION_TYPES.find((o) => o.id === resolved.organizationType);
      if (org && p.buyerPack !== org.taxonomyTarget) return false;
    } else if (allowedTargets && !allowedTargets.includes(p.buyerPack)) {
      return false;
    }

    if (resolved.location && resolved.location !== "nationwide") {
      if (resolved.location === "mountain-west") {
        if (!mountainWestRegions().includes(p.region)) return false;
      } else {
        const regionId =
          resolved.location === ANY_REGION ? p.region : resolved.location;
        if (p.region !== regionId && p.region !== "any") return false;
      }
    }

    if (resolved.companySize) {
      const tiers = SIZE_MAP[resolved.companySize];
      if (tiers && p.size && !tiers.includes(p.size)) return false;
    }

    if (resolved.freshness && resolved.freshness !== "any") {
      if (!matchesFreshness(p, resolved.freshness)) return false;
    }

    if (resolved.signals.length > 0) {
      const ok = resolved.signals.every((sigId) => {
        const matcher = SIGNAL_FILTER_MATCH[sigId];
        return matcher ? matcher(p) : true;
      });
      if (!ok) return false;
    }

    if (resolved.sources.length > 0) {
      const ok = resolved.sources.some((src) => matchesSourceFilter(p, src));
      if (!ok) return false;
    }

    return true;
  });
}

export function sortResults(
  prospects: Prospect[],
  key: ResultsSortKey,
): Prospect[] {
  const copy = [...prospects];
  switch (key) {
    case "score":
      return copy.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    case "freshness":
      return copy.sort(
        (a, b) =>
          prospectFreshness(a) - prospectFreshness(b) ||
          b.score - a.score,
      );
    case "evidence":
      return copy.sort(
        (a, b) =>
          evidenceSourceCount(b) - evidenceSourceCount(a) ||
          b.score - a.score,
      );
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy;
  }
}

export function signalFilterLabel(id: string): string {
  return SIGNAL_FILTERS.find((s) => s.id === id)?.label ?? id;
}
