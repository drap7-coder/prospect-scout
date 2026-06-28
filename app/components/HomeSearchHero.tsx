"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  builderToSearchState,
  HOMEPAGE_INDUSTRY_SELECTORS,
  industrySelectorToBuilderState,
  type HomepageIndustrySelector,
  type ProspectListBuilderState,
} from "@/lib/search/prospectListBuilder";
import { searchStateToParams } from "@/lib/search/searchState";
import { ProspectListBuilder } from "./ProspectListBuilder";
import { useInteractionFeedback } from "./InteractionProvider";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function IndustryCard({
  selector,
  selected,
  onPick,
}: {
  selector: HomepageIndustrySelector;
  selected: boolean;
  onPick: (s: HomepageIndustrySelector) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(selector)}
      aria-pressed={selected}
      className={`interactive-press flex h-full w-full flex-col items-center gap-2.5 rounded-2xl border p-4 text-center text-white transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-5 ${
        selected
          ? "border-cyan-300/70 bg-[#06141f]/95 ring-1 ring-cyan-200/50 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
          : "border-white/25 bg-[#06141f] shadow-[0_8px_32px_rgba(0,0,0,0.34)] hover:border-cyan-200/45 hover:bg-[#06141f]"
      }`}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.08] text-[1.7rem] leading-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        aria-hidden
      >
        {selector.emoji}
      </span>
      <span className="text-sm font-semibold leading-tight text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.75)]">
        {selector.label}
      </span>
      <span className="text-xs leading-snug text-white/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.65)]">
        {selector.description}
      </span>
    </button>
  );
}

