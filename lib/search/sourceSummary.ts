import type { Prospect } from "@/lib/search/types";
import {
  activeSources,
  displaySource,
} from "@/lib/intelligence/evidence";
import { SOURCE_SUMMARY_LABELS } from "@/lib/taxonomy";

/** Map discovery connector ids to result-summary source buckets. */
function connectorToSummaryLabel(connector: string): keyof typeof SOURCE_SUMMARY_LABELS | null {
  const id = connector.toLowerCase();
  if (id === "directory") return "Directory";
  if (id === "sec") return "SEC";
  if (id === "fda") return "FDA";
  if (id === "erisa") return "ERISA";
  if (id === "cms" || id === "aca-marketplace") return "CMS";
  if (id === "rss") return "RSS";
  if (
    id === "public-web" ||
    id === "wikipedia" ||
    id === "state-registry" ||
    id === "business-directory"
  ) {
    return "Public Web";
  }
  return null;
}

function summaryLabelsForProspect(prospect: Prospect): Set<string> {
  const sources = new Set<string>();

  if (prospect.sourceRecords?.length) {
    for (const rec of prospect.sourceRecords) {
      const label = connectorToSummaryLabel(rec.connector);
      if (label) sources.add(label);
    }
  }

  if (sources.size === 0) {
    if (prospect.directoryMatch) sources.add("Directory");
    for (const s of activeSources(prospect)) {
      sources.add(displaySource(s));
    }
    const real = [...sources].filter((s) => s !== "Mock");
    if (real.length === 0 && prospect.signals.length === 0 && !prospect.directoryMatch) {
      sources.add("Directory");
    }
  }

  return sources;
}

/** Count prospects with at least one signal/trail from a source bucket. */
export function countBySource(prospects: Prospect[]): Record<string, number> {
  const counts: Record<string, number> = {
    Directory: 0,
    CMS: 0,
    SEC: 0,
    FDA: 0,
    ERISA: 0,
    RSS: 0,
    "Public Web": 0,
    Mock: 0,
  };

  for (const p of prospects) {
    for (const src of summaryLabelsForProspect(p)) {
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
