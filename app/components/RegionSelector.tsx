"use client";

import { ANY_REGION, regions } from "@/lib/search/regions";

interface RegionSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RegionSelector({ value, onChange }: RegionSelectorProps) {
  return (
    <div>
      <label htmlFor="region-select" className="label-mono">
        Where to look
      </label>
      <div className="relative mt-2">
        <select
          id="region-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 pr-10 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
        >
          <option value={ANY_REGION}>Anywhere</option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