function IndustryCarousel({
  selectedId,
  onPick,
}: {
  selectedId: string | null;
  onPick: (s: HomepageIndustrySelector) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setCanLeft(scrollLeft > 4);
    setCanRight(scrollLeft < max - 4);
    const count = clientWidth > 0 ? Math.ceil(scrollWidth / clientWidth) : 1;
    setPageCount(Math.max(count, 1));
    setPage(clientWidth > 0 ? Math.round(scrollLeft / clientWidth) : 0);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setLayoutReady(true);
    update();
    // Recompute once layout/fonts settle (avoids a first-paint race).
    const raf = requestAnimationFrame(update);
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", update);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [update]);

  function scrollByPage(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * el.clientWidth * 0.85,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  function scrollToPage(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({
      left: i * el.clientWidth,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  return (
    <div className="relative mt-4">
      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        aria-label="Scroll industries left"
        disabled={!layoutReady || !canLeft}
        className="interactive-press absolute -left-1 top-[calc(50%-0.75rem)] z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#06141f]/90 text-white shadow-lg backdrop-blur transition hover:border-cyan-200/50 disabled:cursor-default disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 sm:-left-3 sm:h-9 sm:w-9 lg:-left-5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4"
        >
          {HOMEPAGE_INDUSTRY_SELECTORS.map((selector) => (
            <div
              key={selector.id}
              className="w-[min(78vw,17.5rem)] shrink-0 snap-center sm:w-[208px] sm:snap-start"
            >
              <IndustryCard
                selector={selector}
                selected={selectedId === selector.id}
                onPick={onPick}
              />
            </div>
          ))}
        </div>

        {/* Edge fades hint that more cards are scrollable. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 w-10 rounded-l-2xl bg-gradient-to-r from-[#020b16] to-transparent transition-opacity duration-200 sm:w-14 ${
            layoutReady && canLeft ? "opacity-90" : "opacity-0"
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-2xl bg-gradient-to-l from-[#020b16] to-transparent transition-opacity duration-200 sm:w-14 ${
            layoutReady && canRight ? "opacity-90" : "opacity-0"
          }`}
        />
      </div>

      <button
        type="button"
        onClick={() => scrollByPage(1)}
        aria-label="Scroll industries right"
        disabled={!layoutReady || !canRight}
        className="interactive-press absolute -right-1 top-[calc(50%-0.75rem)] z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#06141f]/90 text-white shadow-lg backdrop-blur transition hover:border-cyan-200/50 disabled:cursor-default disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 sm:-right-3 sm:h-9 sm:w-9 lg:-right-5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {layoutReady && pageCount > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToPage(i)}
              aria-label={`Go to prospect starter page ${i + 1}`}
              aria-current={page === i ? "page" : undefined}
              className={`h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${
                page === i ? "w-5 bg-cyan-300" : "w-2 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HomeSearchHero() {
  const router = useRouter();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedIndustryId, setSelectedIndustryId] = useState<string | null>(
    null,
  );
  const [builderSeed, setBuilderSeed] = useState<
    ProspectListBuilderState | undefined
  >(undefined);
  const [builderCardId, setBuilderCardId] = useState<string | null>(null);
  const builderRef = useRef<HTMLDivElement>(null);
  const { feedback } = useInteractionFeedback();

  function goBuilderSearch(builder: ProspectListBuilderState) {
    const state = builderToSearchState(builder);
    if (!state.query.trim()) return;
    router.push(`/results?${searchStateToParams(state).toString()}`);
  }

  function revealBuilder() {
    requestAnimationFrame(() => {
      builderRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function pickIndustry(selector: HomepageIndustrySelector) {
    feedback("select");
    setSelectedIndustryId(selector.id);
    setBuilderSeed(industrySelectorToBuilderState(selector));
    setBuilderCardId(selector.builderCardId ?? null);
    setBuilderOpen(true);
    revealBuilder();
  }

  function toggleManualBuilder() {
    if (builderOpen) {
      feedback("tap");
      setBuilderOpen(false);
      return;
    }
    feedback("select");
    setSelectedIndustryId(null);
    setBuilderSeed(undefined);
    setBuilderCardId(null);
    setBuilderOpen(true);
    revealBuilder();
  }

  return (
    <div className="mx-auto w-full max-w-5xl text-center">
      <div className="pt-[max(calc(env(safe-area-inset-top)+9.5rem),calc(env(safe-area-inset-top)+30svh))] sm:pt-[max(calc(env(safe-area-inset-top)+8.5rem),calc(env(safe-area-inset-top)+28svh))] lg:pt-[max(calc(env(safe-area-inset-top)+7.5rem),calc(env(safe-area-inset-top)+26svh))]">
        <h1 className="text-balance text-[2.6rem] font-bold leading-[1.02] tracking-[-0.03em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.72)] sm:text-6xl lg:text-[4.25rem]">
          Find your next best opportunity.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-balance text-sm leading-relaxed text-white/75 drop-shadow-[0_1px_10px_rgba(0,0,0,0.5)] sm:text-base">
          Choose who you want to find and Scout will guide the rest.
        </p>
      </div>

      {/* Primary entry point: guided prospect-list selector */}
      <section
        id="start"
        aria-labelledby="industry-selector-heading"
        className="mx-auto mt-6 max-w-5xl scroll-mt-20 sm:mt-7"
      >
        <h2
          id="industry-selector-heading"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
          </svg>
          Start with a prospect list
        </h2>

        <IndustryCarousel selectedId={selectedIndustryId} onPick={pickIndustry} />

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={toggleManualBuilder}
            aria-expanded={builderOpen}
            className={`interactive-press inline-flex min-h-[2.75rem] items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold backdrop-blur ${
              builderOpen
                ? "card-selected"
                : "border-white/20 bg-white/[0.06] text-white shadow-[0_10px_36px_rgba(0,0,0,0.2)] hover:border-cyan-200/45 hover:bg-white/10"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              <circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="1.75" />
              <circle cx="8" cy="17" r="2" stroke="currentColor" strokeWidth="1.75" />
            </svg>
            {builderOpen ? "Close builder" : "Build a custom list"}
          </button>
        </div>
      </section>

      <div ref={builderRef} className="scroll-mt-20">
        <ProspectListBuilder
          key={selectedIndustryId ?? "manual"}
          open={builderOpen}
          onSubmit={goBuilderSearch}
          initialState={builderSeed}
          initialCategoryId={builderCardId}
        />
      </div>
    </div>
  );
}
