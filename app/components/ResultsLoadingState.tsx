export function ResultsLoadingState({ compact = false }: { compact?: boolean }) {
  const rows = compact ? 2 : 5;
  return (
    <div className="space-y-0 overflow-hidden rounded-xl border border-border bg-surface/30" aria-busy="true" aria-live="polite">
      <span className="sr-only">Scanning intelligence sources…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="relative border-b border-border/50 px-4 py-4 last:border-b-0"
        >
          <div
            className="scout-scan-line pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-accent-cyan/10 to-transparent"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-16 rounded bg-border-strong/50" />
              <div className="h-4 w-2/5 max-w-xs rounded bg-border-strong/40" />
              <div className="h-3 w-3/5 max-w-sm rounded bg-border/60" />
              <div className="flex gap-1.5 pt-1">
                <div className="h-5 w-14 rounded-md bg-source-cms/10" />
                <div className="h-5 w-14 rounded-md bg-source-sec/10" />
                <div className="h-5 w-12 rounded-md bg-source-rss/10" />
              </div>
            </div>
            <div className="h-10 w-12 shrink-0 rounded-lg bg-border-strong/40" />
          </div>
        </div>
      ))}
    </div>
  );
}