"use client";

import { FormEvent, useEffect, useState } from "react";

export function ResultsSearchBar({
  value,
  onSubmit,
  compact = false,
}: {
  value: string;
  onSubmit: (query: string) => void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(draft.trim());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={compact ? "w-full max-w-xl" : "w-full"}
    >
      <div
        className={`flex overflow-hidden rounded-xl border border-border bg-surface/80 ${
          compact ? "text-sm" : ""
        }`}
      >
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search companies..."
          className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-foreground placeholder:text-muted-2 outline-none"
          aria-label="Search companies"
        />
        <button
          type="submit"
          className="shrink-0 bg-accent px-4 py-2.5 text-xs font-semibold text-white transition hover:brightness-110"
        >
          Search
        </button>
      </div>
    </form>
  );
}
