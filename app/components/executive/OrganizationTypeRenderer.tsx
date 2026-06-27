import type { ExecutiveCardModel } from "@/lib/intelligence/executiveCard";
import { MetricStrip } from "./MetricStrip";
import { WhyThisMatters } from "./WhyThisMatters";
import { RecentActivityTimeline } from "./RecentActivityTimeline";

/**
 * Adaptive body renderer.
 *
 * Rendering is driven by `model.orgKind` (resolved from canonicalOrganizationType
 * + healthPlanType): the metric set is built per kind upstream in
 * `synthesizeExecutiveCard`, so this component composes the right modules without
 * a giant conditional. Secondary modules (activity) are gated to avoid layout
 * shift when there's nothing meaningful to show.
 */
export function OrganizationTypeRenderer({
  model,
  showActivity,
}: {
  model: ExecutiveCardModel;
  showActivity: boolean;
}) {
  return (
    <>
      <MetricStrip metrics={model.metrics} />
      <WhyThisMatters insights={model.whyThisMatters} />
      {showActivity ? <RecentActivityTimeline activity={model.recentActivity} /> : null}
    </>
  );
}
