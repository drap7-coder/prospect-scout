import type { OrganizationIntelligenceModule } from "@/lib/intelligence/framework/types";
import {
  isBenefitsIntelligenceDetail,
  type BenefitsIntelligenceDetail,
} from "@/lib/intelligence/modules/benefits/buildBenefitsIntelligence";

function ProvenanceList({
  provenance,
}: {
  provenance: OrganizationIntelligenceModule["provenance"];
}) {
  if (provenance.length === 0) return null;
  return (
    <div className="intel-detail__provenance">
      <h4 className="label-mono text-accent-cyan/90">Sources</h4>
      <ul className="mt-2 space-y-2">
        {provenance.map((source) => (
          <li key={source.sourceId} className="text-sm text-muted">
            {source.sourceUrl ? (
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent-cyan hover:underline"
              >
                {source.sourceLabel}
              </a>
            ) : (
              source.sourceLabel
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BenefitsIntelligenceDetailView({
  detail,
}: {
  detail: BenefitsIntelligenceDetail;
}) {
  return (
    <div className="intel-detail__body">
      <section>
        <h4 className="label-mono">Plan overview</h4>
        <dl className="intel-detail__stats mt-3 grid gap-3 sm:grid-cols-2">
          {detail.totals.benefitPlanCount > 0 ? (
            <div>
              <dt className="text-xs text-muted">Benefit plans</dt>
              <dd className="text-sm font-medium text-foreground">
                {detail.totals.benefitPlanCount}
              </dd>
            </div>
          ) : null}
          {detail.totals.totalErisaPlanParticipants > 0 ? (
            <div>
              <dt className="text-xs text-muted">ERISA plan participants</dt>
              <dd className="text-sm font-medium text-foreground">
                {detail.totals.totalErisaPlanParticipants.toLocaleString()}
              </dd>
            </div>
          ) : null}
          {detail.totals.welfarePlanCount > 0 ? (
            <div>
              <dt className="text-xs text-muted">Welfare plans</dt>
              <dd className="text-sm font-medium text-foreground">
                {detail.totals.welfarePlanCount}
              </dd>
            </div>
          ) : null}
          {detail.totals.pensionPlanCount > 0 ? (
            <div>
              <dt className="text-xs text-muted">Pension plans</dt>
              <dd className="text-sm font-medium text-foreground">
                {detail.totals.pensionPlanCount}
              </dd>
            </div>
          ) : null}
          {detail.totals.selfFundedPlanCount > 0 ? (
            <div>
              <dt className="text-xs text-muted">Self-funded plans</dt>
              <dd className="text-sm font-medium text-foreground">
                {detail.totals.selfFundedPlanCount}
              </dd>
            </div>
          ) : null}
          {detail.totals.latestFilingYear != null ? (
            <div>
              <dt className="text-xs text-muted">Latest filing year</dt>
              <dd className="text-sm font-medium text-foreground">
                {detail.totals.latestFilingYear}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {detail.filings.length > 0 ? (
        <section className="mt-5">
          <h4 className="label-mono">Form 5500 filings</h4>
          <ul className="mt-3 space-y-3">
            {detail.filings.map((filing, index) => (
              <li
                key={`${filing.planNumber ?? "plan"}-${filing.filingYear}-${index}`}
                className="rounded-lg border border-border/70 bg-surface/50 px-3.5 py-3"
              >
                <p className="text-sm font-medium text-foreground">
                  {filing.planName ?? "Unnamed plan"}
                </p>
                <p className="mt-1 font-mono text-xs text-muted">
                  {filing.filingYear}
                  {filing.planNumber ? ` · Plan ${filing.planNumber}` : ""}
                  {filing.participantCount != null
                    ? ` · ${filing.participantCount.toLocaleString()} ERISA plan participants`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {filing.healthWelfarePlan ? "Health & welfare" : "Pension / other"}
                  {filing.selfFunded ? " · Self-funded" : ""}
                  {filing.fundingArrangement ? ` · ${filing.fundingArrangement}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {detail.serviceProviders.length > 0 ? (
        <section className="mt-5">
          <h4 className="label-mono">Service providers & vendors</h4>
          <ul className="mt-3 space-y-2">
            {detail.serviceProviders.map((provider, index) => (
              <li
                key={`${provider.name}-${provider.role}-${index}`}
                className="rounded-lg border border-border/70 px-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">{provider.name}</span>
                <span className="text-muted"> · {provider.role.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function IntelligenceModuleDetailPanel({
  module,
}: {
  module: OrganizationIntelligenceModule | null;
}) {
  if (!module) return null;

  return (
    <section className="intel-detail rounded-xl border border-border/80 bg-background/50 p-4">
      <header className="intel-detail__header">
        <span className="intel-module__icon" aria-hidden>
          {module.icon}
        </span>
        <h3 className="text-lg font-semibold text-foreground">{module.title}</h3>
      </header>

      {module.id === "benefits" && isBenefitsIntelligenceDetail(module.detail) ? (
        <BenefitsIntelligenceDetailView detail={module.detail} />
      ) : null}

      <ProvenanceList provenance={module.provenance} />
    </section>
  );
}
