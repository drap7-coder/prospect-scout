"use client";

import type { ResultView } from "@/lib/discovery/discoveryRows";

const VIEW_OPTIONS: { id: ResultView; label: string }[] = [
  { id: "discovery", label: "Discovery" },
  { id: "list", label: "List" },
];

export function ResultViewToggle({
  value,
  onChange,
}: {
  value: ResultView;
  onChange: (value: ResultView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Results view"
      className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-0.5"
    >
      {VIEW_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`rounded-md px-3 py-1.5 font-mono text-[0.6875rem] transition ${
            value === opt.id
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
