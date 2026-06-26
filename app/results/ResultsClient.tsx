"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Prospect, SearchQuery } from "@/lib/search/types";
import { mergeProspectLists } from "@/lib/search/mergeProspects";
import type { ProviderBadgeKey } from "@/lib/search/providerPlan";
import type { LiveProviderKey } from "@/lib/search/providerPlan";
import { searchRequestBody } from "@/lib/search/progressiveSearch";
import {
  describeSearch,
  parseSearchStateFromParams,
  resolveSearchState,
  searchStateToParams,
  type SearchState,
} from "@/lib/search/searchState";
import {
  applyResultsFilters,
  sortResults,
  type ResultsSortKey,
} from "@/lib/search/resultsFilters";
import { saveWorkspace } from "@/lib/intelligence/session";
import { ResultsSearchBar } from "@/app/components/ResultsSearchBar";
import { ResultsFilterRail } from "@/app/components/ResultsFilterRail";
import { ResultRow } from "@/app/components/ResultRow";
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
  phase: "mock";
  plannedProviders: ProviderBadgeKey[];
  secondaryProviders: LiveProviderKey[];
}

interface ProviderPhaseResponse {
  phase: "provider";
  provider: LiveProviderKey;
  status: "ready" | "unavailable" | "skipped";
  prospects: Prospect[];
  ms: number;
}

const SORT_OPTIONS: { key: ResultsSortKey; label: string }[] = [
  { key: "score", label: "Opportunity Score" },
  { key: "freshness", label: "Freshness" },
  { key: "evidence", label: "Evidence Count" },
  { key: "name", label: "Organization Name" },
];

export function ResultsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const abortRef = useRef<AbortController | null>(null);

  const urlState = useMemo(
    () => resolveSearchState(parseSearchStateFromParams(searchParams)),
    [searchParams],
  );

  const [searchState, setSearchState] = useState<SearchState>(urlState);
  const [sort, setSort] = useState<ResultsSortKey>("score");
  const [allProspects, setAllProspects] = useState<Prospect[]>([]);
  const [phase, setPhase] = useState<FetchPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [plannedProviders, setPlannedProviders] = useState<ProviderBadgeKey[]>(
    [],
  );
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
    setSearchState(urlState);
  }, [urlState]);

  useEffect(() => {
    if (urlState.query.trim()) {
      fetchProgressive(urlState);
    }
    return () => abortRef.current?.abort();
  }, [urlState.query, urlState.sellerContext, urlState, fetchProgressive]);

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
    if (partial.sellerContext !== undefined && searchState.query.trim()) {
      fetchProgressive(next);
    }
  }

  const summary = describeSearch(searchState);
  const hasQuery = Boolean(searchState.query.trim());
  const showResults =
    allProspects.length > 0 &&
    (phase === "enriching" || phase === "ready" || phase === "mock-loading");
  const showMockSkeleton =
    phase === "mock-loading" && allProspects.length === 0;

  return (
    <div className="min-h-full overflow-x-hidden bg-background">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between gap-4 px-4 lg:px-8">
          <Link href="/" className="shrink-0">
            <ScoutBrand size={32} />
          </Link>
          <div className="hidden flex-1 justify-center sm:flex">
            <ResultsSearchBar
              value={searchState.query}
              onSubmit={handleSearchSubmit}
              compact
            />
          </div>
          <span className="label-mono hidden text-muted-2 md:inline">
            Results
          </span>
        </div>
        <div className="border-t border-border/60 px-4 py-3 sm:hidden">
          <ResultsSearchBar
            value={searchState.query}
            onSubmit={handleSearchSubmit}
          />
        </div>
      </header>

      <div className="mx-auto max-w-[90rem] px-3 py-4 sm:px-4 sm:py-5 lg:px-8 lg:py-6">
        {!hasQuery ? (
          <ResultsEmptyState variant="no-query" />
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-muted">{summary}</p>
                {showResults || phase === "ready" ? (
                  <p className="mt-1 font-mono text-xs text-muted-2">
                    <span className="text-accent-cyan">{filtered.length}</span>
                    {filtered.length !== allProspects.length
                      ? ` of ${allProspects.length}`
                      : ""}{" "}
                    organizations
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
              <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                <span className="label-mono shrink-0">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ResultsSortKey)}
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

            <div className="mt-4 flex flex-col gap-4 lg:mt-6 lg:flex-row lg:gap-6">
              <ResultsFilterRail
                state={searchState}
                onChange={handleFiltersChange}
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
                  <ResultsEmptyState
                    variant={
                      allProspects.length === 0 ? "no-results" : "filtered-out"
                    }
                  />
                ) : null}

                {showResults && filtered.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-surface/30">
                    <div
                      className="hidden border-b border-border/80 bg-surface-2/50 px-4 py-2.5 lg:grid lg:grid-cols-[minmax(0,1.2fr)_5rem_minmax(0,1fr)_4.5rem_5rem] lg:gap-3"
                      aria-hidden
                    >
                      <span className="label-mono">Organization</span>
                      <span className="label-mono text-center">Score</span>
                      <span className="label-mono">Signals</span>
                      <span className="label-mono text-right">Evidence</span>
                      <span className="label-mono text-right">Fresh</span>
                    </div>
                    <div className="divide-y divide-border/50">
                      {filtered.map((prospect, i) => (
                        <ResultRow
                          key={prospect.id}
                          prospect={prospect}
                          rank={i + 1}
                          selected={prospect.id === selectedId}
                          onSelect={() => setSelectedId(prospect.id)}
                        />
                      ))}
                    </div>
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
