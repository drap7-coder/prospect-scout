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
import { useInteractionFeedback } from "./InteractionProvider";

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
      className={`inline-flex items-center rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.625rem] text-muted ${className}`}
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
  const whyItMatters =
    prospect.signals.length > 0
      ? prospect.whyNow
      : (prospect.whyItMatters[0] ?? prospect.whyNow);

  const { feedback } = useInteractionFeedback();

  const cardSurface = selected
    ? "border-accent-cyan/45 border-l-[3px] border-l-accent-cyan bg-surface shadow-[var(--shadow-card)]"
    : "interactive-press interactive-choice border-border bg-surface shadow-[var(--shadow-card)]";

  return (
    <button
      type="button"
      onClick={() => {
        feedback(selected ? "tap" : "select");
        onSelect();
      }}
      aria-pressed={selected}
      className={`group w-full cursor-pointer rounded-2xl border px-4 py-4 text-left outline-none transition duration-200 ease-out sm:px-5 sm:py-5 ${cardSurface} ${selected ? "card-selected" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-[0.625rem] tabular-nums text-muted-2">
          {String(rank).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold leading-snug text-foreground">
              {prospect.name}
            </h3>
            <span
              className={`inline-flex shrink-0 items-center justify-center rounded-lg border px-2 py-1 font-mono text-sm font-semibold tabular-nums leading-none ${tone.bg} ${tone.border} ${tone.text}`}
            >
              {prospect.score}
            </span>
          </div>

          {whyItMatters ? (
            <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">
              {whyItMatters}
            </p>
          ) : null}

          <p className="mt-2 text-xs leading-relaxed text-muted">
            {[category, typeLabel, prospect.location].filter(Boolean).join(" · ")}
          </p>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
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
          </div>

          {signals.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
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

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border pt-3">
            <span
              className={`font-mono text-[0.6875rem] tabular-nums ${freshnessTone(freshness)}`}
            >
              {formatFreshness(freshness)}
            </span>
            <span className="text-muted-2">·</span>
            <span className="font-mono text-[0.6875rem] text-muted">
              {evidence} evidence source{evidence === 1 ? "" : "s"}
            </span>
            {sources.length > 0 ? (
              <>
                <span className="hidden text-muted-2 sm:inline">·</span>
                <div className="flex flex-wrap gap-1">
                  {sources.map((src) => (
                    <SourceBadge key={src} src={src} />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
