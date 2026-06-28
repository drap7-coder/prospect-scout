"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Prospect, SearchResponse } from "@/lib/search/types";
import type { ProviderBadgeKey } from "@/lib/search/providerPlan";
import type { LiveProviderKey } from "@/lib/search/providerPlan";
import { searchRequestBody } from "@/lib/search/progressiveSearch";
import {
  describeSearch,
  parseSearchStateFromParams,
  resolveSearchState,
  searchFetchFingerprint,
  searchStateToParams,
  type SearchState,
} from "@/lib/search/searchState";
import {
  applyResultsFilters,
  sortResults,
  type ResultsSortKey,
} from "@/lib/search/resultsFilters";
import { formatSourceSummary } from "@/lib/search/sourceSummary";
import { saveWorkspace } from "@/lib/intelligence/session";
import {
  displayModeToDensity,
  loadBrowseLens,
  loadResultsDisplayMode,
  saveBrowseLens,
  saveResultsDisplayMode,
  type ResultsDisplayMode,
} from "@/lib/intelligence/resultsView";
import type { BrowseLensId } from "@/lib/browse/types";
import { defaultBrowseLens } from "@/lib/browse/buildBrowseRows";
import type { CatalogFacetCounts } from "@/lib/discovery/catalog/facetCounts";
import type { MarketSizeResult } from "@/lib/discovery/connectors/census";
import { ResultsSearchBar } from "@/app/components/ResultsSearchBar";
import { DiscoveryCoverageNote } from "@/app/components/DiscoveryCoverageNote";
import { WarehouseCoverageBanner } from "@/app/components/WarehouseCoverageBanner";
import { DiscoveryDiagnosticsPanel } from "@/app/components/DiscoveryDiagnosticsPanel";
import { ResultsFilterRail } from "@/app/components/ResultsFilterRail";
import { ResultsViewControls } from "@/app/components/ResultsViewControls";
import { ResultsList } from "@/app/components/ResultsList";
import {
  BrowseExperience,
  buildBrowseContext,
  resolveBrowseLenses,
} from "@/app/components/BrowseExperience";
import { BrowseLensSelector } from "@/app/components/BrowseLensSelector";
import { ResultsTable } from "@/app/components/ResultsTable";
import { ResultsLoadingState } from "@/app/components/ResultsLoadingState";
import {
  ResultsEmptyState,
  ResultsErrorState,
} from "@/app/components/ResultsEmptyState";
import { IntelligencePreview } from "@/app/components/IntelligencePreview";
import {
  initialProviderStatuses,
  ProviderStatusBar,
} from "@/app/components/ProviderStatusBar";
import { ScoutBrand } from "@/app/components/ScoutLogo";
import { SoundToggle } from "@/app/components/SoundToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";

type FetchPhase = "idle" | "search-loading" | "ready" | "enriching" | "error";

type BadgeKey = "mock" | ProviderBadgeKey;

type ProviderBadgeStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unavailable"
  | "skipped";

interface FullPhaseResponse extends SearchResponse {
  phase: "full";
  plannedProviders: ProviderBadgeKey[];
  secondaryProviders: LiveProviderKey[];
}

const SORT_OPTIONS: { key: ResultsSortKey; label: string }[] = [
  { key: "score", label: "Most relevant" },
  { key: "freshness", label: "Most recent signal" },
  { key: "evidence", label: "Most signals" },
  { key: "size", label: "Largest organizations" },
  { key: "name", label: "Alphabetical" },
];

function parseSortParam(value: string | null): ResultsSortKey {
  if (value && SORT_OPTIONS.some((o) => o.key === value)) {
    return value as ResultsSortKey;
  }
  return "score";
}

