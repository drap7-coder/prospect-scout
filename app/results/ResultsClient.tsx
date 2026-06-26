"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Prospect, SearchResponse } from "@/lib/search/types";
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
import { MeridianMark } from "@/app/components/ScoutMeridian";

type Status = "idle" | "loading" | "done" | "error";

const SORT_OPTIONS: { key: ResultsSortKey; label: string }[] = [
  { key: "score", label: "Opportunity Score" },
  { key: "freshness", label: "Freshness" },
  { key: "evidence", label: "Evidence Count" },
  { key: "name", label: "Organization Name" },
];

export function ResultsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlState = useMemo(
    () => resolveSearchState(parseSearchStateFromParams(searchParams)),
    [searchParams],
  );

  const [searchState, setSearchState] = useState<SearchState>(urlState);
  const [sort, setSort] = useState<ResultsSortKey>("score");
  const [allProspects, setAllProspects] = useState<Prospect[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const syncUrl = useCallback(
    (state: SearchState) => {
      const params = searchStateToParams(state);
      router.replace(`/results?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const fetchResults = useCallback(async (state: SearchState) => {
    if (!state.query.trim()) {
      setStatus("idle");
      setAllProspects([]);
      return;
    }

    setStatus("loading");
    setError(null);
    setSelectedId(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: state.query,
          industry: state.industry,
          organizationType: state.organizationType,
          location: state.location,
          companySize: state.companySize,
          sellerContext: state.sellerContext,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Search failed. Please try again.");
      }

      const data = (await res.json()) as SearchResponse;
      setAllProspects(data.prospects);
      saveWorkspace({
        query: data.query,
        prospects: data.prospects,
        savedAt: Date.now(),
      });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    setSearchState(urlState);
  }, [urlState]);

  useEffect(() => {
    if (urlState.query.trim()) {
      fetchResults(urlState);
    }
  }, [urlState.query, urlState.sellerContext, urlState, fetchResults]);

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

  function handleAdvancedSubmit(e: FormEvent) {
    e.preventDefault();
    syncUrl(searchState);
    fetchResults(searchState);
  }

  const summary = describeSearch(searchState);
  const hasQuery = Boolean(searchState.query.trim());

  return (
    <div className="min-h-full bg-background">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between gap-4 px-4 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <MeridianMark className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Prospect Scout
            </span>
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

      <div className="mx-auto max-w-[90rem] px-4 py-5 lg:px-8 lg:py-6">
        {!hasQuery ? (
          <ResultsEmptyState variant="no-query" />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-4">
              <div className="min-w-0">
                <p className="text-sm text-muted">{summary}</p>
                {status === "done" ? (
                  <p className="mt-1 font-mono text-xs text-muted-2">
                    <span className="text-accent-cyan">{filtered.length}</span>
                    {filtered.length !== allProspects.length
                      ? ` of ${allProspects.length}`
                      : ""}{" "}
                    organizations
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="label-mono">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ResultsSortKey)}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-accent"
                  aria-label="Sort results"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="rounded-lg border border-border px-3 py-2 font-mono text-xs text-muted transition hover:text-foreground"
                >
                  {showAdvanced ? "Hide" : "Advanced"}
                </button>
              </div>
            </div>

            {showAdvanced ? (
              <form
                onSubmit={handleAdvancedSubmit}
                className="mt-4 rounded-xl border border-border/80 bg-surface/40 p-4"
              >
                <p className="label-mono text-muted-2">
                  Optional seller context
                </p>
                <p className="mt-1 text-xs text-muted">
                  Refine ranking when you know what you sell — not required for
                  company discovery.
                </p>
                <input
                  type="text"
                  value={searchState.sellerContext ?? ""}
                  onChange={(e) =>
                    setSearchState((s) => ({
                      ...s,
                      sellerContext: e.target.value || null,
                    }))
                  }
                  placeholder="e.g. PBM consulting, packaging automation"
                  className="mt-3 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="mt-3 rounded-lg bg-surface-2 px-4 py-2 text-xs font-medium text-foreground ring-1 ring-border transition hover:ring-accent/40"
                >
                  Apply &amp; re-run search
                </button>
              </form>
            ) : null}

            <div className="mt-5 flex gap-6 lg:mt-6">
              <ResultsFilterRail
                state={searchState}
                onChange={handleFiltersChange}
              />

              <div className="min-w-0 flex-1">
                {status === "loading" ? <ResultsLoadingState /> : null}

                {status === "error" ? (
                  <ResultsErrorState
                    message={error ?? "Search failed."}
                    onRetry={() => fetchResults(searchState)}
                  />
                ) : null}

                {status === "done" && filtered.length === 0 ? (
                  <ResultsEmptyState
                    variant={
                      allProspects.length === 0 ? "no-results" : "filtered-out"
                    }
                  />
                ) : null}

                {status === "done" && filtered.length > 0 ? (
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
