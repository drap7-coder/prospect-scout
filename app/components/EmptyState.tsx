export function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-20 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-2">
        <svg
          className="h-5 w-5 text-accent"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">
        Your prospect briefing will appear here.
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        Tell Prospect Scout what you sell and who buys it. It surfaces the
        organizations worth calling today — and exactly why.
      </p>
    </div>
  );
}
