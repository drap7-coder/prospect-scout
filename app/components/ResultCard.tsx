"use client";

import { useMemo } from "react";
import type { Prospect } from "@/lib/search/types";
import type { SearchState } from "@/lib/search/searchState";
import type { ResultDensity } from "@/lib/intelligence/resultDensity";
import { buildEnterpriseProspectDisplay } from "@/lib/enterprise/prospectDisplay";
import { faviconUrl } from "@/lib/intelligence/sourceRecords";
import { synthesizeExecutiveCard } from "@/lib/intelligence/executiveCard";
import { useNonprofitEnrichment } from "@/lib/intelligence/useNonprofitEnrichment";
import { useInteractionFeedback } from "./InteractionProvider";
import { ScoutScore } from "./executive/ScoutScore";
import { ExecutiveThesis } from "./executive/ExecutiveThesis";
import { OrganizationTypeRenderer } from "./executive/OrganizationTypeRenderer";
import { VerifiedData } from "./executive/VerifiedData";
import { CardActions } from "./executive/CardActions";
import { EnterpriseProspectMeta } from "./EnterpriseProspectMeta";
import { IntelligenceModulesPanel } from "./intelligence/IntelligenceModulesPanel";
import {
  isNonprofitProspect,
  extractEinFromProspectId,
  parseCityFromLocation,
} from "./NonprofitEnrichmentStrip";

function CardLogo({ website, name }: { website?: string; name: string }) {
  const icon = faviconUrl(website);
  if (!icon) {
    return (
      <span className="exec-logo exec-logo--fallback">{name.charAt(0).toUpperCase()}</span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={icon} alt="" width={40} height={40} className="exec-logo" />
  );
}

export function ResultCard({
  prospect,
  rank,
  density,
  selected,
  enriching,
  onViewDetails,
  searchState,
}: {
  prospect: Prospect;
  rank: number;
  density: ResultDensity;
  selected: boolean;
  enriching?: boolean;
  onViewDetails: () => void;
  searchState?: Pick<SearchState, "classificationNamespace" | "classificationId"> | null;
}) {
  const { feedback } = useInteractionFeedback();

  const showNonprofitEnrichment = isNonprofitProspect(prospect);
  const nonprofitEin = prospect.ein ?? extractEinFromProspectId(prospect.id) ?? null;
  const nonprofitCity = parseCityFromLocation(prospect.location);

  const { enrichment: nonprofitEnrichment } = useNonprofitEnrichment({
    enabled: showNonprofitEnrichment,
    name: prospect.name,
    ein: nonprofitEin,
    city: nonprofitCity,
    state: prospect.stateCode ?? null,
  });

  const card = useMemo(
    () => synthesizeExecutiveCard(prospect, nonprofitEnrichment),
    [prospect, nonprofitEnrichment],
  );

  const awaitingEnrichment = Boolean(
    enriching && prospect.signals.length === 0 && prospect.directoryMatch,
  );
  const isCompact = density === "compact";

  const enterpriseDisplay = useMemo(
    () => buildEnterpriseProspectDisplay(prospect, searchState),
    [prospect, searchState],
  );

  const identityMeta = [card.orgType, card.headquarters].filter(Boolean).join(" · ");
  const shareText = `${card.name}${card.thesis ? ` — ${card.thesis}` : ""}`;

  function handleCardClick() {
    feedback("select");
    onViewDetails();
  }

  return (
    <article
      className={`exec-card group ${isCompact ? "exec-card--compact" : ""} ${
        selected ? "exec-card--selected" : ""
      }`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <header className="exec-header">
        <span className="exec-rank">{String(rank).padStart(2, "0")}</span>
        <CardLogo website={prospect.website} name={card.name} />
        <div className="exec-identity">
          <h3 className="exec-name">{card.name}</h3>
          {identityMeta ? <p className="exec-meta">{identityMeta}</p> : null}
        </div>
        <ScoutScore score={card.scoutScore} confidencePercent={card.confidencePercent} />
      </header>

      <ExecutiveThesis thesis={card.thesis} />

      <EnterpriseProspectMeta display={enterpriseDisplay} compact={isCompact} />

      <div onClick={(e) => e.stopPropagation()}>
        <IntelligenceModulesPanel
          profile={prospect.organizationIntelligence}
          compact={isCompact}
          onSelectModule={() => onViewDetails()}
        />
      </div>

      <OrganizationTypeRenderer model={card} showActivity={!isCompact} />

      <footer className="exec-footer">
        <VerifiedData
          sources={card.verifiedBy}
          freshnessLabel={card.freshnessLabel}
          enriching={awaitingEnrichment}
        />
        <div onClick={(e) => e.stopPropagation()}>
          <CardActions
            onViewIntelligence={onViewDetails}
            websiteHref={card.websiteHref}
            form990Url={card.form990Url}
            shareText={shareText}
          />
        </div>
      </footer>
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
  searchState?: Pick<SearchState, "classificationNamespace" | "classificationId"> | null;
}) {
  return (
    <ResultCard
      prospect={props.prospect}
      rank={props.rank}
      density={props.density ?? "comfortable"}
      selected={props.selected}
      enriching={props.enriching}
      onViewDetails={props.onSelect}
      searchState={props.searchState}
    />
  );
}
