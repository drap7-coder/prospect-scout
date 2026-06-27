"use client";

import { useMemo, useState } from "react";
import type { Prospect } from "@/lib/search/types";
import type { ResultDensity } from "@/lib/intelligence/resultDensity";
import { resultScoreBadge } from "@/lib/intelligence/colors";
import { formatFreshness, prospectFreshness } from "@/lib/intelligence/evidence";
import { primaryMatchReason } from "@/lib/intelligence/matchReasons";
import { faviconUrl } from "@/lib/intelligence/sourceRecords";
import { synthesizeIntelligenceCard } from "@/lib/intelligence/synthesizeCard";
import { useNonprofitEnrichment } from "@/lib/intelligence/useNonprofitEnrichment";
import { useInteractionFeedback } from "./InteractionProvider";
import { EnrichmentHint } from "./SourceRecordPopover";
import { IntelligenceSourceBadge } from "./IntelligenceSourceBadge";
import {
  isNonprofitProspect,
  extractEinFromProspectId,
  parseCityFromLocation,
} from "./NonprofitEnrichmentStrip";

const CARD_INDENT = "pl-[calc(1.25rem+2.25rem+0.75rem)]";

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

function IntelSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`intel-section ${className}`}>
      <h4 className="intel-section-label">{title}</h4>
      {children}
    </section>
  );
}

