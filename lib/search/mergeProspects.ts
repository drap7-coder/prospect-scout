import type { Prospect } from "@/lib/search/types";

function prospectRank(p: Prospect): number {
  return p.score * 1000 + p.signals.length * 10 + p.sourceTrail.length;
}

function normalizeOrgKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Merges prospect lists by normalized org name — keeps the richer / higher-scoring version. */
export function mergeProspectLists(
  existing: Prospect[],
  incoming: Prospect[],
): Prospect[] {
  const byKey = new Map<string, Prospect>();

  function put(p: Prospect) {
    const key = normalizeOrgKey(p.name);
    const cur = byKey.get(key);
    if (!cur || prospectRank(p) > prospectRank(cur)) {
      byKey.set(key, p);
    }
  }

  for (const p of existing) put(p);
  for (const p of incoming) put(p);

  return [...byKey.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
