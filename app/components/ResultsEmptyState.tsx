import Link from "next/link";
import { MeridianMark } from "./ScoutMeridian";
import { EXAMPLE_SEARCHES } from "@/lib/search/searchState";

export function ResultsEmptyState({
  variant,
}: {
  variant: "no-query" | "no-results" | "filtered-out";
}) {
  if (variant === "no-query") {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <MeridianMark className="mx-auto h-8 w-8 text-accent-cyan/70" />
        <p className="mt-6 text-base font-medium text-foreground">
          Start with a company search
        </p>
        <p className="mt-2 text-sm text-muted">
          Search by industry, organization type, location, or public signals.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Go to search
        </Link>
      </div>
    );
  }

  if (variant === "filtered-out") {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/30 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No organizations match your filters
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Try clearing filters or broadening location and signal criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/30 px-6 py-16 text-center">
      <MeridianMark className="mx-auto h-7 w-7 text-muted-2" />
      <p className="mt-5 text-sm font-medium text-foreground">
        No results found
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Providers may be unavailable for this query, or the search may be too
        narrow. Try a broader search or one of these examples:
      </p>
      <ul className="mx-auto mt-6 flex max-w-lg flex-wrap justify-center gap-2">
        {EXAMPLE_SEARCHES.slice(0, 4).map((ex) => (
          <li key={ex}>
            <Link
              href={`/results?q=${encodeURIComponent(ex)}`}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted transition hover:border-accent/40 hover:text-foreground"
            >
              {ex}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResultsErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const providerUnavailable = /unavailable|timeout|failed/i.test(message);

  return (
    <div className="rounded-xl border border-warn/30 bg-warn/5 px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">
        {providerUnavailable
          ? "Some intelligence sources are unavailable"
          : "Search could not complete"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{message}</p>
      <p className="mx-auto mt-3 max-w-md text-xs text-muted-2">
        Mock fallback data may still appear when live providers fail. Try again
        or broaden your search.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/40"
      >
        Retry search
      </button>
    </div>
  );
}
