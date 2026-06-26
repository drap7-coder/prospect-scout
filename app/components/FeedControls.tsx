"use client";

import type { SignalSource, SignalType } from "@/lib/search/types";
import { regionLabel } from "@/lib/search/regions";
import { sourceTone } from "@/lib/intelligence/colors";
import type { FeedFilters, SortKey } from "@/lib/intelligence/feed";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "freshness", label: "Freshness" },
  { key: "evidence", label: "Evidence" },
  { key: "changed", label: "Changed" },
];

const SIGNAL_TYPES: SignalType[] = [
  "regulatory",
  "leadership",
  "financial",
  "operational",
  "demand",
  "growth",
  "procurement",
];

const SOURCES: SignalSource[] = [
  "CMS",
  "SEC",
  "FDA",
  "RSS",
  "Public Web",
];

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  const active = value !== "all";
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="label-mono px-0.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full min-w-[7rem] rounded-lg border px-2.5 py-2 font-mono text-xs outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 ${
          active
            ? "border-accent/40 bg-accent-soft/40 text-foreground"
            : "border-border bg-surface-2 text-foreground"
        }`}
      >
        {children}
      </select>
    </label>
  );
}

export function FeedControls({
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  buyerTypes,
  regions,
  total,
  shown,
}: {
  sort: SortKey;
  onSortChange: (key: SortKey) => void;
  filters: FeedFilters;
  onFiltersChange: (filters: FeedFilters) => void;
  buyerTypes: string[];
  regions: string[];
  total: number;
  shown: number;
}) {
  const activeFilterCount = [
    filters.buyerType !== "all",
    filters.region !== "all",
    filters.signalType !== "all",
    filters.source !== "all",
    filters.freshness !== "all",
  ].filter(Boolean).length;

  return (
    <div className="shrink-0 border-b border-border/80 bg-surface-2/40 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Intelligence feed
          </h2>
          <p className="mt-1 font-mono text-xs text-muted">
            <span className="text-accent-cyan">{shown}</span>
            <span className="text-muted-2"> / {total} opportunities</span>
            {activeFilterCount > 0 ? (
              <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[0.625rem] text-accent">
                {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-mono mr-1 hidden sm:inline">Sort</span>
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => onSortChange(o.key)}
              className={`rounded-lg border px-2.5 py-1.5 font-mono text-[0.6875rem] transition ${
                sort === o.key
                  ? "border-accent/50 bg-accent text-white"
                  : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <FilterSelect
          label="Buyer"
          value={filters.buyerType}
          onChange={(v) => onFiltersChange({ ...filters, buyerType: v })}
        >
          <option value="all">All types</option>
          {buyerTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Region"
          value={filters.region}
          onChange={(v) => onFiltersChange({ ...filters, region: v })}
        >
          <option value="all">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {regionLabel(r)}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Signal"
          value={filters.signalType}
          onChange={(v) =>
            onFiltersChange({
              ...filters,
              signalType: v as FeedFilters["signalType"],
            })
          }
        >
          <option value="all">All signals</option>
          {SIGNAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Source"
          value={filters.source}
          onChange={(v) =>
            onFiltersChange({
              ...filters,
              source: v as FeedFilters["source"],
            })
          }
        >
          <option value="all">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Freshness"
          value={filters.freshness}
          onChange={(v) =>
            onFiltersChange({
              ...filters,
              freshness: v as FeedFilters["freshness"],
            })
          }
        >
          <option value="all">Any time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </FilterSelect>
      </div>

      {filters.source !== "all" ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SOURCES.map((s) => {
            const st = sourceTone(s);
            const active = filters.source === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    source: active ? "all" : s,
                  })
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.625rem] transition ${
                  active
                    ? `${st.bg} ${st.border} ${st.text} ring-2 ${st.ring}`
                    : "border-border bg-surface text-muted-2 hover:text-muted"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                {s}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
