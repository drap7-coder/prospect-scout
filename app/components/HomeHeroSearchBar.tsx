"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { homeQueryToResultsUrl } from "@/lib/search/homeSearchEntry";
import { useInteractionFeedback } from "./InteractionProvider";

export function HomeHeroSearchBar({
  placeholder = "Search companies, health plans, PBMs, universities, manufacturers…",
}: {
  placeholder?: string;
}) {
  const router = useRouter();
  const { feedback } = useInteractionFeedback();
  const [draft, setDraft] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    feedback("select");
    router.push(homeQueryToResultsUrl(trimmed));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-8 w-full max-w-2xl px-1 sm:mt-9"
      role="search"
      aria-label="Search prospects"
    >
      <div className="flex overflow-hidden rounded-2xl border border-white/20 bg-[#06141f]/90 shadow-[0_16px_48px_rgba(0,0,0,0.38)] backdrop-blur-md transition focus-within:border-cyan-200/50 focus-within:ring-2 focus-within:ring-cyan-300/20">
        <span
          className="flex shrink-0 items-center pl-4 text-white/50"
          aria-hidden
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-3 py-4 text-base text-white placeholder:text-white/45 outline-none sm:py-[1.125rem]"
          aria-label="Search for prospects"
        />
        <button
          type="submit"
          className="interactive-press shrink-0 bg-cyan-400 px-5 py-4 text-sm font-semibold text-[#041018] transition hover:bg-cyan-300 sm:px-6"
        >
          Search
        </button>
      </div>
    </form>
  );
}
