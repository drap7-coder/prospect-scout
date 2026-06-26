import type { Prospect } from "@/lib/search/types";
import {
  activeSources,
  displaySource,
} from "@/lib/intelligence/evidence";
import { SOURCE_SUMMARY_LABELS } from "@/lib/taxonomy";

/** Count prospects with at least one signal/trail from a source bucket. */
export function countBySource(prospects: Prospect[]): Record<string, number> {
  const counts: Record<string, number> = {
    Directory: 0,
    CMS: 0,
    SEC: 0,
    FDA: 0,
    RSS: 0,
    "Public Web": 0,
    Mock: 0,
  };

  for (const p of prospects) {
    const sources = new Set<string>();
    if (p.directoryMatch) sources.add("Directory");
    for (const s of activeSources(p)) {
      sources.add(displaySource(s));
    }
    const real = [...sources].filter((s) => s !== "Mock");
    if (real.length === 0 && p.signals.length === 0 && !p.directoryMatch) {
      sources.add("Mock");
    }
    for (const src of sources) {
      if (src in counts) counts[src] += 1;
    }
  }

  return counts;
}

/** e.g. "Showing 28 organizations from Directory, SEC, FDA…" */
export function formatSourceSummary(
  count: number,
  prospects: Prospect[],
): string {
  const bySource = countBySource(prospects);
  const parts = Object.entries(bySource)
    .filter(([, n]) => n > 0)
    .map(([src, n]) => `${n} ${SOURCE_SUMMARY_LABELS[src] ?? src}`);

  if (parts.length === 0) {
    return `Showing ${count} organizations`;
  }

  return `Showing ${count} organizations from ${parts.join(", ")}`;
}
