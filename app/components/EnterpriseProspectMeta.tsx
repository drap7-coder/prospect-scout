"use client";

import type { EnterpriseProspectDisplay } from "@/lib/enterprise/prospectDisplay";

export function EnterpriseBadge({ label = "Enterprise" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-accent-cyan/35 bg-accent-soft px-1.5 py-0.5 font-mono text-[0.625rem] font-medium uppercase tracking-wide text-accent-cyan">
      {label}
    </span>
  );
}

export function EnterpriseProspectMeta({
  display,
  compact = false,
}: {
  display: EnterpriseProspectDisplay;
  compact?: boolean;
}) {
  if (
    !display.isEnterprise &&
    !display.matchedLob &&
    !display.alsoOffers
  ) {
    return null;
  }

  return (
    <div
      className={`flex flex-col ${compact ? "gap-0.5" : "gap-1"} ${compact ? "text-[0.6875rem]" : "text-xs"} text-muted`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {display.isEnterprise && display.enterpriseBadge ? (
          <EnterpriseBadge label={display.enterpriseBadge} />
        ) : null}
        {display.collapseLine ? (
          <span className="text-muted-2">{display.collapseLine}</span>
        ) : null}
      </div>
      {display.matchedLob ? (
        <span className="text-muted-2">{display.matchedLob}</span>
      ) : null}
      {display.alsoOffers ? (
        <span className="text-muted-2">{display.alsoOffers}</span>
      ) : null}
    </div>
  );
}

export function EnterpriseRollupBanner({
  summary,
}: {
  summary: string;
}) {
  return (
    <div
      className="rounded-lg border border-accent-cyan/25 bg-accent-soft/40 px-3 py-2 text-sm text-foreground"
      role="status"
    >
      <span className="font-medium">Enterprise rollup active.</span>{" "}
      <span className="text-muted">{summary}</span>
    </div>
  );
}
