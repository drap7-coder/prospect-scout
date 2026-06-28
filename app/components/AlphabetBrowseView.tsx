"use client";

import { useCallback, useMemo, useRef } from "react";
import type { Prospect } from "@/lib/search/types";
import type { ResultDensity } from "@/lib/intelligence/resultDensity";
import { buildAlphabetRows } from "@/lib/discovery/alphabetRows";
import { DiscoveryCarousel } from "./DiscoveryCarousel";

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

export function AlphabetBrowseView({
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
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const rows = useMemo(() => buildAlphabetRows(prospects), [prospects]);

  const rankOf = useMemo(() => {
    const map = new Map<string, number>();
    prospects.forEach((p, i) => map.set(p.id, i + 1));
    return (id: string) => map.get(id) ?? 0;
  }, [prospects]);

  const jumpToLetter = useCallback((letter: string) => {
    const rowId =
      letter === "#" ? "letter-other" : `letter-${letter.toLowerCase()}`;
    const el = rowRefs.current.get(rowId);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      <AlphabetJumpBar
        letters={rows.map((r) => r.title)}
        onJump={jumpToLetter}
      />
      {rows.map((row) => (
        <div
          key={row.id}
          ref={(el) => {
            if (el) rowRefs.current.set(row.id, el);
            else rowRefs.current.delete(row.id);
          }}
          className="scroll-mt-28"
        >
          <DiscoveryCarousel
            row={row}
            rankOf={rankOf}
            density={density}
            enriching={enriching}
            selectedId={selectedId}
            onSelect={onSelect}
            variant="alphabet"
          />
        </div>
      ))}
    </div>
  );
}
