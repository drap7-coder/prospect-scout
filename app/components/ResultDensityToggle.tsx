"use client";

import type { ResultDensity } from "@/lib/intelligence/resultDensity";
import { DENSITY_OPTIONS } from "@/lib/intelligence/resultDensity";

export function ResultDensityToggle({
  value,
  onChange,
}: {
  value: ResultDensity;
  onChange: (value: ResultDensity) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-0.5">
      {DENSITY_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={`rounded-md px-2.5 py-1.5 font-mono text-[0.625rem] transition ${
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
