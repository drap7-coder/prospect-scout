import type { DiscoveryMetadata } from "@/lib/discovery/coverage";
import type { Prospect } from "@/lib/search/types";
import {
  locationLabel,
  orgTypeLabel,
  type SearchState,
} from "@/lib/search/searchState";
import { sectorLabel, industryLabel } from "@/lib/taxonomy";
import {
  classificationFilterLabel,
  HEALTH_PLAN_LOB_FILTERS,
} from "@/lib/search/classificationFilters";

const WAREHOUSE_STATUS_LABEL: Record<string, string> = {
  "warehouse-hydrated": "Warehouse hydrated",
  "hydration-failed": "Hydration failed",
  "warehouse-empty": "Warehouse empty",
  "bootstrap-intentional": "Bootstrap catalog",
  "bootstrap-fallback": "Bootstrap fallback",
  disabled: "Warehouse disabled",
};

function activeFilterLabels(state: SearchState): string[] {
  const labels: string[] = [];
  if (state.sector) labels.push(sectorLabel(state.sector));
  if (state.industry) labels.push(industryLabel(state.industry));
  if (state.organizationType) labels.push(orgTypeLabel(state.organizationType));
  if (state.location) labels.push(locationLabel(state.location));
  if (state.state) labels.push(state.state);
  if (state.classificationNamespace && state.classificationId) {
    const label = classificationFilterLabel(
      state.classificationNamespace,
      state.classificationId,
    );
    if (label) labels.push(label);
  }
  return labels;
}

function warehouseSourceLabel(metadata: DiscoveryMetadata | null | undefined): string | null {
  if (!metadata?.sourceSummary) return null;
  const cmsCount =
    (metadata.sourceSummary["cms-cpsc"] ?? 0) +
    (metadata.sourceSummary["cms-qhp"] ?? 0) +
    (metadata.sourceSummary["cms-medicaid-mco"] ?? 0) +
    (metadata.sourceSummary["cms-medicaid-enrollment"] ?? 0);
  if (cmsCount > 0) return "CMS Warehouse";
  if (metadata.stagesRun.includes("organization-warehouse")) return "Organization Warehouse";
  return null;
}

function warehouseLastUpdated(
  metadata: DiscoveryMetadata | null | undefined,
  prospects: Prospect[] | undefined,
): string | null {
  const hydration = metadata?.warehouse?.hydrationAttemptedAt;
  if (hydration) return hydration.slice(0, 10);

  let max: string | null = null;
  for (const p of prospects ?? []) {
    for (const src of p.sourceRecords ?? []) {
      if (src.lastUpdated && (!max || src.lastUpdated > max)) {
        max = src.lastUpdated;
      }
    }
  }
  return max;
}

/**
 * Warehouse coverage summary for the Results page — ranked count vs warehouse total,
 * source, status, and active structured filters.
 */
export function WarehouseCoverageBanner({
  displayedCount,
  warehouseTotal,
  searchState,
  metadata,
  prospects,
  orgTypeLabel: orgTypeHint,
}: {
  displayedCount: number;
  warehouseTotal: number | null;
  searchState: SearchState;
  metadata: DiscoveryMetadata | null | undefined;
  prospects?: Prospect[];
  orgTypeLabel?: string;
}) {
  if (!warehouseTotal && !metadata?.warehouse) return null;

  const total = warehouseTotal ?? metadata?.warehouse?.indexSize ?? null;
  const source = warehouseSourceLabel(metadata);
  const lastUpdated = warehouseLastUpdated(metadata, prospects);
  const warehouseStatus = metadata?.warehouse?.status;
  const activeFilters = activeFilterLabels(searchState);
  const typeLabel =
    orgTypeHint ??
    (searchState.organizationType
      ? orgTypeLabel(searchState.organizationType)
      : searchState.industry
        ? industryLabel(searchState.industry)
        : "organizations");

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {total != null && total > 0 ? (
          <span className="font-mono text-xs text-foreground">
            <span className="font-semibold tabular-nums">
              {displayedCount.toLocaleString()}
            </span>
            {" of "}
            <span className="tabular-nums">{total.toLocaleString()}</span>{" "}
            {typeLabel.toLowerCase()}
          </span>
        ) : (
          <span className="font-mono text-xs text-foreground">
            {displayedCount.toLocaleString()} results
          </span>
        )}
        {source ? (
          <>
            <span className="text-muted-2">·</span>
            <span className="font-mono text-xs text-muted-2">Source: {source}</span>
          </>
        ) : null}
        {lastUpdated ? (
          <>
            <span className="text-muted-2">·</span>
            <span className="font-mono text-xs text-muted-2">
              Last updated {lastUpdated}
            </span>
          </>
        ) : null}
        {warehouseStatus ? (
          <>
            <span className="text-muted-2">·</span>
            <span
              className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wide ${
                warehouseStatus === "warehouse-hydrated"
                  ? "border-good/40 bg-good/10 text-good"
                  : warehouseStatus === "bootstrap-fallback"
                    ? "border-warn/40 bg-warn/10 text-warn"
                    : "border-border text-muted-2"
              }`}
            >
              {WAREHOUSE_STATUS_LABEL[warehouseStatus] ?? warehouseStatus}
            </span>
          </>
        ) : null}
      </div>
      {activeFilters.length > 0 ? (
        <p className="mt-2 font-mono text-[0.6875rem] text-muted-2">
          Active filters: {activeFilters.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

export { HEALTH_PLAN_LOB_FILTERS };
