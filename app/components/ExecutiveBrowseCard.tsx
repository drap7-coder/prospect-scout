"use client";

import { useMemo } from "react";
import type { Prospect } from "@/lib/search/types";
import type { SearchState } from "@/lib/search/searchState";
import { buildEnterpriseProspectDisplay } from "@/lib/enterprise/prospectDisplay";
import { faviconUrl } from "@/lib/intelligence/sourceRecords";
import {
  primaryBusinessLine,
  primaryGeographyLabel,
  prospectKeyMetric,
} from "@/lib/browse/prospectWarehouse";
import { useInteractionFeedback } from "./InteractionProvider";
import { EnterpriseProspectMeta } from "./EnterpriseProspectMeta";

function EnterpriseLogo({ website, name }: { website?: string; name: string }) {
  const icon = faviconUrl(website);
  if (!icon) {
    return (
      <span className="exec-browse-logo exec-browse-logo--fallback">{name.charAt(0).toUpperCase()}</span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={icon} alt="" width={36} height={36} className="exec-browse-logo" />
  );
}

function formatLob(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Intelligence-focused card for browse carousels — detail lives on the dossier. */
export function ExecutiveBrowseCard({
  prospect,
  selected,
  onViewDetails,
  searchState,
}: {
  prospect: Prospect;
  selected: boolean;
  onViewDetails: () => void;
  searchState?: Pick<SearchState, "classificationNamespace" | "classificationId"> | null;
}) {
  const { feedback } = useInteractionFeedback();
  const enterprise = prospect.enterpriseProfile;
  const isEnterprise = prospect.isEnterpriseRollup && enterprise;

  const businessLine = useMemo(() => {
    if (isEnterprise && enterprise.linesOfBusiness.length) {
      return enterprise.linesOfBusiness.slice(0, 3).map(formatLob).join(" · ");
    }
    return primaryBusinessLine(prospect);
  }, [isEnterprise, enterprise, prospect]);

  const geography = useMemo(() => {
    if (isEnterprise && enterprise.hqState) {
      const city = enterprise.hqCity ? `${enterprise.hqCity}, ` : "";
      return `${city}${enterprise.hqState} HQ · ${enterprise.statesServed.length} states`;
    }
    return primaryGeographyLabel(prospect);
  }, [isEnterprise, enterprise, prospect]);

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
    if (isEnterprise) return "Enterprise";
    return prospect.buyerType || "Organization";
  }, [isEnterprise, prospect.buyerType]);

  const enterpriseDisplay = useMemo(
    () => buildEnterpriseProspectDisplay(prospect, searchState),
    [prospect, searchState],
  );

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
        <div className="flex min-w-0 items-start gap-3">
          {isEnterprise ? (
            <EnterpriseLogo website={enterprise.website ?? undefined} name={prospect.name} />
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="exec-browse-name">{prospect.name}</h3>
            {isEnterprise && enterprise.canonicalDomain ? (
              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{enterprise.canonicalDomain}</p>
            ) : null}
          </div>
        </div>
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
            <dt>{isEnterprise ? "Lines of business" : "Business line"}</dt>
            <dd>{businessLine}</dd>
          </div>
        ) : null}
        <div>
          <dt>Geography</dt>
          <dd>{geography}</dd>
        </div>
        {isEnterprise && enterprise.ticker ? (
          <div>
            <dt>Ticker</dt>
            <dd>{enterprise.ticker}</dd>
          </div>
        ) : null}
        {isEnterprise ? (
          <div>
            <dt>Operating brands</dt>
            <dd>{enterprise.operatingBrands.length}</dd>
          </div>
        ) : null}
        {!isEnterprise && keyMetric ? (
          <div>
            <dt>{keyMetric.label}</dt>
            <dd>{keyMetric.value}</dd>
          </div>
        ) : null}
        {isEnterprise && enterprise.totalCoveredLives ? (
          <div>
            <dt>Covered lives</dt>
            <dd>{enterprise.totalCoveredLives.toLocaleString()}</dd>
          </div>
        ) : null}
      </dl>

      <EnterpriseProspectMeta display={enterpriseDisplay} />

      {why ? <p className="exec-browse-thesis">{why}</p> : null}
    </article>
  );
}
