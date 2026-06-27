"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Prospect } from "@/lib/search/types";
import type { ResultDensity } from "@/lib/intelligence/resultDensity";
import type { DiscoveryRow } from "@/lib/discovery/discoveryRows";
import { ResultCard } from "./ResultCard";

export function DiscoveryCarousel({
  row,
  rankOf,
  density,
  enriching,
  selectedId,
  onSelect,
}: {
  row: DiscoveryRow;
  rankOf: (id: string) => number;
  density: ResultDensity;
  enriching: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const headingId = `discovery-row-${row.id}`;

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, row.prospects.length]);

  const scrollByCards = useCallback((direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollByCards(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollByCards(-1);
    }
  }

  return (
    <section aria-labelledby={headingId} className="discovery-row">
      <div className="mb-2 flex items-end justify-between gap-3 pr-1">
        <div className="min-w-0">
          <h3
            id={headingId}
            className="text-sm font-semibold tracking-[-0.01em] text-foreground"
          >
            {row.title}
          </h3>
          <p className="font-mono text-[0.625rem] text-muted-2">
            {row.description} · {row.prospects.length}
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-1 md:flex">
          <button
            type="button"
            onClick={() => scrollByCards(-1)}
            disabled={!canScrollLeft}
            aria-label={`Scroll ${row.title} left`}
            className="discovery-arrow"
          >
            <span aria-hidden>‹</span>
          </button>
          <button
            type="button"
            onClick={() => scrollByCards(1)}
            disabled={!canScrollRight}
            aria-label={`Scroll ${row.title} right`}
            className="discovery-arrow"
          >
            <span aria-hidden>›</span>
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        role="group"
        aria-labelledby={headingId}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="discovery-scroll"
      >
        {row.prospects.map((prospect: Prospect) => (
          <div key={prospect.id} className="discovery-card-slot">
            <ResultCard
              prospect={prospect}
              rank={rankOf(prospect.id)}
              density={density}
              enriching={enriching}
              selected={prospect.id === selectedId}
              onViewDetails={() => onSelect(prospect.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
