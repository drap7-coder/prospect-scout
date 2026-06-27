"use client";

import { useMemo, useState } from "react";
import type { Prospect, ProspectSignal, SizeTier } from "@/lib/search/types";
import type { ResultDensity } from "@/lib/intelligence/resultDensity";
import { resultScoreBadge } from "@/lib/intelligence/colors";
import { sourceTone } from "@/lib/intelligence/colors";
import {
  formatFreshness,
  prospectFreshness,
  topSignals,
} from "@/lib/intelligence/evidence";
import { primaryMatchReason } from "@/lib/intelligence/matchReasons";
import {
  buildSourceRecords,
  faviconUrl,
} from "@/lib/intelligence/sourceRecords";
import {
  industryLabel,
  organizationTypeLabel,
  sectorLabel,
} from "@/lib/taxonomy";
import { useInteractionFeedback } from "./InteractionProvider";
import { EnrichmentHint, SourceRecordBadge } from "./SourceRecordPopover";

const SIZE_LABELS: Record<SizeTier, string> = {
  small: "Small",
  mid: "Mid-market",
  large: "Large",
  enterprise: "Enterprise",
};

type SignalGroup = {
  id: string;
  label: string;
  signals: ProspectSignal[];
};

function groupSignals(signals: ProspectSignal[]): SignalGroup[] {
  const groups: SignalGroup[] = [
    { id: "news", label: "Recent news", signals: [] },
    { id: "regulatory", label: "Regulatory", signals: [] },
    { id: "fda", label: "FDA", signals: [] },
    { id: "sec", label: "SEC", signals: [] },
    { id: "cms", label: "CMS", signals: [] },
    { id: "other", label: "Other signals", signals: [] },
  ];

  for (const s of signals) {
    const src = s.source;
    const text = `${s.label} ${s.evidenceText}`.toLowerCase();
    if (src === "RSS" || /press|news|announcement/.test(text)) {
      groups.find((g) => g.id === "news")!.signals.push(s);
    } else if (src === "FDA" || /recall|fda|enforcement/.test(text)) {
      groups.find((g) => g.id === "fda")!.signals.push(s);
    } else if (src === "SEC" || /filing|10-k|8-k|edgar/.test(text)) {
      groups.find((g) => g.id === "sec")!.signals.push(s);
    } else if (src === "CMS" || /medicare|enrollment|star rating/.test(text)) {
      groups.find((g) => g.id === "cms")!.signals.push(s);
    } else if (s.type === "regulatory" || /regulat|compliance/.test(text)) {
      groups.find((g) => g.id === "regulatory")!.signals.push(s);
    } else {
      groups.find((g) => g.id === "other")!.signals.push(s);
    }
  }

  return groups.filter((g) => g.signals.length > 0);
}

function TypeBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-white/[0.06] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--result-card-muted)] ring-1 ring-white/[0.08]">
      {children}
    </span>
  );
}

function SignalChip({ signal }: { signal: ProspectSignal }) {
  const tone = sourceTone(signal.source);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-md border px-2 py-1 font-mono text-[0.625rem] ${tone.bg} ${tone.border} ${tone.text}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      {signal.label}
    </span>
  );
}

function CardLogo({ website, name }: { website?: string; name: string }) {
  const icon = faviconUrl(website);
  if (!icon) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-sm font-semibold text-[var(--result-card-muted)] ring-1 ring-white/[0.08]">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={icon}
      alt=""
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 rounded-lg bg-white/[0.06] object-contain p-1 ring-1 ring-white/[0.08]"
    />
  );
}

