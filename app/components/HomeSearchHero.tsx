"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  builderToSearchState,
  type ProspectListBuilderState,
} from "@/lib/search/prospectListBuilder";
import { searchStateToParams } from "@/lib/search/searchState";
import { ProspectListBuilder } from "./ProspectListBuilder";
import { useInteractionFeedback } from "./InteractionProvider";

const HOME_EXAMPLES = [
  {
    emoji: "🏥",
    label: "Health plans in Texas",
    query: "Health plans in Texas",
  },
  {
    emoji: "🏨",
    label: "Hospitals near Philadelphia",
    query: "Hospitals near Philadelphia",
  },
  {
    emoji: "🏭",
    label: "Manufacturers in Ohio",
    query: "Manufacturers in Ohio",
  },
  {
    emoji: "🎓",
    label: "Universities in California",
    query: "Universities in California",
  },
  {
    emoji: "🤝",
    label: "Nonprofits in Pennsylvania",
    query: "Nonprofits in Pennsylvania",
  },
  {
    emoji: "📈",
    label: "Public companies with SEC filings",
    query: "Public companies with SEC filings",
  },
  {
    emoji: "🏦",
    label: "Banks in Texas",
    query: "Banks in Texas",
  },
] as const;

export function HomeSearchHero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
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

  return (
    <div className="mx-auto w-full max-w-5xl text-center">
      <p className="mx-auto mb-4 inline-flex rounded-full border border-cyan-200/20 bg-cyan-100/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/90 shadow-[0_10px_34px_rgba(34,211,238,0.08)] backdrop-blur">
        Opportunity intelligence
      </p>
      <h1 className="font-display text-[3rem] font-normal leading-[0.95] tracking-[-0.04em] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.5)] sm:text-[4.4rem] lg:text-[5.6rem]">
        Prospect Scout
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-balance text-lg leading-relaxed text-white/84 sm:text-xl">
        Find the right organizations. Surface real opportunities.
      </p>

      <form onSubmit={handleSubmit} className="mx-auto mt-7 max-w-3xl sm:mt-8">
        <div className="interactive-press flex overflow-hidden rounded-full border border-white/45 bg-white/96 shadow-[0_20px_70px_rgba(0,0,0,0.32)] backdrop-blur-md focus-within:border-cyan-200 focus-within:ring-4 focus-within:ring-cyan-300/30">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, organizations, industries, or locations…"
            className="min-w-0 flex-1 bg-transparent px-5 py-4 text-base text-slate-950 placeholder:text-slate-500 outline-none sm:px-7 sm:py-5"
            aria-label="Search organizations"
          />
          <button
            type="submit"
            className="interactive-press m-1.5 shrink-0 rounded-full bg-[#087f86] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_26px_rgba(8,127,134,0.38)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 sm:px-8"
          >
            Search
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => {
          feedback(builderOpen ? "tap" : "select");
          setBuilderOpen((v) => !v);
        }}
        aria-expanded={builderOpen}
        className={`interactive-press mt-5 inline-flex min-h-[3rem] items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold backdrop-blur ${
          builderOpen
            ? "card-selected"
            : "border-white/22 bg-white/8 text-white shadow-[0_10px_36px_rgba(0,0,0,0.18)] hover:border-white/40 hover:bg-white/12"
        }`}
      >
        {builderOpen ? "Close builder" : "Build a Prospect List"}
      </button>

      <ProspectListBuilder open={builderOpen} onSubmit={goBuilderSearch} />

      <div className="mx-auto mt-8 max-w-5xl text-left sm:mt-9">
        <p className="text-center text-sm font-medium text-white/78">
          Try an example search
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2.5">
          {HOME_EXAMPLES.map((ex) => (
            <li key={ex.query}>
              <button
                type="button"
                onClick={() => {
                  feedback("select");
                  goSearch(ex.query, false);
                }}
                className="interactive-press flex min-h-[3rem] items-center gap-2.5 rounded-full border border-white/18 bg-[#041523]/58 px-4 py-2.5 text-left shadow-[0_8px_26px_rgba(0,0,0,0.18)] backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-white/10 motion-reduce:hover:translate-y-0 sm:px-5"
              >
                <span className="text-lg" aria-hidden>
                  {ex.emoji}
                </span>
                <span className="text-sm font-medium text-white">
                  {ex.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto mt-9 hidden max-w-5xl gap-3 text-left text-white/78 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {[
          "Comprehensive data from trusted sources",
          "Real-time signals and intelligence",
          "Advanced search and filtering",
          "Build lists and track opportunities",
        ].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-snug backdrop-blur"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
