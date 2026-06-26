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

const HOME_EXAMPLES = [
  { emoji: "🏭", label: "Manufacturers in Ohio", query: "Manufacturers in Ohio" },
  {
    emoji: "💻",
    label: "Software companies hiring",
    query: "Software companies hiring sales leaders",
  },
  {
    emoji: "🏛",
    label: "Government contractors",
    query: "Government contractors in Virginia",
  },
  {
    emoji: "🎓",
    label: "Universities doing AI research",
    query: "Universities with research activity",
  },
  {
    emoji: "🛍",
    label: "Retail chains expanding",
    query: "Retail chains expanding in Texas",
  },
] as const;

export function HomeSearchHero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);

  function goSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
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
        <div className="card-float flex overflow-hidden rounded-[1.125rem] focus-within:ring-2 focus-within:ring-accent-cyan/25">
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
            className="shrink-0 border-l border-border bg-surface-2 px-5 py-4 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-surface sm:px-6"
          >
            Search
          </button>
        </div>
      </form>

      <div className="mt-8 text-left sm:mt-10">
        <p className="text-center text-sm font-medium text-muted">
          Example searches
        </p>
        <ul className="mt-3 grid gap-2">
          {HOME_EXAMPLES.map((ex) => (
            <li key={ex.query}>
              <button
                type="button"
                onClick={() => goSearch(ex.query)}
                className="card-float flex w-full min-h-[3rem] items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:border-border-strong sm:px-5"
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

      <div className="mt-10 border-t border-border pt-8">
        <p className="text-sm font-medium text-muted">Need help?</p>
        <button
          type="button"
          onClick={() => setBuilderOpen((v) => !v)}
          aria-expanded={builderOpen}
          className={`mt-3 inline-flex min-h-[3rem] items-center justify-center rounded-2xl border px-6 py-3 text-sm font-semibold transition duration-200 ${
            builderOpen
              ? "card-selected text-foreground"
              : "card-float text-foreground hover:border-border-strong"
          }`}
        >
          {builderOpen ? "Close builder" : "Build a Prospect List"}
        </button>
      </div>

      <ProspectListBuilder open={builderOpen} onSubmit={goBuilderSearch} />
    </div>
  );
}
