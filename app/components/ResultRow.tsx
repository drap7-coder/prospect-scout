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
      className={`group w-full px-4 py-3.5 text-left transition lg:grid lg:grid-cols-[minmax(0,1.2fr)_5rem_minmax(0,1fr)_4.5rem_5rem] lg:items-center lg:gap-3 lg:py-3 ${
        selected
          ? "bg-accent-soft/25 ring-1 ring-inset ring-accent-cyan/20"
          : "hover:bg-surface/50"
      }`}
    >
      {/* Organization */}
      <div className="min-w-0">
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
        <p className="mt-1 line-clamp-1 pl-6 text-xs leading-snug text-muted/90 max-lg:hidden">
          {prospect.whyNow}
        </p>
        <p className="mt-1.5 line-clamp-1 pl-6 text-sm leading-snug text-muted lg:hidden">
          {prospect.whyNow}
        </p>
        <div className="mt-2 flex flex-wrap gap-1 pl-6 lg:hidden">
          {sources.map((src) => {
            const st = sourceTone(src);
            return (
              <span
                key={src}
                className={`rounded border px-1.5 py-0.5 font-mono text-[0.5625rem] ${st.bg} ${st.border} ${st.text}`}
              >
                {src === "Public Web" ? "Web" : src}
              </span>
            );
          })}
        </div>
      </div>

      {/* Score */}
      <div className="mt-2 flex items-center gap-3 lg:mt-0 lg:justify-center">
        <span className="label-mono text-muted-2 lg:hidden">Score</span>
        <span
          className={`inline-flex min-w-[2.75rem] justify-center rounded-lg border px-2 py-1 font-mono text-lg font-bold tabular-nums ${tone.bg} ${tone.border} ${tone.text}`}
        >
          {prospect.score}
        </span>
      </div>

      {/* Signals */}
      <div className="mt-2 hidden flex-wrap gap-1 lg:flex">
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

      <p className="mt-1 font-mono text-[0.6875rem] text-muted lg:mt-0 lg:text-right">
        <span className="label-mono mr-2 lg:hidden">Evidence</span>
        {evidence}
      </p>

      {/* Freshness + sources desktop */}
      <div className="mt-1 lg:mt-0 lg:text-right">
        <p
          className={`font-mono text-[0.6875rem] tabular-nums ${freshnessTone(freshness)}`}
        >
          <span className="label-mono mr-2 lg:hidden">Fresh</span>
          {formatFreshness(freshness)}
        </p>
        <div className="mt-1 hidden flex-wrap justify-end gap-0.5 lg:flex">
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
