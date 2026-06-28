/**
 * Discovery coverage status + staged-discovery metadata.
 *
 * Pure, dependency-light helpers so they can be unit tested and shared between
 * the search pipeline and the API/UI without pulling in catalog internals.
 */

export type DiscoveryCoverageStatus =
  | "excellent"
  | "good"
  | "partial"
  | "expanding";

/** Warehouse resolution for a single search/discovery request. */
export type WarehouseDiscoveryStatus =
  | "warehouse-hydrated"
  | "hydration-failed"
  | "warehouse-empty"
  | "bootstrap-intentional"
  | "bootstrap-fallback"
  | "disabled";

export interface WarehouseDiscoveryInfo {
  status: WarehouseDiscoveryStatus;
  indexSize: number;
  hydrationAttemptedAt: string | null;
  reason: string | null;
}

export interface DiscoveryMetadata {
  /** Named organizations returned after ranking (before pagination cap). */
  resultCount: number;
  /** Minimum result count we aim for before declaring good coverage. */
  threshold: number;
  coverageStatus: DiscoveryCoverageStatus;
  /** Ordered stage labels that actually ran, e.g. ["catalog", "connector-expansion"]. */
  stagesRun: string[];
  /** True when fallback expansion beyond the initial catalog pass was applied. */
  expanded: boolean;
  /** Human-readable reason fallback expansion was triggered (null when not). */
  fallbackReason: string | null;
  /** Connector → count of returned orgs citing that source. */
  sourceSummary: Record<string, number>;
  /** Per-connector candidate counts before merge (Discovery Engine v2). */
  connectorCandidates?: Record<string, number>;
  /** Unique organizations after cross-connector merge. */
  mergedUnique?: number;
  /** Market benchmark exists for this query scope. */
  marketBenchmarkAvailable: boolean;
  /** Organization warehouse resolution for this request (when applicable). */
  warehouse?: WarehouseDiscoveryInfo;
}

export const DISCOVERY_THRESHOLD = 10;

/**
 * Deterministic coverage status from the final named-result count.
 * - excellent: comfortably above threshold (≥ 2× threshold)
 * - good: at/above threshold
 * - partial: some verified orgs, but below threshold
 * - expanding: no verified orgs yet (benchmark-only or empty)
 */
export function computeCoverageStatus(
  resultCount: number,
  threshold: number = DISCOVERY_THRESHOLD,
): DiscoveryCoverageStatus {
  if (resultCount >= threshold * 2) return "excellent";
  if (resultCount >= threshold) return "good";
  if (resultCount > 0) return "partial";
  return "expanding";
}

export function coverageStatusLabel(status: DiscoveryCoverageStatus): string {
  switch (status) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "partial":
      return "Partial";
    case "expanding":
      return "Expanding";
  }
}

/**
 * User-facing coverage message. Mirrors the product copy:
 * - low results → "Found N known organizations. Expanding discovery…"
 * - zero + benchmark → "No verified organizations found yet. Market benchmark available from Census."
 * - zero + nothing → "No verified organizations found for this search."
 */
export function coverageMessage(meta: DiscoveryMetadata): string | null {
  if (meta.resultCount === 0) {
    return meta.marketBenchmarkAvailable
      ? "No verified organizations found yet. Market benchmark available from Census."
      : "No verified organizations found for this search.";
  }
  if (meta.coverageStatus === "partial") {
    const noun = meta.resultCount === 1 ? "organization" : "organizations";
    return meta.expanded
      ? `Found ${meta.resultCount} known ${noun}. Expanding discovery…`
      : `Found ${meta.resultCount} known ${noun}. Coverage is partial.`;
  }
  return null;
}
