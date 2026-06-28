"use client";

import type { DiscoveryMetadata } from "@/lib/discovery/coverage";

const CONNECTOR_ORDER = [
  "directory",
  "sec",
  "fda",
  "cms",
  "wikipedia",
  "public-web",
  "rss",
  "irs-nonprofits",
  "nces",
  "aca-marketplace",
  "state-registry",
  "business-directory",
  "erisa",
];

function labelFor(id: string): string {
  const labels: Record<string, string> = {
    directory: "Directory",
    sec: "SEC",
    fda: "FDA",
    cms: "CMS",
    wikipedia: "Wikipedia",
    "public-web": "Public Web",
    rss: "RSS",
    "irs-nonprofits": "IRS Nonprofits",
    nces: "NCES",
    "aca-marketplace": "ACA Marketplace",
    "state-registry": "State Registry",
    "business-directory": "Business Directory",
    erisa: "ERISA",
  };
  return labels[id] ?? id;
}

export function DiscoveryDiagnosticsPanel({
  metadata,
  displayedCount,
}: {
  metadata: DiscoveryMetadata | null | undefined;
  displayedCount: number;
}) {
  if (!metadata?.connectorCandidates) return null;

  const entries = Object.entries(metadata.connectorCandidates).sort(
    ([a], [b]) => {
      const ai = CONNECTOR_ORDER.indexOf(a);
      const bi = CONNECTOR_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    },
  );

  if (entries.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-white/10 bg-[#06141f]/82 p-4 text-white backdrop-blur-xl"
      aria-label="Discovery source diagnostics"
    >
      <p className="label-mono text-cyan-300/90">Discovery sources</p>
      <dl className="mt-3 space-y-1.5 font-mono text-xs">
        {entries.map(([id, count]) => (
          <div key={id} className="flex items-baseline justify-between gap-4">
            <dt className="text-white/70">{labelFor(id)}</dt>
            <dd className="tabular-nums text-white/90">{count} candidates</dd>
          </div>
        ))}
        {metadata.mergedUnique != null ? (
          <div className="flex items-baseline justify-between gap-4 border-t border-white/10 pt-2">
            <dt className="text-white/75">Merged</dt>
            <dd className="tabular-nums text-white/90">
              {metadata.mergedUnique} unique organizations
            </dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-4 border-t border-white/10 pt-2">
          <dt className="text-white/75">Displayed</dt>
          <dd className="tabular-nums text-cyan-200">Top {displayedCount}</dd>
        </div>
      </dl>
    </div>
  );
}
