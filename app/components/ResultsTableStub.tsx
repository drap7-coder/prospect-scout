"use client";

export function ResultsTableStub({ count }: { count: number }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-2/40 px-6 py-12 text-center">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-2">
        Table view
      </p>
      <p className="mt-2 text-sm text-muted">
        A sortable table layout is coming soon.
      </p>
      <p className="mt-1 font-mono text-[0.625rem] text-muted-2">
        {count.toLocaleString()} organizations ready · switch to Discovery or List to
        view them now.
      </p>
    </div>
  );
}
