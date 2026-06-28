"use client";

import { useMemo } from "react";
import type { Prospect } from "@/lib/search/types";
import {
  primaryBusinessLine,
  primaryGeographyLabel,
  prospectKeyMetric,
} from "@/lib/browse/prospectWarehouse";
import { useInteractionFeedback } from "./InteractionProvider";

/** Intelligence-focused card for browse carousels — detail lives on the dossier. */
export function ExecutiveBrowseCard({
  prospect,
  selected,
  onViewDetails,
}: {
  prospect: Prospect;
  selected: boolean;
  onViewDetails: () => void;
}) {
  const { feedback } = useInteractionFeedback();
  const businessLine = primaryBusinessLine(prospect);
  const geography = primaryGeographyLabel(prospect);
  const keyMetric = prospectKeyMetric(prospect);
  const confidence =
    prospect.discoveryConfidence != null
      ? Math.round(prospect.discoveryConfidence * 100)
      : null;
  const why =
    prospect.whyItMatters[0] ??
    prospect.matchReasons[0] ??
    prospect.whyNow ??
    null;

  const orgType = useMemo(() => {
    return prospect.buyerType || "Organization";
  }, [prospect.buyerType]);

  function handleClick() {
    feedback("select");
    onViewDetails();
  }

  return (
    <article
      className={`exec-browse-card group ${selected ? "exec-browse-card--selected" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <header className="exec-browse-header">
        <h3 className="exec-browse-name">{prospect.name}</h3>
        <div className="exec-browse-score" aria-label={`Opportunity score ${prospect.score}`}>
          <span className="exec-browse-score-value">{prospect.score}</span>
          {confidence != null ? (
            <span className="exec-browse-confidence">{confidence}% conf.</span>
          ) : null}
        </div>
      </header>

      <dl className="exec-browse-meta">
        <div>
          <dt>Type</dt>
          <dd>{orgType}</dd>
        </div>
        {businessLine ? (
          <div>
            <dt>Business line</dt>
            <dd>{businessLine}</dd>
          </div>
        ) : null}
        <div>
          <dt>Geography</dt>
          <dd>{geography}</dd>
        </div>
        {keyMetric ? (
          <div>
            <dt>{keyMetric.label}</dt>
            <dd>{keyMetric.value}</dd>
          </div>
        ) : null}
      </dl>

      {why ? <p className="exec-browse-thesis">{why}</p> : null}
    </article>
  );
}
