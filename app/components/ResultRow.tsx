"use client";

import type { Prospect } from "@/lib/search/types";
import {
  freshnessTone,
  scoreTone,
  sourceTone,
} from "@/lib/intelligence/colors";
import {
  activeSources,
  evidenceSourceCount,
  formatFreshness,
  prospectFreshness,
  topSignals,
} from "@/lib/intelligence/evidence";

export function ResultRow({
  prospect,
  rank,
  selected,
  onSelect,
}: {
  prospect: Prospect;
  rank: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const signals = topSignals(prospect, 3);
  const freshness = prospectFreshness(prospect);
  const sources = activeSources(prospect);
  const tone = scoreTone(prospect.score);
  const evidence = evidenceSourceCount(prospect);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full px-3 py-3 text-left transition sm:px-4 sm:py-3.5 lg:grid lg:grid-cols-[minmax(0,1.2fr)_5rem_minmax(0,1fr)_4.5rem_5rem] lg:items-center lg:gap-3 lg:py-3 ${
        selected
          ? "bg-accent-soft/25 ring-1 ring-inset ring-accent-cyan/20"
          : "hover:bg-surface/50"
      }`}
    >
      {/* Mobile / tablet compact card */}
      <div className="min-w-0 lg:hidden">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 font-mono text-[0.625rem] tabular-nums text-muted-2">
            {String(rank).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[0.9375rem] font-semibold leading-snug text-foreground">
              {prospect.name}
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted">
              {prospect.location} · {prospect.buyerType}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center justify-center rounded-lg border px-2 py-1 font-mono text-base font-bold tabular-nums leading-none ${tone.bg} ${tone.border} ${tone.text}`}
          >
            {prospect.score}
          </span>
        </div>

        {signals.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1 pl-6">
            {signals.slice(0, 2).map((s) => {
              const st = sourceTone(s.source);
              return (
                <span
                  key={s.id}
                  className={`inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 font-mono text-[0.625rem] ${st.bg} ${st.border} ${st.text}`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
                  {s.label}
                </span>
              );
            })}
          </div>
        ) : null}

        <p className="mt-2 line-clamp-2 pl-6 text-xs leading-relaxed text-muted/90">
          {prospect.whyNow}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-6">
          <span
            className={`font-mono text-[0.6875rem] tabular-nums ${freshnessTone(freshness)}`}
          >
            {formatFreshness(freshness)}
          </span>
          <span className="text-muted-2">·</span>
          <span className="font-mono text-[0.6875rem] text-muted">
            {evidence} source{evidence === 1 ? "" : "s"}
          </span>
          {sources.length > 0 ? (
            <>
              <span className="text-muted-2">·</span>
              <div className="flex flex-wrap gap-1">
                {sources.slice(0, 4).map((src) => {
                  const st = sourceTone(src);
                  return (
                    <span
                      key={src}
                      className={`rounded border px-1 py-0.5 font-mono text-[0.5rem] uppercase ${st.bg} ${st.border} ${st.text}`}
                    >
                      {src === "Public Web" ? "Web" : src}
                    </span>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Desktop table row */}
      <div className="hidden min-w-0 lg:block">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[0.625rem] tabular-nums text-muted-2">
            {String(rank).padStart(2, "0")}
          </span>
          <h3 className="truncate text-[0.975rem] font-semibold text-foreground">
            {prospect.name}
          </h3>
        </div>
        <p className="mt-0.5 truncate pl-6 text-xs text-muted">
          {prospect.location} · {prospect.buyerType}
        </p>
        <p className="mt-1 line-clamp-1 pl-6 text-xs leading-snug text-muted/90">
          {prospect.whyNow}
        </p>
      </div>

      <div className="hidden lg:flex lg:justify-center">
        <span
          className={`inline-flex min-w-[2.75rem] justify-center rounded-lg border px-2 py-1 font-mono text-lg font-bold tabular-nums ${tone.bg} ${tone.border} ${tone.text}`}
        >
          {prospect.score}
        </span>
      </div>

      <div className="hidden flex-wrap gap-1 lg:flex">
        {signals.map((s) => {
          const st = sourceTone(s.source);
          return (
            <span
              key={s.id}
              className={`inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 font-mono text-[0.625rem] ${st.bg} ${st.border} ${st.text}`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
              {s.label}
            </span>
          );
        })}
      </div>

      <p className="hidden font-mono text-[0.6875rem] text-muted lg:block lg:text-right">
        {evidence}
      </p>

      <div className="hidden lg:block lg:text-right">
        <p
          className={`font-mono text-[0.6875rem] tabular-nums ${freshnessTone(freshness)}`}
        >
          {formatFreshness(freshness)}
        </p>
        <div className="mt-1 flex flex-wrap justify-end gap-0.5">
          {sources.map((src) => {
            const st = sourceTone(src);
            return (
              <span
                key={src}
                className={`rounded border px-1 py-0.5 font-mono text-[0.5rem] uppercase ${st.bg} ${st.border} ${st.text}`}
              >
                {src === "Public Web" ? "Web" : src}
              </span>
            );
          })}
        </div>
      </div>
    </button>
  );
}
