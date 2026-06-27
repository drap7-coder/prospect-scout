"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Prospect, SearchQuery, SearchResponse } from "@/lib/search/types";
import { mergeProspectLists } from "@/lib/search/mergeProspects";
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
  loadResultDensity,
  saveResultDensity,
  type ResultDensity,
} from "@/lib/intelligence/resultDensity";
import type { CatalogFacetCounts } from "@/lib/discovery/catalog/facetCounts";
import type { MarketSizeResult } from "@/lib/discovery/connectors/census";
import {
  DEFAULT_RESULT_VIEW,
  type ResultView,
} from "@/lib/discovery/discoveryRows";
import { ResultsSearchBar } from "@/app/components/ResultsSearchBar";
import { DiscoveryCoverageNote } from "@/app/components/DiscoveryCoverageNote";
import { ResultsFilterRail } from "@/app/components/ResultsFilterRail";
import { ResultViewToggle } from "@/app/components/ResultViewToggle";
import { DiscoveryView } from "@/app/components/DiscoveryView";
import { ResultsList } from "@/app/components/ResultsList";
import { ResultDensityToggle } from "@/app/components/ResultDensityToggle";
import { ResultsLoadingState } from "@/app/components/ResultsLoadingState";
import {
  ResultsEmptyState,
  ResultsErrorState,
} from "@/app/components/ResultsEmptyState";
import { IntelligencePreview } from "@/app/components/IntelligencePreview";
import {
  initialProviderStatuses,
  markProvidersLoading,
  ProviderStatusBar,
} from "@/app/components/ProviderStatusBar";
import { ScoutBrand } from "@/app/components/ScoutLogo";
import { SoundToggle } from "@/app/components/SoundToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";

type FetchPhase = "idle" | "mock-loading" | "ready" | "enriching" | "error";

type BadgeKey = "mock" | ProviderBadgeKey;

type ProviderBadgeStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unavailable"
  | "skipped";

interface MockPhaseResponse {
  query: SearchQuery;
  prospects: Prospect[];
  coverage: SearchResponse["coverage"];
  discovery?: SearchResponse["discovery"];
  phase: "mock";
  plannedProviders: ProviderBadgeKey[];
  secondaryProviders: LiveProviderKey[];
}

interface ProviderPhaseResponse {
  phase: "provider";
  provider: LiveProviderKey;
  status: "ready" | "unavailable" | "skipped";
  prospects: Prospect[];
  coverage: SearchResponse["coverage"];
  ms: number;
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
  const [view, setView] = useState<ResultView>(DEFAULT_RESULT_VIEW);
  const [density, setDensity] = useState<ResultDensity>("comfortable");
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

    setPhase("mock-loading");
    setError(null);
    setSelectedId(null);
    setAllProspects([]);
    setCoverage(null);
    setDiscoveryTotals(null);
    setPlannedProviders([]);
    setProviderStatuses(initialProviderStatuses([]));

    const baseBody = searchRequestBody(state);

