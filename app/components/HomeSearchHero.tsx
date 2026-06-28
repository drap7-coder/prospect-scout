"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  builderToSearchState,
  type ProspectListBuilderState,
} from "@/lib/search/prospectListBuilder";
import { searchStateToParams } from "@/lib/search/searchState";
import { IndustryCatalog } from "./IndustryCatalog";
import { ProspectListBuilder } from "./ProspectListBuilder";
import { useInteractionFeedback } from "./InteractionProvider";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function HomeSearchHero() {
  const router = useRouter();
  const [builderOpen, setBuilderOpen] = useState(false);
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

  function toggleManualBuilder() {
    if (builderOpen) {
      feedback("tap");
      setBuilderOpen(false);
      return;
    }
    feedback("select");
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
          Browse any industry — warehouse intelligence where curated, live discovery everywhere else.
        </p>
      </div>

      <section
        id="start"
        aria-labelledby="industry-catalog-heading"
        className="mx-auto mt-6 max-w-6xl scroll-mt-20 text-left sm:mt-7"
      >
        <IndustryCatalog variant="homepage" />

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
              <path
                d="M4 7h10M18 7h2M4 17h2M10 17h10"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
              <circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="1.75" />
              <circle cx="8" cy="17" r="2" stroke="currentColor" strokeWidth="1.75" />
            </svg>
            {builderOpen ? "Close builder" : "Build a custom list"}
          </button>
        </div>
      </section>

      <div ref={builderRef} className="scroll-mt-20">
        <ProspectListBuilder
          key={builderCardId ?? "manual"}
          open={builderOpen}
          onSubmit={goBuilderSearch}
          initialState={builderSeed}
          initialCategoryId={builderCardId}
        />
      </div>
    </div>
  );
}
