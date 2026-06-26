export function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Resolving buyer signals…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-2xl border border-border bg-surface/60 p-5"
        >
          <div
            className="scout-scan-line pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-accent-cyan/8 to-transparent"
            style={{ animationDelay: `${i * 0.35}s` }}
          />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-2.5 w-24 rounded bg-border-strong/80" />
              <div className="h-4 w-1/2 rounded bg-border-strong/60" />
              <div className="h-3 w-1/3 rounded bg-border/80" />
            </div>
            <div className="h-9 w-12 rounded bg-border-strong/60" />
          </div>
          <div className="mt-5 space-y-2">
            <div className="h-3 w-full rounded bg-border/70" />
            <div className="h-3 w-5/6 rounded bg-border/60" />
            <div className="h-3 w-2/3 rounded bg-border/50" />
          </div>
        </div>
      ))}
    </div>
  );
}
