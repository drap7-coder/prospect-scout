export function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Scouting prospects…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-border bg-surface/60 p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-2.5 w-24 rounded bg-border-strong" />
              <div className="h-4 w-1/2 rounded bg-border-strong" />
              <div className="h-3 w-1/3 rounded bg-border" />
            </div>
            <div className="h-9 w-12 rounded bg-border-strong" />
          </div>
          <div className="mt-5 space-y-2">
            <div className="h-3 w-full rounded bg-border" />
            <div className="h-3 w-5/6 rounded bg-border" />
            <div className="h-3 w-2/3 rounded bg-border" />
          </div>
        </div>
      ))}
    </div>
  );
}
