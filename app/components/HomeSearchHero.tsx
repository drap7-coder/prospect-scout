"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { EXAMPLE_SEARCHES } from "@/lib/search/searchState";
import { ScoutLogo } from "./ScoutLogo";

export function HomeSearchHero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function goSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/results?q=${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    goSearch(query);
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
      <ScoutLogo
        size={88}
        priority
        className="mx-auto shadow-lg shadow-black/30 ring-1 ring-white/10"
      />
      <p className="label-mono mt-6 text-accent-cyan/90">
        Opportunity intelligence
      </p>
      <h1 className="font-display mt-5 text-balance text-[2.25rem] font-normal leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[3rem] lg:text-[3.5rem]">
        Search companies.
        <br />
        <span className="text-muted">Discover why they matter.</span>
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-muted">
        Find organizations by industry, type, location, and public signals — then
        see the evidence behind each opportunity.
      </p>

      <form onSubmit={handleSubmit} className="relative mx-auto mt-10 max-w-2xl">
        <div className="flex overflow-hidden rounded-2xl border border-border-strong bg-surface/90 shadow-2xl shadow-black/40 ring-1 ring-white/5 backdrop-blur-md focus-within:border-accent/50 focus-within:ring-accent/20">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search health plans, manufacturers, hospitals, employers..."
            className="min-w-0 flex-1 bg-transparent px-5 py-4 text-[1.0625rem] text-foreground placeholder:text-muted-2 outline-none"
            aria-label="Search companies"
          />
          <button
            type="submit"
            className="shrink-0 bg-accent px-6 py-4 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Search
          </button>
        </div>
      </form>

      <div className="mt-8">
        <p className="label-mono text-muted-2">Try an example</p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {EXAMPLE_SEARCHES.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => goSearch(example)}
                className="rounded-full border border-border bg-surface/60 px-3.5 py-1.5 text-left text-xs text-muted transition hover:border-accent/40 hover:bg-accent-soft/30 hover:text-foreground"
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
