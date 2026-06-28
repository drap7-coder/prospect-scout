"use client";

import { FormEvent, useEffect, useState } from "react";

export function ResultsSearchBar({
  value,
  onSubmit,
  compact = false,
  persistent = false,
}: {
  value: string;
  onSubmit: (query: string) => void;
  /** @deprecated Use persistent full-width layout instead. */
  compact?: boolean;
  /** Full-width enterprise search band styling. */
  persistent?: boolean;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(draft.trim());
  }

  const isEnterprise = persistent || !compact;

  return (
    <form
      onSubmit={handleSubmit}
      className={isEnterprise ? "w-full" : "w-full max-w-xl"}
    >
      <div
        className={`flex overflow-hidden rounded-xl border bg-surface shadow-sm transition focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/15 ${
          persistent
            ? "border-border text-base"
            : "border-border bg-surface/80 text-sm"
        }`}
      >
        <span
          className="flex shrink-0 items-center pl-4 text-muted-2"
          aria-hidden
        >
          <svg
            width="18"
            height="18"
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
          placeholder="Search organizations, markets, and signals..."
          className={`min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted-2 outline-none ${
            persistent ? "px-3 py-3.5" : "px-4 py-2.5"
          }`}
          aria-label="Search organizations"
        />
        <button
          type="submit"
          className={`shrink-0 bg-accent font-semibold text-white transition hover:brightness-110 ${
            persistent ? "px-5 py-3.5 text-sm" : "px-4 py-2.5 text-xs"
          }`}
        >
          Search
        </button>
      </div>
    </form>
  );
}
