import type { VerifiedSource } from "@/lib/intelligence/executiveCard";

/** "Verified by" source line with optional freshness. */
export function VerifiedData({
  sources,
  freshnessLabel,
  enriching,
}: {
  sources: VerifiedSource[];
  freshnessLabel: string | null;
  enriching?: boolean;
}) {
  if (sources.length === 0 && !enriching) return null;
  return (
    <div className="verified-row">
      <span className="verified-label">Verified by</span>
      <span className="verified-sources">
        {sources.map((s) => (
          <span key={s.id} className="verified-chip">
            <span aria-hidden className="verified-check">
              ✓
            </span>
            {s.label}
          </span>
        ))}
        {enriching ? <span className="verified-chip verified-chip--pending">Enriching…</span> : null}
      </span>
      {freshnessLabel ? <span className="verified-fresh">{freshnessLabel}</span> : null}
    </div>
  );
}
