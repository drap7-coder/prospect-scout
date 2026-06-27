"use client";

import { useEffect, useRef, useState } from "react";
import type { ProspectSourceRecord } from "@/lib/search/types";
import { sourceTone } from "@/lib/intelligence/colors";

export function SourceRecordPopover({
  record,
  onClose,
}: {
  record: ProspectSourceRecord;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const tone = sourceTone(record.label);
  const confidencePct = Math.round(record.confidence * 100);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${record.label} source details`}
      className="result-source-popover absolute left-0 top-full z-20 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-[var(--result-card-border-hover)] bg-[var(--result-card-bg-hover)] p-3 shadow-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wide ${tone.bg} ${tone.border} ${tone.text}`}
        >
          {record.label}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-1.5 py-0.5 font-mono text-[0.625rem] text-[var(--result-card-muted)] hover:text-[var(--result-card-text)]"
        >
          ✕
        </button>
      </div>
      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="font-mono text-[0.625rem] uppercase tracking-wide text-[var(--result-card-muted-2)]">
            Connector
          </dt>
          <dd className="mt-0.5 text-[var(--result-card-text)]">{record.connector}</dd>
        </div>
        <div>
          <dt className="font-mono text-[0.625rem] uppercase tracking-wide text-[var(--result-card-muted-2)]">
            Confidence
          </dt>
          <dd className="mt-0.5 text-[var(--result-card-text)]">{confidencePct}%</dd>
        </div>
        {record.lastUpdated ? (
          <div>
            <dt className="font-mono text-[0.625rem] uppercase tracking-wide text-[var(--result-card-muted-2)]">
              Last updated
            </dt>
            <dd className="mt-0.5 text-[var(--result-card-text)]">{record.lastUpdated}</dd>
          </div>
        ) : null}
        {record.evidenceText ? (
          <div>
            <dt className="font-mono text-[0.625rem] uppercase tracking-wide text-[var(--result-card-muted-2)]">
              Evidence
            </dt>
            <dd className="mt-0.5 leading-relaxed text-[var(--result-card-muted)]">
              {record.evidenceText}
            </dd>
          </div>
        ) : null}
      </dl>
      {record.sourceUrl ? (
        <a
          href={record.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 font-mono text-[0.6875rem] text-accent-cyan hover:underline"
        >
          View source ↗
        </a>
      ) : null}
    </div>
  );
}

export function SourceRecordBadge({
  record,
  pulsing,
}: {
  record: ProspectSourceRecord;
  pulsing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tone = sourceTone(record.label);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wide transition ${tone.bg} ${tone.border} ${tone.text} hover:brightness-110 ${pulsing ? "result-badge-pulse" : ""}`}
        aria-expanded={open}
      >
        {record.label}
      </button>
      {open ? (
        <SourceRecordPopover record={record} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}

export function EnrichmentHint({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[0.625rem] text-[var(--result-card-muted-2)]">
      <span className="result-enrich-dot" aria-hidden />
      {label}
    </span>
  );
}