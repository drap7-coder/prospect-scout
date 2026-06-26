import type {
  Prospect,
  SignalSource,
  SignalType,
} from "@/lib/search/types";
import { displaySource, evidenceSourceCount, prospectFreshness } from "./evidence";

export type SortKey = "score" | "freshness" | "evidence" | "changed";

export interface FeedFilters {
  buyerType: string;
  region: string;
  signalType: SignalType | "all";
  source: SignalSource | "all";
  freshness: "7" | "30" | "90" | "all";
}

export const DEFAULT_FILTERS: FeedFilters = {
  buyerType: "all",
  region: "all",
  signalType: "all",
  source: "all",
  freshness: "all",
};

export function sortProspects(
  prospects: Prospect[],
  key: SortKey,
): Prospect[] {
  const copy = [...prospects];
  switch (key) {
    case "score":
      return copy.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    case "freshness":
    case "changed":
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
    default:
      return copy;
  }
}

export function applyFeedFilters(
  prospects: Prospect[],
  filters: FeedFilters,
): Prospect[] {
  return prospects.filter((p) => {
    if (filters.buyerType !== "all" && p.buyerType !== filters.buyerType) {
      return false;
    }
    if (filters.region !== "all" && p.region !== filters.region) {
      return false;
    }
    if (
      filters.signalType !== "all" &&
      !p.signals.some((s) => s.type === filters.signalType)
    ) {
      return false;
    }
    if (filters.source !== "all") {
      const normalized = displaySource(filters.source);
      const hasSource =
        p.signals.some((s) => displaySource(s.source) === normalized) ||
        p.sourceTrail.some(
          (t) =>
            displaySource(t.source) === normalized &&
            !/unavailable/i.test(t.evidenceText),
        );
      if (!hasSource) return false;
    }
    if (filters.freshness !== "all") {
      const maxDays = Number(filters.freshness);
      if (prospectFreshness(p) > maxDays) return false;
    }
    return true;
  });
}

export function uniqueBuyerTypes(prospects: Prospect[]): string[] {
  return [...new Set(prospects.map((p) => p.buyerType))].sort();
}

export function uniqueRegions(prospects: Prospect[]): string[] {
  return [...new Set(prospects.map((p) => p.region).filter((r) => r !== "any"))].sort();
}

export function relatedProspects(
  prospect: Prospect,
  pool: Prospect[],
  limit = 4,
): Prospect[] {
  return pool
    .filter((p) => p.id !== prospect.id)
    .map((p) => ({
      prospect: p,
      weight:
        (p.buyerPack === prospect.buyerPack ? 3 : 0) +
        (p.region === prospect.region ? 2 : 0) +
        p.score / 100,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((e) => e.prospect);
}
