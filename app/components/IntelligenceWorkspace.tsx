"use client";

import { useMemo, useState } from "react";
import type { Prospect } from "@/lib/search/types";
import {
  applyFeedFilters,
  DEFAULT_FILTERS,
  sortProspects,
  uniqueBuyerTypes,
  uniqueRegions,
  type SortKey,
} from "@/lib/intelligence/feed";
import {
  FeedColumnHeader,
  OpportunityFeedRow,
} from "./OpportunityFeedRow";
import { FeedControls } from "./FeedControls";
import { IntelligencePreview } from "./IntelligencePreview";

export function IntelligenceWorkspace({ prospects }: { prospects: Prospect[] }) {
  const [sort, setSort] = useState<SortKey>("score");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => sortProspects(applyFeedFilters(prospects, filters), sort),
    [prospects, filters, sort],
  );

  const selected = filtered.find((p) => p.id === selectedId) ?? null;
  const previewOpen = selectedId !== null && selected !== null;

  const buyerTypes = useMemo(() => uniqueBuyerTypes(prospects), [prospects]);
  const regions = useMemo(() => uniqueRegions(prospects), [prospects]);

  return (
    <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface/40 shadow-xl shadow-black/20 lg:min-h-[36rem] lg:flex-row">
      {/* Feed pane */}
      <div
        className={`flex min-h-0 min-w-0 flex-col ${
          previewOpen ? "lg:flex-1" : "w-full"
        }`}
      >
        <FeedControls
          sort={sort}
          onSortChange={setSort}
          filters={filters}
          onFiltersChange={setFilters}
          buyerTypes={buyerTypes}
          regions={regions}
          total={prospects.length}
          shown={filtered.length}
        />

        <FeedColumnHeader />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-foreground">
                No opportunities match these filters.
              </p>
              <p className="mt-2 text-sm text-muted">
                Widen buyer, region, or freshness criteria.
              </p>
            </div>
          ) : (
            filtered.map((prospect, i) => (
              <OpportunityFeedRow
                key={prospect.id}
                prospect={prospect}
                rank={i + 1}
                selected={prospect.id === selectedId}
                onSelect={() => setSelectedId(prospect.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Inline preview — desktop */}
      {previewOpen ? (
        <div className="hidden min-h-0 lg:flex">
          <IntelligencePreview
            prospect={selected}
            open={previewOpen}
            onClose={() => setSelectedId(null)}
            variant="panel"
          />
        </div>
      ) : null}

      {/* Drawer preview — mobile / tablet */}
      <div className="lg:hidden">
        <IntelligencePreview
          prospect={selected}
          open={previewOpen}
          onClose={() => setSelectedId(null)}
          variant="drawer"
        />
      </div>
    </div>
  );
}
