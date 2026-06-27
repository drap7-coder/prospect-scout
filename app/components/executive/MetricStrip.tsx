import type { MetricChip } from "@/lib/intelligence/executiveCard";

/** Compact, type-specific metric chips. Numeric chips lead with the value. */
export function MetricStrip({ metrics }: { metrics: MetricChip[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="metric-strip">
      {metrics.map((m) => (
        <span key={m.id} className={`metric-chip ${m.accent ? "metric-chip--accent" : ""}`}>
          <span className="metric-chip-value">{m.value}</span>
          {m.label ? <span className="metric-chip-label">{m.label}</span> : null}
        </span>
      ))}
    </div>
  );
}
