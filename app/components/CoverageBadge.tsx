import type { CatalogCoverageStatus } from "@/lib/catalog/types";
import { coverageSummary } from "@/lib/catalog/routing";

const STATUS_STYLES: Record<
  CatalogCoverageStatus,
  { badge: string; icon: string }
> = {
  warehouse: {
    badge: "border-good/40 bg-good/10 text-good",
    icon: "✓",
  },
  "live-discovery": {
    badge: "border-warn/40 bg-warn/10 text-warn",
    icon: "◐",
  },
  planned: {
    badge: "border-border bg-surface-2 text-muted-2",
    icon: "○",
  },
};

export function CoverageBadge({
  status,
  compact = false,
  className = "",
}: {
  status: CatalogCoverageStatus;
  compact?: boolean;
  className?: string;
}) {
  const meta = coverageSummary(status);
  const styles = STATUS_STYLES[status];

  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wide ${styles.badge} ${className}`}
    >
      <span aria-hidden>{styles.icon}</span>
      {compact ? null : <span>{meta.label}</span>}
    </span>
  );
}
