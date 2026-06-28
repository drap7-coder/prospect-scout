"use client";

import { useMemo, useRef, useCallback } from "react";
import type { Prospect } from "@/lib/search/types";
import type { BrowseLensId } from "@/lib/browse/types";
import type { SearchState } from "@/lib/search/searchState";
import { buildBrowseRows, defaultBrowseLens } from "@/lib/browse/buildBrowseRows";
import {
  buildBrowseContext,
  resolveBrowseLenses,
} from "@/lib/browse/connectors/registry";
import { BrowseCarouselRow } from "./BrowseCarouselRow";

function AlphabetJumpBar({
  letters,
  onJump,
}: {
  letters: string[];
  onJump: (letter: string) => void;
}) {
  if (letters.length <= 1) return null;
  return (
    <nav
      aria-label="Jump to letter"
      className="alphabet-jump-bar mb-1 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface-2 px-2 py-2"
    >
      <span className="label-mono mr-1 shrink-0 text-[0.625rem] text-muted-2">
        A–Z
      </span>
      {letters.map((letter) => (
        <button
          key={letter}
          type="button"
          onClick={() => onJump(letter)}
          className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1.5 font-mono text-xs text-muted transition hover:bg-surface hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          {letter}
        </button>
      ))}
    </nav>
  );
}

export function BrowseExperience({
  prospects,
  searchState,
  browseLens,
  selectedId,
  onSelect,
  onApplyFilter,
}: {
  prospects: Prospect[];
  searchState: SearchState;
  browseLens: BrowseLensId;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onApplyFilter: (patch: Partial<SearchState>) => void;
}) {
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const ctx = useMemo(
    () => buildBrowseContext(prospects, searchState),
    [prospects, searchState],
  );

  const rows = useMemo(
    () => buildBrowseRows(browseLens, prospects, ctx),
    [browseLens, prospects, ctx],
  );

  const jumpToLetter = useCallback((letter: string) => {
    const rowId =
      letter === "#" ? "letter-other" : `letter-${letter.toLowerCase()}`;
    rowRefs.current.get(rowId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {browseLens === "alphabet" ? (
        <AlphabetJumpBar
          letters={rows.map((r) => r.title)}
          onJump={jumpToLetter}
        />
      ) : null}

      {rows.map((row) => (
        <div
          key={row.id}
          ref={(el) => {
            if (el) rowRefs.current.set(row.id, el);
            else rowRefs.current.delete(row.id);
          }}
          className="scroll-mt-28"
        >
          <BrowseCarouselRow
            row={row}
            selectedId={selectedId}
            onSelect={onSelect}
            variant={browseLens === "alphabet" ? "alphabet" : "browse"}
            onViewAll={
              row.viewAll
                ? () => onApplyFilter(row.viewAll!.filterPatch)
                : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}

export { defaultBrowseLens, resolveBrowseLenses, buildBrowseContext };
