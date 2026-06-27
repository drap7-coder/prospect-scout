"use client";

import { useEffect, useRef, useState } from "react";
import type { DataSourceBadge } from "@/lib/intelligence/synthesizeCard";
import { sourceTone } from "@/lib/intelligence/colors";

function SourceTooltip({
  badge,
  onClose,
}: {
  badge: DataSourceBadge;
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

  const tone = sourceTone(badge.label);
  const confidencePct = Math.round(badge.confidence * 100);

  return (
    <div
      ref={ref}
      role="tooltip"
      className="result-source-popover absolute left-0 top-full z-20 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-[var(--result-card-border-hover)] bg-[var(--result-card-bg-hover)] p-3 shadow-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wide ${tone.bg} ${tone.border} ${tone.text}`}
        >
          {badge.label}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-1.5 py-0.5 font-mono text-[0.625rem] text-[var(--result-card-muted)] hover:text-[var(--result-card-text)]"
        >
          ✕
        </button>
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-[var(--result-card-muted)]">
        {badge.contribution}
      </p>
      <p className="mt-2 font-mono text-[0.625rem] text-[var(--result-card-muted-2)]">
        Confidence {confidencePct}%
      </p>
      {badge.sourceUrl ? (
        <a
          href={badge.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 font-mono text-[0.6875rem] text-accent-cyan hover:underline"
        >
          View source ↗
        </a>
      ) : null}
    </div>
  );
}

export function IntelligenceSourceBadge({
  badge,
  pulsing,
}: {
  badge: DataSourceBadge;
  pulsing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tone = sourceTone(badge.label);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={badge.contribution}
        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wide transition ${tone.bg} ${tone.border} ${tone.text} hover:brightness-110 ${pulsing ? "result-badge-pulse" : ""}`}
        aria-expanded={open}
      >
        {badge.label}
      </button>
      {open ? (
        <SourceTooltip badge={badge} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}
