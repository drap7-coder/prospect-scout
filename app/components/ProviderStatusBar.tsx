"use client";

import type {
  ProviderBadgeKey,
  ProviderBadgeStatus,
} from "@/lib/search/providerPlan";
import { PROVIDER_LABELS } from "@/lib/search/providerPlan";

type BadgeKey = "mock" | ProviderBadgeKey;

const STATUS_STYLES: Record<ProviderBadgeStatus, string> = {
  idle: "border-border/60 bg-surface/40 text-muted-2",
  loading: "border-accent/40 bg-accent-soft/30 text-accent-cyan animate-pulse",
  ready: "border-good/35 bg-good/10 text-good",
  unavailable: "border-warn/35 bg-warn/10 text-warn",
  skipped: "border-border/40 bg-transparent text-muted-2/70",
};

const STATUS_TEXT: Record<ProviderBadgeStatus, string> = {
  idle: "",
  loading: "loading",
  ready: "ready",
  unavailable: "unavailable",
  skipped: "—",
};

export function ProviderStatusBar({
  statuses,
  planned,
}: {
  statuses: Record<BadgeKey, ProviderBadgeStatus>;
  planned: ProviderBadgeKey[];
}) {
  const keys: BadgeKey[] = ["mock", "cms", "sec", "rss", "fda"];

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-live="polite"
      aria-label="Intelligence source status"
    >
      <span className="label-mono mr-1 text-muted-2">Sources</span>
      {keys.map((key) => {
        const status =
          key === "mock"
            ? statuses.mock
            : planned.includes(key)
              ? statuses[key]
              : "skipped";
        const label = PROVIDER_LABELS[key];
        const suffix = STATUS_TEXT[status];
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wide ${STATUS_STYLES[status]}`}
          >
            {label}
            {suffix ? (
              <span className="normal-case opacity-80">· {suffix}</span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export function initialProviderStatuses(
  planned: ProviderBadgeKey[],
): Record<BadgeKey, ProviderBadgeStatus> {
  return {
    mock: "loading",
    cms: planned.includes("cms") ? "idle" : "skipped",
    sec: planned.includes("sec") ? "idle" : "skipped",
    rss: planned.includes("rss") ? "idle" : "skipped",
    fda: planned.includes("fda") ? "idle" : "skipped",
  };
}

export function markProvidersLoading(
  statuses: Record<BadgeKey, ProviderBadgeStatus>,
  planned: ProviderBadgeKey[],
): Record<BadgeKey, ProviderBadgeStatus> {
  const next = { ...statuses, mock: "ready" as const };
  for (const p of planned) {
    next[p] = "loading";
  }
  return next;
}
