"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  aggregateSectorCoverage,
  catalogNodeIsSearchable,
  catalogNodeToSearchState,
  topLevelCatalogNodes,
  type IndustryCatalogNode,
} from "@/lib/catalog";
import { searchStateToParams } from "@/lib/search/searchState";
import { CoverageBadge } from "./CoverageBadge";
import { useInteractionFeedback } from "./InteractionProvider";

function CatalogTile({
  node,
  coverage,
  onClick,
  variant,
  disabled,
}: {
  node: IndustryCatalogNode;
  coverage: ReturnType<typeof aggregateSectorCoverage>;
  onClick: () => void;
  variant: "homepage" | "page";
  disabled?: boolean;
}) {
  const isHome = variant === "homepage";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`interactive-press flex h-full w-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        isHome
          ? "border-white/25 bg-[#06141f] text-white shadow-[0_8px_32px_rgba(0,0,0,0.34)] hover:border-cyan-200/45 hover:bg-[#06141f]"
          : "border-border bg-surface-2 text-foreground hover:border-accent/40 hover:bg-surface"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
            isHome ? "bg-white/[0.08]" : "bg-surface border border-border"
          }`}
          aria-hidden
        >
          {node.icon ?? "🏢"}
        </span>
        <CoverageBadge status={coverage} compact={isHome} />
      </div>
      <span
        className={`text-sm font-semibold leading-tight ${
          isHome ? "text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.75)]" : ""
        }`}
      >
        {node.label}
      </span>
      <span
        className={`text-xs leading-snug line-clamp-2 ${
          isHome ? "text-white/85" : "text-muted"
        }`}
      >
        {node.description}
      </span>
      {node.children && node.children.length > 0 ? (
        <span
          className={`mt-auto font-mono text-[0.625rem] ${
            isHome ? "text-cyan-300/90" : "text-accent-cyan"
          }`}
        >
          {node.children.length} sub-industries →
        </span>
      ) : null}
    </button>
  );
}

export function IndustryCatalog({
  variant = "page",
  showLegend = true,
}: {
  variant?: "homepage" | "page";
  showLegend?: boolean;
}) {
  const router = useRouter();
  const { feedback } = useInteractionFeedback();
  const [path, setPath] = useState<IndustryCatalogNode[]>([]);

  const current = path.length > 0 ? path[path.length - 1]! : null;
  const nodes = useMemo(
    () =>
      current?.children?.length ? current.children : topLevelCatalogNodes(),
    [current],
  );

  const launchSearch = useCallback(
    (node: IndustryCatalogNode) => {
      if (!catalogNodeIsSearchable(node)) return;
      feedback("select");
      const state = catalogNodeToSearchState(node);
      router.push(`/results?${searchStateToParams(state).toString()}`);
    },
    [feedback, router],
  );

  function handleNodeClick(node: IndustryCatalogNode) {
    if (node.children && node.children.length > 0) {
      feedback("select");
      setPath((p) => [...p, node]);
      return;
    }
    launchSearch(node);
  }

  function handleSearchSector() {
    if (!current) return;
    launchSearch(current);
  }

  const isHome = variant === "homepage";

  return (
    <div className={isHome ? "" : "mx-auto max-w-6xl"}>
      {showLegend ? (
        <div
          className={`mb-4 flex flex-wrap items-center gap-3 ${
            isHome ? "justify-center" : ""
          }`}
        >
          <CoverageBadge status="warehouse" />
          <CoverageBadge status="live-discovery" />
          <CoverageBadge status="planned" />
        </div>
      ) : null}

      {path.length > 0 ? (
        <nav
          aria-label="Industry catalog breadcrumb"
          className={`mb-4 flex flex-wrap items-center gap-2 text-sm ${
            isHome ? "justify-center text-white/80" : "text-muted"
          }`}
        >
          <button
            type="button"
            onClick={() => setPath([])}
            className={`font-mono text-xs transition hover:text-foreground ${
              isHome ? "text-cyan-300 hover:text-white" : "text-accent-cyan"
            }`}
          >
            All industries
          </button>
          {path.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-2">
              <span aria-hidden>/</span>
              {i < path.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setPath(path.slice(0, i + 1))}
                  className={`font-mono text-xs transition ${
                    isHome
                      ? "text-cyan-300/80 hover:text-white"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {crumb.label}
                </button>
              ) : (
                <span className={isHome ? "text-white" : "text-foreground"}>
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      {current ? (
        <div className={`mb-4 ${isHome ? "text-center" : ""}`}>
          <h2
            className={`text-lg font-semibold tracking-tight ${
              isHome ? "text-white" : "text-foreground"
            }`}
          >
            {current.label}
          </h2>
          <p
            className={`mt-1 text-sm ${isHome ? "text-white/75" : "text-muted"}`}
          >
            {current.description}
          </p>
          {catalogNodeIsSearchable(current) ? (
            <button
              type="button"
              onClick={handleSearchSector}
              className={`mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-xs transition ${
                isHome
                  ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20"
                  : "border-border bg-surface-2 text-foreground hover:border-accent"
              }`}
            >
              Search all {current.label.toLowerCase()} →
            </button>
          ) : null}
        </div>
      ) : isHome ? (
        <h2
          id="industry-catalog-heading"
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]"
        >
          Browse by industry
        </h2>
      ) : (
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Industry Catalog
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Explore every sector Prospect Scout covers. Warehouse-backed industries
            use curated intelligence; others run live multi-connector discovery while
            coverage expands.
          </p>
        </header>
      )}

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {nodes.map((node) => {
          const coverage = node.children?.length
            ? aggregateSectorCoverage(node)
            : node.coverage;
          const searchable = catalogNodeIsSearchable(node);
          return (
            <CatalogTile
              key={node.id}
              node={node}
              coverage={coverage}
              variant={variant}
              disabled={!searchable && !node.children?.length}
              onClick={() => handleNodeClick(node)}
            />
          );
        })}
      </div>

      {!isHome ? (
        <p className="mt-8 text-center font-mono text-xs text-muted-2">
          <Link href="/" className="text-accent-cyan hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-center">
          <Link
            href="/catalog"
            className="font-mono text-xs text-cyan-300/90 transition hover:text-white"
          >
            View full industry catalog →
          </Link>
        </p>
      )}
    </div>
  );
}
