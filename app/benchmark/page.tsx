import { runBenchmark } from "@/lib/discovery/benchmark";

export const metadata = {
  title: "Search Quality Benchmark",
  robots: "noindex",
};

export default async function BenchmarkPage() {
  const report = await runBenchmark();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Internal · Discovery Engine v1
        </p>
        <h1 className="mt-1 text-2xl font-medium">Search Quality Benchmark</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Regression suite · {report.queries.length} queries · catalog{" "}
          {report.catalogTotal.toLocaleString()} orgs · avg {report.avgLatencyMs}ms · p95{" "}
          {report.p95LatencyMs}ms · {new Date(report.generatedAt).toLocaleString()}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {report.queries.map((result) => (
          <section key={result.query} className="card-float p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">&ldquo;{result.query}&rdquo;</h2>
              <span className="text-sm tabular-nums text-[var(--muted)]">
                {result.resultCount} results · avg relevance {result.avgRelevance} ·
                avg confidence {result.avgConfidence} · coverage {result.coveragePercent}% ·
                benchmark confidence {Math.round(result.confidence * 100)}%
              </span>
            </div>

            {result.topResults.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Top results
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  {result.topResults.map((r) => (
                    <li key={r.name} className="flex justify-between gap-4">
                      <span>{r.name}</span>
                      <span className="shrink-0 tabular-nums text-[var(--muted)]">
                        {r.relevance} / {Math.round(r.confidence * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Results by connector
                </p>
                <ul className="mt-1 text-sm text-[var(--muted)]">
                  {result.connectorBreakdown.length === 0 ? (
                    <li>—</li>
                  ) : (
                    result.connectorBreakdown.map((c) => (
                      <li key={c.connectorId}>
                        {c.connectorId} ({c.count})
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Coverage gaps
                </p>
                <ul className="mt-1 text-sm text-[var(--muted)]">
                  {result.coverageGaps.length === 0 ? (
                    <li>None detected</li>
                  ) : (
                    result.coverageGaps.map((gap) => <li key={gap}>{gap}</li>)
                  )}
                </ul>
              </div>
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Top industries
                </p>
                <ul className="mt-1 text-sm text-[var(--muted)]">
                  {result.topIndustries.length === 0 ? (
                    <li>—</li>
                  ) : (
                    result.topIndustries.map((i) => (
                      <li key={i.industry}>
                        {i.industry} ({i.count})
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Top organization types
                </p>
                <ul className="mt-1 text-sm text-[var(--muted)]">
                  {result.topOrganizationTypes.length === 0 ? (
                    <li>—</li>
                  ) : (
                    result.topOrganizationTypes.map((o) => (
                      <li key={o.organizationType}>
                        {o.organizationType} ({o.count})
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-[var(--muted)]">
        <a href="/diagnostics" className="underline hover:text-[var(--foreground)]">
          View catalog diagnostics
        </a>
      </p>
    </main>
  );
}
