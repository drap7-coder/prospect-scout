"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  ReactNode,
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

const HOME_EXAMPLES = [
  { label: "Health plans in Texas", query: "Health plans in Texas" },
  { label: "Hospitals in Florida", query: "Hospitals in Florida" },
  {
    label: "PBMs with Medicare business",
    query: "PBMs with Medicare business",
  },
  { label: "Manufacturers in Ohio", query: "Manufacturers in Ohio" },
] as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Line-icon + accent color per industry, keyed by selector id. */
const INDUSTRY_VISUALS: Record<string, { accent: string; icon: ReactNode }> = {
  "health-plans": {
    accent: "text-cyan-300",
    icon: (
      <path
        d="M12 20s-7-4.3-7-9.3A4 4 0 0 1 12 7a4 4 0 0 1 7 3.7c0 1.2-.5 2.4-1.3 3.5M3 13h4l1.5-3 2.5 6 1.5-3H17"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  hospitals: {
    accent: "text-emerald-300",
    icon: (
      <>
        <path
          d="M5 21V6l7-3 7 3v15"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M12 8v5M9.5 10.5h5M9 21v-4h6v4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  "pbm-pharmacy": {
    accent: "text-violet-300",
    icon: (
      <>
        <rect
          x="3.5"
          y="8.5"
          width="17"
          height="7"
          rx="3.5"
          transform="rotate(45 12 12)"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path d="m9.5 9.5 5 5" stroke="currentColor" strokeWidth="1.75" />
      </>
    ),
  },
  manufacturers: {
    accent: "text-amber-200",
    icon: (
      <path
        d="M3 21V10l6 4V10l6 4V6l3-2v17H3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    ),
  },
  employers: {
    accent: "text-teal-300",
    icon: (
      <>
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M3.5 20a5.5 5.5 0 0 1 11 0M16 6.2a3 3 0 0 1 0 5.6M16.5 14c2.6.4 4.5 2.3 4.5 5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </>
    ),
  },
  nonprofits: {
    accent: "text-rose-300",
    icon: (
      <path
        d="M12 21s-6-3.8-6-8.2A3.3 3.3 0 0 1 12 9.6a3.3 3.3 0 0 1 6 3.2C18 17.2 12 21 12 21ZM4 13l3-3M20 13l-3-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  "financial-services": {
    accent: "text-sky-300",
    icon: (
      <>
        <path
          d="M3 9.5 12 4l9 5.5M5 10v8M19 10v8M9.5 10v8M14.5 10v8M3.5 20.5h17"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  "restaurants-hospitality": {
    accent: "text-orange-300",
    icon: (
      <path
        d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-1.7 0-3 2-3 5s1.3 4 3 4m0 0v9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
};

function IndustryCard({
  selector,
  selected,
  onPick,
}: {
  selector: HomepageIndustrySelector;
  selected: boolean;
  onPick: (s: HomepageIndustrySelector) => void;
}) {
  const visual = INDUSTRY_VISUALS[selector.id];
  return (
    <button
      type="button"
      onClick={() => onPick(selector)}
      aria-pressed={selected}
      className={`interactive-press flex h-full w-full flex-col items-center gap-2.5 rounded-2xl border p-4 text-center backdrop-blur transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-5 ${
        selected
          ? "border-cyan-300/70 bg-cyan-300/12 ring-1 ring-cyan-200/50"
          : "border-white/12 bg-[#06141f]/65 hover:border-cyan-200/45 hover:bg-white/[0.07]"
      }`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] ${visual?.accent ?? "text-cyan-300"}`}
        aria-hidden
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {visual?.icon}
        </svg>
      </span>
      <span className="text-sm font-semibold leading-tight text-white">
        {selector.label}
      </span>
      <span className="text-xs leading-snug text-white/60">
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
    <div className="relative mt-6">
      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        aria-label="Scroll industries left"
        disabled={!layoutReady || !canLeft}
        className="interactive-press absolute -left-3 top-[calc(50%-0.75rem)] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#06141f]/90 text-white shadow-lg backdrop-blur transition hover:border-cyan-200/50 disabled:cursor-default disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 sm:flex lg:-left-5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="relative">
        <div
          ref={scrollerRef}
          className="grid grid-cols-1 gap-3 sm:flex sm:snap-x sm:snap-mandatory sm:gap-4 sm:overflow-x-auto sm:scroll-smooth sm:pb-1 sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden"
        >
          {HOMEPAGE_INDUSTRY_SELECTORS.map((selector) => (
            <div
              key={selector.id}
              className="sm:w-[208px] sm:shrink-0 sm:snap-start"
            >
              <IndustryCard
                selector={selector}
                selected={selectedId === selector.id}
                onPick={onPick}
              />
            </div>
          ))}
        </div>

        {/* Edge fades hint that more cards are scrollable (desktop only). */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 hidden w-14 rounded-l-2xl bg-gradient-to-r from-[#020b16] to-transparent transition-opacity duration-200 sm:block ${
            layoutReady && canLeft ? "opacity-90" : "opacity-0"
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 hidden w-14 rounded-r-2xl bg-gradient-to-l from-[#020b16] to-transparent transition-opacity duration-200 sm:block ${
            layoutReady && canRight ? "opacity-90" : "opacity-0"
          }`}
        />
      </div>

      <button
        type="button"
        onClick={() => scrollByPage(1)}
        aria-label="Scroll industries right"
        disabled={!layoutReady || !canRight}
        className="interactive-press absolute -right-3 top-[calc(50%-0.75rem)] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#06141f]/90 text-white shadow-lg backdrop-blur transition hover:border-cyan-200/50 disabled:cursor-default disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 sm:flex lg:-right-5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {layoutReady && pageCount > 1 ? (
        <div className="mt-4 hidden items-center justify-center gap-2 sm:flex">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToPage(i)}
              aria-label={`Go to industry page ${i + 1}`}
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
  const [query, setQuery] = useState("");
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

  function goSearch(q: string, withConfirm = true) {
    const trimmed = q.trim();
    if (!trimmed) return;
    if (withConfirm) feedback("confirm");
    router.push(`/results?q=${encodeURIComponent(trimmed)}`);
  }

  function goBuilderSearch(builder: ProspectListBuilderState) {
    const state = builderToSearchState(builder);
    if (!state.query.trim()) return;
    router.push(`/results?${searchStateToParams(state).toString()}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    goSearch(query);
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
      <h1 className="text-balance text-[2.6rem] font-bold leading-[1.02] tracking-[-0.03em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.72)] sm:text-6xl lg:text-[4.25rem]">
        Find your next best opportunity.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-white/80 drop-shadow-[0_1px_10px_rgba(0,0,0,0.5)] sm:text-lg">
        AI-powered prospecting that helps you identify, understand, and engage
        the right organizations.
      </p>

      {/* Primary entry point: guided industry selector */}
      <section
        id="start"
        aria-labelledby="industry-selector-heading"
        className="mx-auto mt-10 max-w-5xl scroll-mt-20 sm:mt-12"
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
          Start with an industry
        </h2>
        <p className="mx-auto mt-1.5 max-w-xl text-balance text-sm text-white/70 drop-shadow-[0_1px_10px_rgba(0,0,0,0.5)]">
          Choose a market and Scout will guide the rest.
        </p>

        <IndustryCarousel selectedId={selectedIndustryId} onPick={pickIndustry} />
      </section>

      {/* Secondary entry point: free-text search */}
      <section className="mx-auto mt-11 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
          Or search directly
        </p>
        <form onSubmit={handleSubmit} className="mx-auto mt-3">
          <div className="interactive-press flex items-center gap-2 rounded-2xl border border-white/15 bg-[#06141f]/75 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur-md focus-within:border-cyan-300/60 focus-within:ring-2 focus-within:ring-cyan-300/25">
            <span className="pl-3 text-white/45" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by organization, industry, or keyword…"
              className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base text-white placeholder:text-white/45 outline-none sm:py-3"
              aria-label="Search organizations"
            />
            <button
              type="submit"
              className="interactive-press shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(37,99,235,0.38)] transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 sm:px-7"
            >
              Search
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          <span className="text-sm text-white/60">Try an example:</span>
          {HOME_EXAMPLES.map((ex) => (
            <button
              key={ex.query}
              type="button"
              onClick={() => {
                feedback("select");
                goSearch(ex.query, false);
              }}
              className="interactive-press rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-sm font-medium text-white/85 transition hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-white/10 motion-reduce:hover:translate-y-0"
            >
              {ex.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
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
