"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  builderToSearchState,
  type ProspectListBuilderState,
} from "@/lib/search/prospectListBuilder";
import { EXAMPLE_SEARCHES, searchStateToParams } from "@/lib/search/searchState";
import { ProspectListBuilder } from "./ProspectListBuilder";
import { ScoutLogo } from "./ScoutLogo";

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
    const params = searchStateToParams(state);
    router.push(`/results?${params.toString()}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    goSearch(query);
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
      <ScoutLogo
        size={72}
        priority
        className="mx-auto shadow-[0_1px_3px_rgba(0,0,0,0.2)] ring-1 ring-white/10"
      />
      <h1 className="font-display mt-3 text-balance text-[2rem] font-normal leading-[1.05] tracking-[-0.03em] text-foreground sm:mt-4 sm:text-[2.75rem] lg:text-[3.25rem]">
        Prospect Scout
      </h1>
      <p className="mx-auto mt-2 max-w-xl text-[1.0625rem] leading-relaxed text-muted sm:mt-3">
        Search organizations.{" "}
        <span className="text-muted/90">Find the signal.</span>
      </p>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-2">
        Discover companies, institutions, and operators across industries using
        public data, market activity, and organizational signals.
      </p>

      <form onSubmit={handleSubmit} className="relative mx-auto mt-7 max-w-2xl sm:mt-8">
        <div className="flex overflow-hidden rounded-xl border border-border/80 bg-surface/60 shadow-[0_1px_3px_rgba(0,0,0,0.14)] transition-[border-color,box-shadow] duration-200 focus-within:border-border-strong focus-within:shadow-[0_2px_4px_rgba(0,0,0,0.16)]">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, organizations, industries, or locations..."
            className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-[1rem] text-foreground placeholder:text-muted-2 outline-none sm:px-5 sm:py-4 sm:text-[1.0625rem]"
            aria-label="Search organizations"
          />
          <button
            type="submit"
            className="shrink-0 border-l border-border/60 bg-surface/80 px-5 py-3.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-surface sm:px-6 sm:py-4"
          >
            Search
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => setBuilderOpen((v) => !v)}
        aria-expanded={builderOpen}
        className={`mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-[background-color,border-color] duration-200 ${
          builderOpen
            ? "border-accent-cyan/45 bg-accent-soft/20 text-foreground"
            : "border-border/70 bg-surface/40 text-muted hover:border-border-strong hover:bg-surface/70 hover:text-foreground"
        }`}
      >
        {builderOpen ? "Hide prospect builder" : "Build Prospect List"}
      </button>

      <ProspectListBuilder open={builderOpen} onSubmit={goBuilderSearch} />

      <div className="mt-6 sm:mt-8">
        <p className="label-mono text-muted-2">Try an example</p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {EXAMPLE_SEARCHES.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => goSearch(example)}
                className="rounded-full border border-border/70 bg-surface/50 px-3.5 py-1.5 text-left text-xs text-muted transition-[background-color,border-color] duration-200 hover:border-border-strong hover:bg-surface/80 hover:text-foreground"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
