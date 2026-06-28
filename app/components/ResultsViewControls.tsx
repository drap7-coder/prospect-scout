"use client";

import {
  RESULTS_VIEW_OPTIONS,
  type ResultsDisplayMode,
} from "@/lib/intelligence/resultsView";

export function ResultsViewControls({
  value,
  onChange,
}: {
  value: ResultsDisplayMode;
  onChange: (value: ResultsDisplayMode) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="label-mono shrink-0 text-muted-2">View</span>
      <div
        role="tablist"
        aria-label="Results view"
        className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5"
      >
        {RESULTS_VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={value === opt.id}
            onClick={() => onChange(opt.id)}
            className={`rounded-md px-2.5 py-1.5 font-mono text-[0.6875rem] transition sm:px-3 ${
              value === opt.id
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
