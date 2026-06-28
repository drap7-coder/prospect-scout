"use client";

import type { BrowseLensId } from "@/lib/browse/types";
import type { BrowseLensDefinition } from "@/lib/browse/types";

export function BrowseLensSelector({
  lenses,
  value,
  onChange,
}: {
  lenses: BrowseLensDefinition[];
  value: BrowseLensId;
  onChange: (lens: BrowseLensId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Browse mode"
      className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface-2 p-0.5"
    >
      {lenses.map((lens) => (
        <button
          key={lens.id}
          type="button"
          role="tab"
          aria-selected={value === lens.id}
          title={lens.description}
          onClick={() => onChange(lens.id)}
          className={`rounded-md px-2.5 py-1.5 font-mono text-[0.6875rem] transition sm:px-3 ${
            value === lens.id
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {lens.label}
        </button>
      ))}
    </div>
  );
}
