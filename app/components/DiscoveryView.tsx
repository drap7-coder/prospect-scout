"use client";

import { useMemo } from "react";
import type { Prospect } from "@/lib/search/types";
import type { ResultDensity } from "@/lib/intelligence/resultDensity";
import { buildDiscoveryRows } from "@/lib/discovery/discoveryRows";
import { DiscoveryCarousel } from "./DiscoveryCarousel";
import { ResultsList } from "./ResultsList";

export function DiscoveryView({
  prospects,
  density,
  enriching,
  selectedId,
  onSelect,
}: {
  prospects: Prospect[];
  density: ResultDensity;
  enriching: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const rows = useMemo(() => buildDiscoveryRows(prospects), [prospects]);

  const rankOf = useMemo(() => {
    const map = new Map<string, number>();
    prospects.forEach((p, i) => map.set(p.id, i + 1));
    return (id: string) => map.get(id) ?? 0;
  }, [prospects]);

  // No qualifying rows → fall back to plain list content.
  if (rows.length === 0) {
    return (
      <ResultsList
        prospects={prospects}
        density={density}
        enriching={enriching}
        selectedId={selectedId}
        onSelect={onSelect}
        rankOf={rankOf}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        {rows.map((row) => (
          <DiscoveryCarousel
            key={row.id}
            row={row}
            rankOf={rankOf}
            density={density}
            enriching={enriching}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>

      <section aria-labelledby="discovery-all-results" className="border-t border-border/60 pt-5">
        <h3
          id="discovery-all-results"
          className="mb-3 text-sm font-semibold tracking-[-0.01em] text-foreground"
        >
          All Results
          <span className="ml-2 font-mono text-[0.625rem] font-normal text-muted-2">
            {prospects.length.toLocaleString()}
          </span>
        </h3>
        <ResultsList
          prospects={prospects}
          density={density}
          enriching={enriching}
          selectedId={selectedId}
          onSelect={onSelect}
          rankOf={rankOf}
        />
      </section>
    </div>
  );
}
