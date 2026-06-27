import type { DiscoveryMetadata } from "@/lib/discovery/coverage";
import { coverageMessage, coverageStatusLabel } from "@/lib/discovery/coverage";

const STATUS_TONE: Record<string, string> = {
  excellent: "border-good/40 bg-good/12 text-good",
  good: "border-good/30 bg-good/10 text-good",
  partial: "border-warn/40 bg-warn/12 text-warn",
  expanding: "border-accent/30 bg-accent-soft text-accent-cyan",
};

function CoveragePill({ status }: { status: DiscoveryMetadata["coverageStatus"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wide ${
        STATUS_TONE[status] ?? STATUS_TONE.good
      }`}
    >
      Coverage: {coverageStatusLabel(status)}
    </span>
  );
}

/**
 * Coverage / graceful-fallback messaging for the results header and empty state.
 * `emphasis` renders the larger empty-state treatment when no verified orgs exist.
 */
export function DiscoveryCoverageNote({
  metadata,
  emphasis = false,
}: {
  metadata: DiscoveryMetadata | null | undefined;
  emphasis?: boolean;
}) {
  if (!metadata) return null;
  const message = coverageMessage(metadata);

  // Above the results list, only surface when coverage is not already strong.
  if (!emphasis) {
    if (metadata.coverageStatus === "good" || metadata.coverageStatus === "excellent") {
      return null;
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <CoveragePill status={metadata.coverageStatus} />
        {message ? (
          <span className="font-mono text-xs text-muted-2">{message}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-2 px-6 py-10 text-center">
      <CoveragePill status={metadata.coverageStatus} />
      <p className="max-w-md text-sm text-muted">
        {message ?? "No verified organizations found for this search."}
      </p>
      {metadata.marketBenchmarkAvailable ? (
        <p className="font-mono text-xs text-muted-2">
          Market benchmark from Census is available for this scope.
        </p>
      ) : null}
    </div>
  );
}
