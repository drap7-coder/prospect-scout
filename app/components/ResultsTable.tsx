"use client";

import type { Prospect } from "@/lib/search/types";
import type { SearchState } from "@/lib/search/searchState";
import type { ResultDensity } from "@/lib/intelligence/resultDensity";
import { buildEnterpriseProspectDisplay } from "@/lib/enterprise/prospectDisplay";
import { prospectFreshness, formatFreshness } from "@/lib/intelligence/evidence";
import { EnterpriseBadge } from "./EnterpriseProspectMeta";

function intelligenceHighlight(prospect: Prospect): string {
  const mod = prospect.organizationIntelligence?.modules[0];
  const metric = mod?.summaryMetrics[0];
  if (metric) {
    return `${metric.value} ${metric.label}`;
  }
  if (mod?.title) return mod.title;
  if (prospect.whyItMatters[0]) return prospect.whyItMatters[0];
  if (prospect.signals[0]?.label) return prospect.signals[0].label;
  return "—";
}

function signalSummary(prospect: Prospect): string {
  if (prospect.signals.length === 0) return "—";
  const top = prospect.signals[0].label;
  if (prospect.signals.length === 1) return top;
  return `${top} +${prospect.signals.length - 1}`;
}

export function ResultsTable({
  prospects,
  selectedId,
  onSelect,
  searchState,
}: {
  prospects: Prospect[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchState?: Pick<SearchState, "classificationNamespace" | "classificationId"> | null;
}) {
  return (
    <div className="results-table-wrap overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="results-table w-full min-w-[44rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/80">
            <th scope="col" className="results-table-th w-12">
              #
            </th>
            <th scope="col" className="results-table-th">
              Organization
            </th>
            <th scope="col" className="results-table-th hidden md:table-cell">
              Type
            </th>
            <th scope="col" className="results-table-th hidden lg:table-cell">
              Location
            </th>
            <th scope="col" className="results-table-th w-20 text-right">
              Score
            </th>
            <th scope="col" className="results-table-th hidden sm:table-cell">
              Intelligence
            </th>
            <th scope="col" className="results-table-th hidden xl:table-cell">
              Signals
            </th>
            <th scope="col" className="results-table-th hidden xl:table-cell">
              Freshness
            </th>
            <th scope="col" className="results-table-th w-10">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {prospects.map((prospect, index) => {
            const selected = prospect.id === selectedId;
            const freshness = formatFreshness(prospectFreshness(prospect));
            const display = buildEnterpriseProspectDisplay(prospect, searchState);

            return (
              <tr
                key={prospect.id}
                className={`results-table-row border-b border-border/70 last:border-b-0 ${
                  selected ? "results-table-row--selected" : ""
                }`}
                onClick={() => onSelect(prospect.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(prospect.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View ${prospect.name}`}
              >
                <td className="results-table-td font-mono text-xs text-muted-2">
                  {String(index + 1).padStart(2, "0")}
                </td>
                <td className="results-table-td">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-medium text-foreground">
                        {prospect.name}
                      </p>
                      {display.isEnterprise ? <EnterpriseBadge /> : null}
                    </div>
                    {display.collapseLine ? (
                      <p className="mt-0.5 truncate text-xs text-muted-2">
                        {display.collapseLine}
                      </p>
                    ) : null}
                    {display.matchedLob ? (
                      <p className="mt-0.5 truncate text-xs text-muted-2">
                        {display.matchedLob}
                      </p>
                    ) : null}
                    <p className="mt-0.5 truncate text-xs text-muted md:hidden">
                      {prospect.buyerType}
                      {prospect.location ? ` · ${prospect.location}` : ""}
                    </p>
                  </div>
                </td>
                <td className="results-table-td hidden text-muted md:table-cell">
                  {prospect.buyerType}
                </td>
                <td className="results-table-td hidden text-muted lg:table-cell">
                  {prospect.location || "—"}
                </td>
                <td className="results-table-td text-right">
                  <span className="inline-flex min-w-[2.25rem] justify-end font-mono text-xs font-semibold tabular-nums text-accent">
                    {Math.round(prospect.score)}
                  </span>
                </td>
                <td className="results-table-td hidden max-w-[14rem] truncate text-muted sm:table-cell">
                  {intelligenceHighlight(prospect)}
                </td>
                <td className="results-table-td hidden max-w-[12rem] truncate text-muted xl:table-cell">
                  {signalSummary(prospect)}
                </td>
                <td className="results-table-td hidden font-mono text-xs text-muted-2 xl:table-cell">
                  {freshness}
                </td>
                <td className="results-table-td text-muted-2">
                  <span aria-hidden className="text-base leading-none">
                    ›
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