export function ResultsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const abortRef = useRef<AbortController | null>(null);

  const urlState = useMemo(
    () => resolveSearchState(parseSearchStateFromParams(searchParams)),
    [searchParams],
  );

  const [searchState, setSearchState] = useState<SearchState>(urlState);
  const [sort, setSort] = useState<ResultsSortKey>(() =>
    parseSortParam(searchParams.get("sort")),
  );
  const [allProspects, setAllProspects] = useState<Prospect[]>([]);
  const [phase, setPhase] = useState<FetchPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<ResultsDisplayMode>("browse");
  const [browseLens, setBrowseLens] = useState<BrowseLensId>(defaultBrowseLens());
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [catalogFacets, setCatalogFacets] = useState<CatalogFacetCounts | null>(
    null,
  );
  const [marketSize, setMarketSize] = useState<MarketSizeResult | null>(null);
  const [marketCoveragePercent, setMarketCoveragePercent] = useState<
    number | null
  >(null);
  const [discoveryTotals, setDiscoveryTotals] = useState<
    SearchResponse["discovery"] | null
  >(null);
  const [plannedProviders, setPlannedProviders] = useState<ProviderBadgeKey[]>(
    [],
  );
  const [coverage, setCoverage] = useState<SearchResponse["coverage"] | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<
    Record<BadgeKey, ProviderBadgeStatus>
  >(initialProviderStatuses([]));

  const syncUrl = useCallback(
    (state: SearchState) => {
      const params = searchStateToParams(state);
      router.replace(`/results?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const fetchProgressive = useCallback(async (state: SearchState) => {
    if (!state.query.trim()) {
      setPhase("idle");
      setAllProspects([]);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setPhase("search-loading");
    setError(null);
    setSelectedId(null);
    setAllProspects([]);
    setCoverage(null);
    setDiscoveryTotals(null);
    setPlannedProviders([]);
    setProviderStatuses(initialProviderStatuses([]));

    const baseBody = searchRequestBody(state);

    try {
      const fullRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, phase: "full" }),
        signal: ac.signal,
      });

      if (!fullRes.ok) {
        const data = (await fullRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Search failed. Please try again.");
      }

      const fullData = (await fullRes.json()) as FullPhaseResponse;
      if (ac.signal.aborted) return;

      setAllProspects(fullData.prospects);
      setCoverage(fullData.coverage);
      setDiscoveryTotals(fullData.discovery ?? null);
      setPlannedProviders(fullData.plannedProviders);
      setProviderStatuses(
        Object.fromEntries(
          fullData.plannedProviders.map((provider) => [provider, "ready" as const]),
        ) as Record<BadgeKey, ProviderBadgeStatus>,
      );
      setPhase("ready");

      saveWorkspace({
        query: fullData.query,
        prospects: fullData.prospects,
        savedAt: Date.now(),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    setDisplayMode(loadResultsDisplayMode());
    setBrowseLens(loadBrowseLens());
  }, []);

  useEffect(() => {
    setSearchState(urlState);
    setSort(parseSortParam(searchParams.get("sort")));
  }, [urlState, searchParams]);

  const searchFetchKey = useMemo(
    () => searchFetchFingerprint(urlState),
    [urlState],
  );

  useEffect(() => {
    if (!urlState.query.trim()) {
      setCatalogFacets(null);
      setMarketSize(null);
      setMarketCoveragePercent(null);
      return;
    }
    const ac = new AbortController();
    fetch("/api/facets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(urlState),
      signal: ac.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { facets?: CatalogFacetCounts } | null) => {
        if (data?.facets) setCatalogFacets(data.facets);
      })
      .catch(() => {
        /* facets are best-effort */
      });
    return () => ac.abort();
  }, [searchFetchKey, urlState]);

  useEffect(() => {
    if (!urlState.query.trim()) return;
    const ac = new AbortController();
    fetch("/api/market-size", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(urlState),
      signal: ac.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { marketSize?: MarketSizeResult } | null) => {
        if (data?.marketSize) setMarketSize(data.marketSize);
      })
      .catch(() => {
        /* market size is best-effort */
      });
    return () => ac.abort();
  }, [searchFetchKey, urlState]);

  useEffect(() => {
    if (!catalogFacets || !marketSize?.available) {
      setMarketCoveragePercent(null);
      return;
    }
    const indexed = catalogFacets.scopeTotal;
    if (
      marketSize.estimatedEstablishments == null ||
      marketSize.estimatedEstablishments <= 0
    ) {
      setMarketCoveragePercent(null);
      return;
    }
    setMarketCoveragePercent(
      Math.round(
        Math.min((indexed / marketSize.estimatedEstablishments) * 100, 100) * 10,
      ) / 10,
    );
  }, [catalogFacets, marketSize]);

  useEffect(() => {
    if (urlState.query.trim()) {
      fetchProgressive(urlState);
    }
    return () => abortRef.current?.abort();
    // Re-fetch only when search criteria change — not refinement filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- urlState read at fetch-key change
  }, [searchFetchKey, fetchProgressive]);

  const filtered = useMemo(
    () => sortResults(applyResultsFilters(allProspects, searchState), sort),
    [allProspects, searchState, sort],
  );

  const selected =
    filtered.find((p) => p.id === selectedId) ??
    allProspects.find((p) => p.id === selectedId) ??
    null;

  const density = displayModeToDensity(displayMode);

  const browseContext = useMemo(
    () => buildBrowseContext(filtered, searchState),
    [filtered, searchState],
  );
  const availableBrowseLenses = useMemo(
    () => resolveBrowseLenses(browseContext, filtered),
    [browseContext, filtered],
  );

  useEffect(() => {
    if (!availableBrowseLenses.some((l) => l.id === browseLens)) {
      const next = availableBrowseLenses[0]?.id ?? defaultBrowseLens();
      setBrowseLens(next);
      saveBrowseLens(next);
    }
  }, [availableBrowseLenses, browseLens]);

  function handleBrowseLensChange(next: BrowseLensId) {
    setBrowseLens(next);
    saveBrowseLens(next);
  }

  function handleSearchSubmit(q: string) {
    const next = resolveSearchState({ ...searchState, query: q });
    setSearchState(next);
    syncUrl(next);
  }

  function handleFiltersChange(partial: Partial<SearchState>) {
    const next = resolveSearchState({ ...searchState, ...partial });
    setSearchState(next);
    syncUrl(next);
  }

  function handleSortChange(key: ResultsSortKey) {
    setSort(key);
    const next: SearchState = {
      ...searchState,
      sort: key === "score" ? null : key,
    };
    setSearchState(next);
    syncUrl(next);
  }

  function handleDisplayModeChange(next: ResultsDisplayMode) {
    setDisplayMode(next);
    saveResultsDisplayMode(next);
  }

  const matchCatalogSummary =
    discoveryTotals ??
    (catalogFacets
      ? {
          totalReturned: allProspects.length,
          totalAfterRank: allProspects.length,
          catalogTotal: catalogFacets.catalogTotal,
        }
      : null);

  const indexedOrganizations =
    catalogFacets?.scopeTotal ?? matchCatalogSummary?.catalogTotal ?? null;
  const discoveryMetadata = discoveryTotals?.metadata ?? null;

  const summary = describeSearch(searchState);
  const sourceSummary = formatSourceSummary(filtered.length, filtered);
  const coverageSummary = coverage
    ? ` · ${coverage.coveragePercent}% coverage · ${Math.round(coverage.confidence * 100)}% confidence`
    : "";
  const hasQuery = Boolean(searchState.query.trim());
  const showResults =
    allProspects.length > 0 &&
    (phase === "search-loading" || phase === "ready" || phase === "enriching");
  const showMockSkeleton =
    phase === "search-loading" && allProspects.length === 0;
  const isFilteredSubset = filtered.length !== allProspects.length;
  const enriching = false;

  return (
    <div className="flex min-h-full flex-col bg-surface text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-[90rem] items-center justify-between gap-4 px-4 lg:px-8">
          <Link href="/" className="shrink-0">
            <ScoutBrand size={28} />
          </Link>
          <span className="label-mono hidden text-muted-2 sm:inline">
            Organization search
          </span>
          <div className="flex items-center gap-2">
            <SoundToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="results-search-band sticky top-12 z-30 border-b backdrop-blur-md">
        <div className="mx-auto max-w-[90rem] px-4 py-3 lg:px-8 lg:py-4">
          <ResultsSearchBar
            value={searchState.query}
            onSubmit={handleSearchSubmit}
            persistent
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-4 lg:px-8 lg:py-6">
        {!hasQuery ? (
          <ResultsEmptyState variant="no-query" />
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
            <ResultsFilterRail
              state={searchState}
              onChange={handleFiltersChange}
              prospects={allProspects}
              catalogFacets={catalogFacets}
            />

            <main className="min-w-0 flex-1">
              {hasQuery && (discoveryMetadata || matchCatalogSummary) ? (
                <WarehouseCoverageBanner
                  displayedCount={filtered.length}
                  warehouseTotal={
                    discoveryTotals?.totalAfterRank ?? allProspects.length
                  }
                  searchState={searchState}
                  metadata={discoveryMetadata}
                  prospects={allProspects}
                  orgTypeLabel={
                    searchState.organizationType === "health-plan"
                      ? "health plans"
                      : undefined
                  }
                />
              ) : null}

              <div className="results-toolbar mb-4 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                    {filtered.length.toLocaleString()} result
                    {filtered.length === 1 ? "" : "s"}
                  </h1>
                  <p className="mt-1 text-sm text-muted">{summary}</p>
                  {showResults || phase === "ready" ? (
                    <p className="mt-1 font-mono text-xs text-muted-2">
                      {sourceSummary}
                      {coverageSummary}
                      {isFilteredSubset ? (
                        <>
                          {" "}
                          · {allProspects.length.toLocaleString()} before filters
                        </>
                      ) : null}
                      {matchCatalogSummary && indexedOrganizations != null ? (
                        <>
                          {" "}
                          · {indexedOrganizations.toLocaleString()} indexed
                        </>
                      ) : null}
                      {marketCoveragePercent != null ? (
                        <> · {marketCoveragePercent}% market coverage</>
                      ) : null}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <ResultsViewControls
                    value={displayMode}
                    onChange={handleDisplayModeChange}
                  />
                  <div className="flex items-center gap-2">
                    <span className="label-mono shrink-0 text-muted-2">Sort</span>
                    <select
                      value={sort}
                      onChange={(e) =>
                        handleSortChange(e.target.value as ResultsSortKey)
                      }
                      className="min-w-[10rem] rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-accent"
                      aria-label="Sort results"
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {hasQuery &&
              phase !== "idle" &&
              !discoveryMetadata?.connectorCandidates ? (
                <div className="mb-4 overflow-x-auto">
                  <ProviderStatusBar
                    statuses={providerStatuses}
                    planned={plannedProviders}
                  />
                </div>
              ) : null}

              {discoveryMetadata?.connectorCandidates ? (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => setShowDiagnostics((v) => !v)}
                    className="font-mono text-[0.6875rem] text-muted-2 transition hover:text-muted"
                  >
                    {showDiagnostics ? "Hide" : "Show"} discovery diagnostics
                  </button>
                  {showDiagnostics ? (
                    <div className="mt-2">
                      <DiscoveryDiagnosticsPanel
                        metadata={discoveryMetadata}
                        displayedCount={filtered.length}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showMockSkeleton ? <ResultsLoadingState compact /> : null}

              {phase === "error" ? (
                <ResultsErrorState
                  message={error ?? "Search failed."}
                  onRetry={() => fetchProgressive(searchState)}
                />
              ) : null}

              {phase === "ready" && filtered.length === 0 && !showMockSkeleton ? (
                allProspects.length === 0 && discoveryMetadata ? (
                  <DiscoveryCoverageNote metadata={discoveryMetadata} emphasis />
                ) : (
                  <ResultsEmptyState
                    variant={
                      allProspects.length === 0 ? "no-results" : "filtered-out"
                    }
                  />
                )
              ) : null}

              {showResults && filtered.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {discoveryMetadata ? (
                    <DiscoveryCoverageNote metadata={discoveryMetadata} />
                  ) : null}

                  {displayMode === "table" ? (
                    <ResultsTable
                      prospects={filtered}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                    />
                  ) : displayMode === "browse" ? (
                    <>
                      <BrowseLensSelector
                        lenses={availableBrowseLenses}
                        value={browseLens}
                        onChange={handleBrowseLensChange}
                      />
                      <BrowseExperience
                        prospects={filtered}
                        searchState={searchState}
                        browseLens={browseLens}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onApplyFilter={handleFiltersChange}
                      />
                    </>
                  ) : (
                    <ResultsList
                      prospects={filtered}
                      density={density}
                      enriching={enriching}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                    />
                  )}
                </div>
              ) : null}
            </main>
          </div>
        )}
      </div>

      <IntelligencePreview
        prospect={selected}
        open={selectedId !== null && selected !== null}
        onClose={() => setSelectedId(null)}
        variant="drawer"
      />
    </div>
  );
}
