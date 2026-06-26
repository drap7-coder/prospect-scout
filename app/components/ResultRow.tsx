"use client";

import type { Prospect, SizeTier } from "@/lib/search/types";
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
import {
  industryLabel,
  organizationTypeLabel,
  sectorLabel,
} from "@/lib/taxonomy";

const SIZE_LABELS: Record<SizeTier, string> = {
  small: "Small",
  mid: "Mid-Market",
  large: "Large",
  enterprise: "Enterprise",
};

function prospectCategory(prospect: Prospect): string {
  if (prospect.industryId) return industryLabel(prospect.industryId);
  if (prospect.sectorId) return sectorLabel(prospect.sectorId);
  return prospect.buyerType;
}

function prospectTypeLabel(prospect: Prospect): string | null {
  if (prospect.organizationTypeId) {
    const label = organizationTypeLabel(prospect.organizationTypeId);
    if (label && label !== prospectCategory(prospect)) return label;
  }
  return null;
}

function MetaChip({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border border-border/70 bg-surface-2/80 px-1.5 py-0.5 font-mono text-[0.625rem] text-muted ${className}`}
    >
      {children}
    </span>
  );
}

function SourceBadge({ src }: { src: string }) {
  const st = sourceTone(src);
  return (
    <span
      className={`inline-flex items-center rounded border px-1 py-0.5 font-mono text-[0.5rem] uppercase tracking-wide ${st.bg} ${st.border} ${st.text}`}
    >
      {src === "Public Web" ? "Web" : src}
    </span>
  );
}

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
  const category = prospectCategory(prospect);
  const typeLabel = prospectTypeLabel(prospect);
  const summary =
    prospect.signals.length > 0
      ? prospect.whyNow
      : (prospect.whyItMatters[0] ?? prospect.whyNow);

  const cardSurface = selected
    ? "border-accent-cyan/45 border-l-[3px] border-l-accent-cyan bg-surface/70 shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
    : "border-border/70 bg-surface/50 shadow-[0_1px_2px_rgba(0,0,0,0.14)] hover:border-border-strong hover:bg-surface/75 hover:shadow-[0_2px_4px_rgba(0,0,0,0.16)] active:border-border-strong active:bg-surface/85";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group w-full cursor-pointer touch-manipulation rounded-lg border px-3.5 py-3.5 text-left outline-none transition-[background-color,border-color,box-shadow] duration-200 ease-out sm:px-4 sm:py-4 ${cardSurface}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="mt-1 font-mono text-[0.625rem] tabular-nums text-muted-2">
          {String(rank).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[0.9375rem] font-semibold leading-snug text-foreground sm:text-base">
              {prospect.name}
            </h3>
            <span
              className={`inline-flex shrink-0 items-center justify-center rounded-md border px-2 py-1 font-mono text-sm font-semibold tabular-nums leading-none sm:text-base ${tone.bg} ${tone.border} ${tone.text}`}
            >
              {prospect.score}
            </span>
          </div>

          {/* Primary metadata line */}
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {[category, typeLabel, prospect.location].filter(Boolean).join(" · ")}
          </p>

          {/* Secondary metadata chips */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {prospect.size ? (
              <MetaChip>{SIZE_LABELS[prospect.size]}</MetaChip>
            ) : null}
            {prospect.publicCompany === true ? (
              <MetaChip>Public</MetaChip>
            ) : prospect.publicCompany === false ? (
              <MetaChip>Private</MetaChip>
            ) : null}
            {prospect.stateCode ? (
              <MetaChip>{prospect.stateCode}</MetaChip>
            ) : null}
            {prospect.region && prospect.region !== "any" ? (
              <MetaChip className="capitalize">{prospect.region.replace(/-/g, " ")}</MetaChip>
            ) : null}
            {prospect.directoryMatch ? <MetaChip>Directory</MetaChip> : null}
            {prospect.signals.length > 0 ? (
              <MetaChip>
                {prospect.signals.length} signal
                {prospect.signals.length === 1 ? "" : "s"}
              </MetaChip>
            ) : null}
          </div>
        </div>
      </div>

      {/* Signals */}
      {signals.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 pl-7 sm:pl-8">
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
      ) : null}

      {/* Summary */}
      <p className="mt-3 line-clamp-2 pl-7 text-xs leading-relaxed text-muted/95 sm:pl-8">
        {summary}
      </p>

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border/50 pt-3 pl-7 sm:pl-8">
        <span
          className={`font-mono text-[0.6875rem] tabular-nums ${freshnessTone(freshness)}`}
        >
          {formatFreshness(freshness)}
        </span>
        <span className="text-muted-2/80">·</span>
        <span className="font-mono text-[0.6875rem] text-muted">
          {evidence} evidence source{evidence === 1 ? "" : "s"}
        </span>
        {sources.length > 0 ? (
          <>
            <span className="hidden text-muted-2/80 sm:inline">·</span>
            <div className="flex flex-wrap gap-1">
              {sources.map((src) => (
                <SourceBadge key={src} src={src} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </button>
  );
}
