import type { Prospect } from "@/lib/search/types";

function prospectRank(p: Prospect): number {
  return p.score * 1000 + p.signals.length * 10 + p.sourceTrail.length;
}

/** Merges prospect lists by id — keeps the richer / higher-scoring version. */
export function mergeProspectLists(
  existing: Prospect[],
  incoming: Prospect[],
): Prospect[] {
  const byId = new Map<string, Prospect>();

  for (const p of existing) {
    byId.set(p.id, p);
  }

  for (const p of incoming) {
    const cur = byId.get(p.id);
    if (!cur || prospectRank(p) > prospectRank(cur)) {
      byId.set(p.id, p);
    }
  }

  return [...byId.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
