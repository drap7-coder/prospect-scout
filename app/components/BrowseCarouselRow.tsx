"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Prospect } from "@/lib/search/types";
import type { BrowseRow } from "@/lib/browse/types";
import type { SearchState } from "@/lib/search/searchState";
import { ExecutiveBrowseCard } from "./ExecutiveBrowseCard";

export function BrowseCarouselRow({
  row,
  selectedId,
  onSelect,
  variant = "browse",
  onViewAll,
  searchState,
}: {
  row: BrowseRow;
  selectedId: string | null;
  onSelect: (id: string) => void;
  variant?: "browse" | "alphabet";
  onViewAll?: () => void;
  searchState?: Pick<SearchState, "classificationNamespace" | "classificationId"> | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const headingId = `browse-row-${row.id}`;

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
    el.scrollBy({
      left: direction * Math.round(el.clientWidth * 0.85),
      behavior: "smooth",
    });
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
        <div className="min-w-0 flex flex-1 items-end gap-3">
          {variant === "alphabet" ? (
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 font-mono text-lg font-semibold text-accent-cyan"
            >
              {row.title}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3
              id={headingId}
              className={
                variant === "alphabet"
                  ? "sr-only"
                  : "text-sm font-semibold tracking-[-0.01em] text-foreground"
              }
            >
              {variant === "alphabet" ? `Letter ${row.title}` : row.title}
            </h3>
            <p className="font-mono text-[0.625rem] text-muted-2">
              {row.description} · {row.totalCount.toLocaleString()}
            </p>
            {row.summaryMetrics && row.summaryMetrics.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {row.summaryMetrics.map((m) => (
                  <span
                    key={m.label}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-[0.625rem] text-muted"
                  >
                    <span className="text-muted-2">{m.label}</span>
                    <span className="text-foreground">{m.value}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onViewAll ? (
            <button
              type="button"
              onClick={onViewAll}
              className="font-mono text-[0.625rem] text-accent-cyan transition hover:text-foreground"
            >
              View all →
            </button>
          ) : null}
          <div className="hidden items-center gap-1 md:flex">
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
            <ExecutiveBrowseCard
              prospect={prospect}
              selected={prospect.id === selectedId}
              onViewDetails={() => onSelect(prospect.id)}
              searchState={searchState}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