export function ResultCard({
  prospect,
  rank,
  density,
  selected,
  enriching,
  onViewDetails,
}: {
  prospect: Prospect;
  rank: number;
  density: ResultDensity;
  selected: boolean;
  enriching?: boolean;
  onViewDetails: () => void;
}) {
  const [expanded, setExpanded] = useState(density === "detailed");
  const { feedback } = useInteractionFeedback();

  const sourceRecords = useMemo(
    () => buildSourceRecords(prospect),
    [prospect],
  );
  const signals = topSignals(prospect, density === "compact" ? 2 : 5);
  const signalGroups = groupSignals(prospect.signals);
  const freshness = prospectFreshness(prospect);
  const scoreBadge = resultScoreBadge(prospect.score);
  const showExpanded = density === "detailed" || expanded;
  const awaitingEnrichment =
    enriching && prospect.signals.length === 0 && prospect.directoryMatch;

  const summary =
    prospect.description ??
    prospect.whyItMatters[0] ??
    prospect.whyNow;

  const metaParts: string[] = [];
  if (prospect.employeeEstimate) {
    metaParts.push(`~${prospect.employeeEstimate.toLocaleString()} employees`);
  } else if (prospect.size) {
    metaParts.push(SIZE_LABELS[prospect.size]);
  }
  if (prospect.publicCompany === true) metaParts.push("Public");
  else if (prospect.publicCompany === false) metaParts.push("Private");
  if (prospect.sectorId === "nonprofit") metaParts.push("Nonprofit");

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    feedback("tap");
    const text = `${prospect.name} — ${primaryMatchReason(prospect)}`;
    if (navigator.share) {
      void navigator.share({ title: prospect.name, text });
    } else {
      void navigator.clipboard.writeText(text);
    }
  }

  return (
    <article
      className={`result-card-v2 group ${density === "compact" ? "result-card-v2--compact" : ""} ${density === "detailed" ? "result-card-v2--detailed" : ""} ${selected ? "result-card--selected" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="mt-1 font-mono text-[0.625rem] tabular-nums text-[var(--result-card-muted-2)]">
          {String(rank).padStart(2, "0")}
        </span>
        <CardLogo website={prospect.website} name={prospect.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <h3 className="text-[0.9375rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--result-card-text)] sm:text-base">
                {prospect.name}
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {prospect.organizationTypeId ? (
                  <TypeBadge>{organizationTypeLabel(prospect.organizationTypeId)}</TypeBadge>
                ) : (
                  <TypeBadge>{prospect.buyerType}</TypeBadge>
                )}
                {prospect.industryId ? (
                  <TypeBadge>{industryLabel(prospect.industryId)}</TypeBadge>
                ) : prospect.sectorId ? (
                  <TypeBadge>{sectorLabel(prospect.sectorId)}</TypeBadge>
                ) : null}
                {prospect.stateCode ? (
                  <TypeBadge>{prospect.stateCode}</TypeBadge>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span
                className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-lg border px-2 py-1 font-mono text-sm font-bold tabular-nums leading-none ${scoreBadge}`}
                title="Match confidence"
              >
                {prospect.score}
              </span>
              {prospect.discoveryConfidence !== undefined ? (
                <span className="font-mono text-[0.5625rem] text-[var(--result-card-muted-2)]">
                  {Math.round(prospect.discoveryConfidence * 100)}% conf.
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {sourceRecords.map((rec) => (
              <SourceRecordBadge
                key={rec.connector}
                record={rec}
                pulsing={awaitingEnrichment && rec.connector !== "directory"}
              />
            ))}
            {awaitingEnrichment ? (
              <EnrichmentHint label="Enriching…" />
            ) : null}
          </div>
        </div>
      </div>

      {/* Summary — always visible except ultra-compact */}
      {density !== "compact" ? (
        <div className="mt-3 border-t border-white/[0.06] pt-3 pl-[calc(1.25rem+2.25rem+0.75rem)] sm:pl-[calc(1.25rem+2.25rem+0.75rem)]">
          <p className="text-sm leading-relaxed text-[var(--result-card-text)]/90">
            {summary}
          </p>
          <div className="mt-2.5">
            <p className="font-mono text-[0.625rem] uppercase tracking-wide text-[var(--result-card-muted-2)]">
              Why this matched
            </p>
            <ul className="mt-1 space-y-0.5">
              {prospect.matchReasons.slice(0, showExpanded ? 6 : 2).map((r) => (
                <li
                  key={r}
                  className="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--result-card-muted)]"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-cyan/80" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
          {metaParts.length > 0 ? (
            <p className="mt-2 font-mono text-[0.6875rem] text-[var(--result-card-muted-2)]">
              {metaParts.join(" · ")}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 pl-[calc(1.25rem+2.25rem+0.75rem)] text-xs text-[var(--result-card-muted)]">
          {primaryMatchReason(prospect)}
        </p>
      )}

      {/* Signals — comfortable+ when expanded or detailed */}
      {showExpanded && density !== "compact" && signalGroups.length > 0 ? (
        <div className="mt-3 space-y-2.5 border-t border-white/[0.06] pt-3 pl-[calc(1.25rem+2.25rem+0.75rem)]">
          {signalGroups.map((group) => (
            <div key={group.id}>
              <p className="font-mono text-[0.625rem] uppercase tracking-wide text-[var(--result-card-muted-2)]">
                {group.label}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {group.signals.slice(0, 4).map((s) => (
                  <SignalChip key={s.id} signal={s} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : density === "comfortable" && signals.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3 pl-[calc(1.25rem+2.25rem+0.75rem)]">
          {signals.slice(0, 3).map((s) => (
            <SignalChip key={s.id} signal={s} />
          ))}
        </div>
      ) : null}

      {/* Footer actions */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 pl-[calc(1.25rem+2.25rem+0.75rem)]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              feedback("select");
              onViewDetails();
            }}
            className="result-action-btn"
          >
            View details
          </button>
          {prospect.website ? (
            <a
              href={
                /^https?:\/\//i.test(prospect.website)
                  ? prospect.website
                  : `https://${prospect.website}`
              }
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="result-action-btn"
            >
              Website ↗
            </a>
          ) : awaitingEnrichment ? (
            <span className="result-action-btn result-action-btn--muted">
              Website pending
            </span>
          ) : null}
          <button
            type="button"
            disabled
            title="Coming soon"
            className="result-action-btn result-action-btn--disabled"
          >
            Add to list
          </button>
          <button type="button" onClick={handleShare} className="result-action-btn">
            Share
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-[0.625rem] tabular-nums text-[var(--result-card-muted-2)]`}
          >
            {formatFreshness(freshness)}
          </span>
          {density !== "detailed" ? (
            <button
              type="button"
              onClick={() => {
                feedback("tap");
                setExpanded((v) => !v);
              }}
              className="font-mono text-[0.625rem] text-[var(--result-card-muted)] hover:text-[var(--result-card-text)]"
              aria-expanded={expanded}
            >
              {expanded ? "Less" : "More"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** @deprecated Use ResultCard — kept for import compatibility. */
export function ResultRow(props: {
  prospect: Prospect;
  rank: number;
  selected: boolean;
  onSelect: () => void;
  density?: ResultDensity;
  enriching?: boolean;
}) {
  return (
    <ResultCard
      prospect={props.prospect}
      rank={props.rank}
      density={props.density ?? "comfortable"}
      selected={props.selected}
      enriching={props.enriching}
      onViewDetails={props.onSelect}
    />
  );
}
