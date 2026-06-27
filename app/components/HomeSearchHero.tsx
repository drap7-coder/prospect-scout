"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  builderToSearchState,
  type ProspectListBuilderState,
} from "@/lib/search/prospectListBuilder";
import { searchStateToParams } from "@/lib/search/searchState";
import { ProspectListBuilder } from "./ProspectListBuilder";
import { ScoutLogo } from "./ScoutLogo";
import { useInteractionFeedback } from "./InteractionProvider";

const HOME_EXAMPLES = [
  {
    emoji: "🏥",
    label: "Health plans in PA",
    query: "Health plans in Pennsylvania",
  },
  {
    emoji: "🏭",
    label: "Manufacturers in Ohio",
    query: "Manufacturers in Ohio",
  },
  {
    emoji: "🩺",
    label: "Health systems in Texas",
    query: "Health systems in Texas",
  },
  {
    emoji: "🍱",
    label: "Food manufacturers in the Midwest",
    query: "Food and beverage manufacturers in the Midwest",
  },
  {
    emoji: "🏛",
    label: "Government agencies in California",
    query: "Government agencies in California",
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
    <div className="mx-auto w-full max-w-2xl text-center">
      <ScoutLogo
        size={72}
        priority
        className="mx-auto shadow-[0_1px_3px_rgba(28,34,43,0.08)] ring-1 ring-border"
      />
      <h1 className="font-display mt-3 text-[2rem] font-normal leading-tight tracking-[-0.03em] text-foreground sm:mt-4 sm:text-[2.5rem]">
        Prospect Scout
      </h1>
      <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-muted">
        Search organizations.
        <br />
        Find the signal.
      </p>

      <form onSubmit={handleSubmit} className="mx-auto mt-8 sm:mt-10">
        <div className="card-float interactive-press flex overflow-hidden rounded-[1.125rem] focus-within:border-accent-cyan/35 focus-within:ring-2 focus-within:ring-accent-cyan/20">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, organizations, industries, or locations…"
            className="min-w-0 flex-1 bg-transparent px-4 py-4 text-base text-foreground placeholder:text-muted-2 outline-none sm:px-5 sm:py-[1.125rem]"
            aria-label="Search organizations"
          />
          <button
            type="submit"
            className="interactive-press shrink-0 border-l border-border bg-surface-2 px-5 py-4 text-sm font-semibold text-foreground hover:bg-accent-soft/40 hover:text-accent-cyan sm:px-6"
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
        className={`interactive-press mt-5 inline-flex min-h-[3rem] items-center justify-center rounded-2xl border px-6 py-3 text-sm font-semibold ${
          builderOpen
            ? "card-selected"
            : "card-float interactive-choice text-foreground"
        }`}
      >
        {builderOpen ? "Close builder" : "Build a Prospect List"}
      </button>

      <ProspectListBuilder open={builderOpen} onSubmit={goBuilderSearch} />

      <div className="mt-8 text-left sm:mt-10">
        <p className="text-center text-sm font-medium text-muted">
          Example searches
        </p>
        <ul className="mt-3 grid gap-2">
          {HOME_EXAMPLES.map((ex) => (
            <li key={ex.query}>
              <button
                type="button"
                onClick={() => {
                  feedback("select");
                  goSearch(ex.query, false);
                }}
                className="card-float interactive-press interactive-choice flex w-full min-h-[3rem] items-center gap-3 rounded-2xl px-4 py-3 text-left sm:px-5"
              >
                <span className="text-lg" aria-hidden>
                  {ex.emoji}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {ex.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
