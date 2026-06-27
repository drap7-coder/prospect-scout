"use client";

import type { Prospect } from "@/lib/search/types";
import type { ResultDensity } from "@/lib/intelligence/resultDensity";
import { ResultRow } from "./ResultRow";

export function ResultsList({
  prospects,
  density,
  enriching,
  selectedId,
  onSelect,
  rankOf,
}: {
  prospects: Prospect[];
  density: ResultDensity;
  enriching: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  rankOf?: (id: string) => number;
}) {
  return (
    <div
      className={`flex flex-col ${density === "compact" ? "gap-2" : "gap-2.5 sm:gap-3"}`}
    >
      {prospects.map((prospect, i) => (
        <ResultRow
          key={prospect.id}
          prospect={prospect}
          rank={rankOf ? rankOf(prospect.id) : i + 1}
          density={density}
          enriching={enriching}
          selected={prospect.id === selectedId}
          onSelect={() => onSelect(prospect.id)}
        />
      ))}
    </div>
  );
}