    try {
      const mockRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, phase: "mock" }),
        signal: ac.signal,
      });

      if (!mockRes.ok) {
        const data = (await mockRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Search failed. Please try again.");
      }

      const mockData = (await mockRes.json()) as MockPhaseResponse;
      if (ac.signal.aborted) return;

      setAllProspects(mockData.prospects);
      setCoverage(mockData.coverage);
      setDiscoveryTotals(mockData.discovery ?? null);
      setPlannedProviders(mockData.plannedProviders);
      setPhase("enriching");
      setProviderStatuses(
        markProvidersLoading(
          initialProviderStatuses(mockData.plannedProviders),
          mockData.plannedProviders,
        ),
      );

      saveWorkspace({
        query: mockData.query,
        prospects: mockData.prospects,
        savedAt: Date.now(),
      });

      const primary = mockData.plannedProviders;
      const secondary = mockData.secondaryProviders ?? [];

      await Promise.allSettled(
        primary.map(async (provider) => {
          try {
            const res = await fetch("/api/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...baseBody,
                phase: "provider",
                provider,
              }),
              signal: ac.signal,
            });
            if (!res.ok || ac.signal.aborted) return;

            const data = (await res.json()) as ProviderPhaseResponse;
            if (ac.signal.aborted) return;

            setAllProspects((prev) => {
              const merged = mergeProspectLists(prev, data.prospects);
              saveWorkspace({
                query: mockData.query,
                prospects: merged,
                savedAt: Date.now(),
              });
              return merged;
            });

            setProviderStatuses((s) => ({
              ...s,
              [provider]:
                data.status === "skipped" ? "skipped" : data.status,
            }));
          } catch (err) {
            if (ac.signal.aborted) return;
            if (err instanceof DOMException && err.name === "AbortError") {
              return;
            }
            setProviderStatuses((s) => ({
              ...s,
              [provider]: "unavailable",
            }));
          }
        }),
      );

      if (ac.signal.aborted) return;

      for (const provider of secondary) {
        try {
          const res = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...baseBody,
              phase: "provider",
              provider,
            }),
            signal: ac.signal,
          });
          if (!res.ok || ac.signal.aborted) continue;

          const data = (await res.json()) as ProviderPhaseResponse;
          if (ac.signal.aborted) continue;

          setAllProspects((prev) => mergeProspectLists(prev, data.prospects));
        } catch {
          /* public web is best-effort */
        }
      }

      if (!ac.signal.aborted) {
        setPhase("ready");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    setDensity(loadResultDensity());
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

  function handleDensityChange(next: ResultDensity) {
    setDensity(next);
    saveResultDensity(next);
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
    ? ` · coverage ${coverage.coveragePercent}% · confidence ${Math.round(coverage.confidence * 100)}%`
    : "";
  const hasQuery = Boolean(searchState.query.trim());
  const showResults =
    allProspects.length > 0 &&
    (phase === "enriching" || phase === "ready" || phase === "mock-loading");
  const showMockSkeleton =
    phase === "mock-loading" && allProspects.length === 0;

  return (
    <div className="relative min-h-full overflow-x-hidden bg-[linear-gradient(180deg,#020b16_0%,#052335_18rem,#0b4a53_24rem,#f7f8fa_35rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_50%_0%,rgba(45,212,191,0.18),transparent_32%),radial-gradient(circle_at_82%_8%,rgba(37,99,235,0.18),transparent_24%)]"
      />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#020b16]/78 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between gap-4 px-4 lg:px-8">
          <Link
            href="/"
            className="shrink-0 [&_span:first-child]:text-white"
          >
            <ScoutBrand size={32} />
          </Link>
          <div className="hidden flex-1 justify-center sm:flex">
            <ResultsSearchBar
              value={searchState.query}
              onSubmit={handleSearchSubmit}
              compact
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="label-mono hidden text-white/55 md:inline">
              Results
            </span>
            <SoundToggle />
            <ThemeToggle />
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-3 sm:hidden">
          <ResultsSearchBar
            value={searchState.query}
            onSubmit={handleSearchSubmit}
          />
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[90rem] px-3 py-4 sm:px-4 sm:py-5 lg:px-8 lg:py-6">
        {!hasQuery ? (
          <ResultsEmptyState variant="no-query" />
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#06141f]/82 p-4 text-white shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:p-5">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-white/80">{summary}</p>
                {showResults || phase === "ready" ? (
                  <p className="mt-1 font-mono text-xs text-white/50">
                    {sourceSummary}
                    {coverageSummary}
                    {filtered.length !== allProspects.length ? (
                      <>
                        {" "}
                        ·{" "}
                        <span className="text-white/70">
                          {filtered.length} after filters
                        </span>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {hasQuery && phase !== "idle" ? (
                  <div className="mt-3 overflow-x-auto">
                    <ProviderStatusBar
                      statuses={providerStatuses}
                      planned={plannedProviders}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                <ResultViewToggle value={view} onChange={setView} />
                <ResultDensityToggle value={density} onChange={handleDensityChange} />
                <div className="flex items-center gap-2">
                <span className="label-mono shrink-0 text-white/55">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value as ResultsSortKey)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-accent sm:flex-none"
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

            <div className="mt-4 flex flex-col gap-4 lg:mt-6 lg:flex-row lg:gap-6">
              <ResultsFilterRail
                state={searchState}
                onChange={handleFiltersChange}
                prospects={allProspects}
                catalogFacets={catalogFacets}
              />

              <div className="min-w-0 flex-1">
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
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <DiscoveryCoverageNote metadata={discoveryMetadata} />
                    {matchCatalogSummary ? (
                      <p className="font-mono text-xs text-muted-2">
                        Showing{" "}
                        {matchCatalogSummary.totalReturned.toLocaleString()} of{" "}
                        {matchCatalogSummary.totalAfterRank.toLocaleString()}{" "}
                        matches
                        {indexedOrganizations != null ? (
                          <>
                            {" "}
                            · {indexedOrganizations.toLocaleString()} indexed
                          </>
                        ) : null}
                        {marketSize?.available &&
                        marketSize.estimatedEstablishments != null ? (
                          <>
                            {" "}
                            ·{" "}
                            {marketSize.estimatedEstablishments.toLocaleString()}{" "}
                            est. market
                          </>
                        ) : null}
                        {marketCoveragePercent != null ? (
                          <> · {marketCoveragePercent}% coverage</>
                        ) : null}
                      </p>
                    ) : null}

                    {view === "discovery" ? (
                      <DiscoveryView
                        prospects={filtered}
                        density={density}
                        enriching={phase === "enriching"}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                      />
                    ) : (
                      <ResultsList
                        prospects={filtered}
                        density={density}
                        enriching={phase === "enriching"}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                      />
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </>
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
