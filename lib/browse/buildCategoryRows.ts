import type { Prospect } from "@/lib/search/types";
import type { BrowseContext, BrowseGroupSpec, BrowseRow } from "./types";
import { categoryGroupSpecs } from "./connectors/registry";

const MIN_ROW = 1;

function summarizeRow(prospects: Prospect[]): BrowseRow["summaryMetrics"] {
  const metrics: BrowseRow["summaryMetrics"] = [
    { label: "Organizations", value: prospects.length.toLocaleString() },
  ];

  const lives = prospects
    .map((p) => p.coveredLives)
    .filter((v): v is number => v != null && v > 0);
  if (lives.length > 0) {
    const total = lives.reduce((a, b) => a + b, 0);
    metrics.push({
      label: "Total covered lives",
      value: total.toLocaleString(),
    });
  }

  const avgScore =
    prospects.length > 0
      ? Math.round(
          prospects.reduce((a, p) => a + p.score, 0) / prospects.length,
        )
      : 0;
  if (avgScore > 0) {
    metrics.push({ label: "Avg opportunity", value: String(avgScore) });
  }

  return metrics;
}

function buildRowFromSpec(
  spec: BrowseGroupSpec,
  prospects: Prospect[],
): BrowseRow | null {
  const members: Prospect[] = [];
  const seen = new Set<string>();
  for (const p of prospects) {
    if (!spec.match(p)) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    members.push(p);
  }
  if (members.length < MIN_ROW) return null;

  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    prospects: members,
    totalCount: members.length,
    summaryMetrics: summarizeRow(members),
    viewAll: spec.viewAll,
  };
}

export function buildCategoryRows(
  prospects: Prospect[],
  ctx: BrowseContext,
): BrowseRow[] {
  const specs = categoryGroupSpecs(ctx, prospects);
  const rows: BrowseRow[] = [];
  for (const spec of specs) {
    const row = buildRowFromSpec(spec, prospects);
    if (row) rows.push(row);
  }
  return rows;
}

export function buildRowsFromSpecs(
  specs: BrowseGroupSpec[],
  prospects: Prospect[],
): BrowseRow[] {
  return specs
    .map((spec) => buildRowFromSpec(spec, prospects))
    .filter((r): r is BrowseRow => r != null);
}