function IdentityMeta({
  parts,
}: {
  parts: { label: string; value: React.ReactNode }[];
}) {
  if (parts.length === 0) return null;
  return (
    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {parts.map(({ label, value }) => (
        <div key={label} className="flex min-w-0 items-baseline gap-1.5">
          <dt className="shrink-0 font-mono text-[0.625rem] uppercase tracking-wide text-[var(--result-card-muted-2)]">
            {label}
          </dt>
          <dd className="text-[var(--result-card-muted)]">{value}</dd>
        </div>
      ))}
    </dl>
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

  const showNonprofitEnrichment = isNonprofitProspect(prospect);
  const nonprofitEin =
    prospect.ein ?? extractEinFromProspectId(prospect.id) ?? null;
  const nonprofitCity = parseCityFromLocation(prospect.location);

  const { enrichment: nonprofitEnrichment } = useNonprofitEnrichment({
    enabled: showNonprofitEnrichment,
    name: prospect.name,
    ein: nonprofitEin,
    city: nonprofitCity,
    state: prospect.stateCode ?? null,
  });

  const card = useMemo(
    () => synthesizeIntelligenceCard(prospect, nonprofitEnrichment),
    [prospect, nonprofitEnrichment],
  );

  const freshness = prospectFreshness(prospect);
  const scoreBadge = resultScoreBadge(card.identity.matchScore);
  const showExpanded = density === "detailed" || expanded;
  const awaitingEnrichment =
    enriching && prospect.signals.length === 0 && prospect.directoryMatch;

  const intelLimit =
    density === "compact" ? 2 : showExpanded ? card.intelligence.length : 3;
  const signalLimit = density === "compact" ? 1 : 3;
  const visibleIntel = card.intelligence.slice(0, intelLimit);
  const visibleSignals = card.opportunitySignals.slice(0, signalLimit);
  const hiddenIntel = card.intelligence.length - visibleIntel.length;
  const hiddenSignals = card.opportunitySignals.length - visibleSignals.length;

  const identityMeta: { label: string; value: React.ReactNode }[] = [];
  if (card.identity.orgType) {
    identityMeta.push({ label: "Type", value: card.identity.orgType });
  }
  if (card.identity.industry) {
    identityMeta.push({ label: "Industry", value: card.identity.industry });
  }
  if (card.identity.headquarters) {
    identityMeta.push({ label: "HQ", value: card.identity.headquarters });
  }
  if (card.identity.website && card.identity.websiteHref) {
    identityMeta.push({
      label: "Web",
      value: (
        <a
          href={card.identity.websiteHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-accent-cyan/90 hover:text-accent-cyan hover:underline"
        >
          {card.identity.website}
        </a>
      ),
    });
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    feedback("tap");
    const summary =
      card.intelligence[0]?.text ?? primaryMatchReason(prospect);
    const text = `${prospect.name} — ${summary}`;
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
      <div className="flex items-start gap-3">
        <span className="mt-1 font-mono text-[0.625rem] tabular-nums text-[var(--result-card-muted-2)]">
          {String(rank).padStart(2, "0")}
        </span>
        <CardLogo website={prospect.website} name={card.identity.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <h3 className="text-[0.9375rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--result-card-text)] sm:text-base">
                {card.identity.name}
              </h3>
              <IdentityMeta parts={identityMeta} />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-lg border px-2 py-1 font-mono text-sm font-bold tabular-nums leading-none ${scoreBadge}`}
                title="Match score"
              >
                {card.identity.matchScore}
              </span>
              {card.identity.confidencePercent != null ? (
                <span
                  className="font-mono text-[0.5625rem] text-[var(--result-card-muted-2)]"
                  title="Discovery confidence"
                >
                  {card.identity.confidencePercent}% confidence
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {visibleIntel.length > 0 ? (
        <IntelSection title="Intelligence" className={`mt-3 ${CARD_INDENT}`}>
          <ul className="intel-bullet-list">
            {visibleIntel.map((bullet) => (
              <li key={bullet.text}>{bullet.text}</li>
            ))}
          </ul>
          {!showExpanded && hiddenIntel > 0 ? (
            <p className="mt-1.5 font-mono text-[0.625rem] text-[var(--result-card-muted-2)]">
              +{hiddenIntel} more insight{hiddenIntel === 1 ? "" : "s"}
            </p>
          ) : null}
        </IntelSection>
      ) : density === "compact" ? (
        <p className={`mt-2 ${CARD_INDENT} text-xs text-[var(--result-card-muted)]`}>
          {primaryMatchReason(prospect)}
        </p>
      ) : null}

      {card.whyNow && showExpanded && density !== "compact" ? (
        <div className={`mt-3 ${CARD_INDENT}`}>
          <p className="intel-why-now">{card.whyNow}</p>
        </div>
      ) : null}

      {visibleSignals.length > 0 ? (
        <IntelSection
          title="Opportunity signals"
          className={`mt-3 border-t border-white/[0.06] pt-3 ${CARD_INDENT}`}
        >
          <ul className="intel-signal-list">
            {visibleSignals.map((signal) => (
              <li key={`${signal.source}-${signal.label}`}>
                <span className="intel-signal-label">{signal.label}</span>
                {showExpanded && signal.detail ? (
                  <span className="intel-signal-detail">{signal.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {!showExpanded && hiddenSignals > 0 ? (
            <p className="mt-1.5 font-mono text-[0.625rem] text-[var(--result-card-muted-2)]">
              +{hiddenSignals} more signal{hiddenSignals === 1 ? "" : "s"}
            </p>
          ) : null}
        </IntelSection>
      ) : null}

      {card.dataSources.length > 0 ? (
        <IntelSection
          title="Data sources"
          className={`mt-3 border-t border-white/[0.06] pt-3 ${CARD_INDENT}`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {card.dataSources.map((badge) => (
              <IntelligenceSourceBadge
                key={badge.id}
                badge={badge}
                pulsing={awaitingEnrichment && badge.id !== "directory"}
              />
            ))}
            {awaitingEnrichment ? <EnrichmentHint label="Enriching…" /> : null}
          </div>
        </IntelSection>
      ) : awaitingEnrichment ? (
        <div className={`mt-3 ${CARD_INDENT}`}>
          <EnrichmentHint label="Enriching…" />
        </div>
      ) : null}

      <div
        className={`mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 ${CARD_INDENT}`}
      >
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
          {card.identity.websiteHref ? (
            <a
              href={card.identity.websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="result-action-btn"
            >
              Website ↗
            </a>
          ) : null}
          {card.form990Url ? (
            <a
              href={card.form990Url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="result-action-btn"
            >
              Form 990 ↗
            </a>
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
          <span className="font-mono text-[0.625rem] tabular-nums text-[var(--result-card-muted-2)]">
            {formatFreshness(freshness)}
          </span>
          {density !== "detailed" &&
          (hiddenIntel > 0 || hiddenSignals > 0 || card.whyNow) ? (
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
