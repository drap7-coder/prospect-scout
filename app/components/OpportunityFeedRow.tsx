"use client";

import type { Prospect } from "@/lib/search/types";
import {
  freshnessTone,
  scoreTone,
  sourceTone,
} from "@/lib/intelligence/colors";
import {
  activeSources,
  formatFreshness,
  prospectFreshness,
  topSignals,
} from "@/lib/intelligence/evidence";

export function FeedColumnHeader() {
  return (
    <div
      className="hidden border-b border-border/80 bg-surface-2/60 px-4 py-2 lg:grid lg:grid-cols-[4.5rem_minmax(0,1.4fr)_minmax(0,1fr)_7.5rem_5.5rem_6.5rem] lg:items-center lg:gap-3"
      aria-hidden
    >
      <span className="label-mono text-center">Score</span>
      <span className="label-mono">Organization</span>
      <span className="label-mono">Signals</span>
      <span className="label-mono">Buyer</span>
      <span className="label-mono text-right">Fresh</span>
      <span className="label-mono text-right">Sources</span>
    </div>
  );
}

export function OpportunityFeedRow({
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

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full border-b border-border/50 px-4 py-3.5 text-left transition last:border-b-0 lg:grid lg:grid-cols-[4.5rem_minmax(0,1.4fr)_minmax(0,1fr)_7.5rem_5.5rem_6.5rem] lg:items-center lg:gap-3 lg:py-3 ${
        selected
          ? "bg-accent-soft/30 ring-1 ring-inset ring-accent-cyan/25"
          : "bg-transparent hover:bg-surface/60"
      }`}
    >
      {selected ? (
        <span
          className="absolute inset-y-0 left-0 w-0.5 bg-accent-cyan"
          aria-hidden
        />
      ) : null}

      {/* Score */}
      <div className="flex items-center gap-3 lg:block lg:text-center">
        <span className="label-mono w-5 shrink-0 text-[10px] text-muted-2 lg:hidden">
          {String(rank).padStart(2, "0")}
        </span>
        <div
          className={`inline-flex min-w-[3.25rem] flex-col items-center rounded-lg border px-2 py-1.5 ${tone.bg} ${tone.border}`}
        >
          <span
            className={`font-mono text-xl font-bold tabular-nums leading-none ${tone.text}`}
          >
            {prospect.score}
          </span>
          <span className={`mt-0.5 font-mono text-[9px] uppercase ${tone.text}`}>
            {tone.label}
          </span>
        </div>
      </div>

      {/* Organization + why now */}
      <div className="mt-2 min-w-0 lg:mt-0">
        <div className="flex items-baseline gap-2">
          <span className="label-mono hidden w-5 shrink-0 text-[10px] text-muted-2 lg:inline">
            {String(rank).padStart(2, "0")}
          </span>
          <h3 className="truncate text-[0.975rem] font-semibold leading-snug tracking-tight text-foreground">
            {prospect.name}
          </h3>
        </div>
        <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-muted lg:line-clamp-1 lg:pl-7">
          {prospect.whyNow}
        </p>
      </div>

      {/* Signals — mobile inline; desktop column */}
      <div className="mt-2 flex flex-wrap gap-1 lg:mt-0">
        {signals.map((s) => {
          const st = sourceTone(s.source);
          return (
            <span
              key={s.id}
              className={`inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${st.bg} ${st.border} ${st.text}`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
              <span className="truncate">{s.label}</span>
            </span>
          );
        })}
      </div>

      {/* Buyer type */}
      <p className="mt-2 truncate font-mono text-[11px] text-foreground/90 lg:mt-0">
        {prospect.buyerType}
      </p>

      {/* Freshness */}
      <p
        className={`mt-1 font-mono text-[11px] tabular-nums lg:mt-0 lg:text-right ${freshnessTone(freshness)}`}
      >
        {formatFreshness(freshness)}
      </p>

      {/* Source badges */}
      <div className="mt-2 flex flex-wrap justify-start gap-1 lg:mt-0 lg:justify-end">
        {sources.map((src) => {
          const st = sourceTone(src);
          return (
            <span
              key={src}
              className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide ${st.bg} ${st.border} ${st.text}`}
            >
              {src === "Public Web" ? "Web" : src}
            </span>
          );
        })}
      </div>
    </button>
  );
}
