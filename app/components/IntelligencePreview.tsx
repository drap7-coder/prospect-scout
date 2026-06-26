"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { Prospect } from "@/lib/search/types";
import {
  confidenceTone,
  freshnessTone,
  scoreTone,
  sourceTone,
} from "@/lib/intelligence/colors";
import {
  analystSnippet,
  buildEvidenceItems,
  formatFreshness,
  groupEvidenceBySource,
  prospectFreshness,
} from "@/lib/intelligence/evidence";

function confidenceLabel(c: "high" | "medium" | "low"): string {
  if (c === "high") return "High";
  if (c === "medium") return "Medium";
  return "Low";
}

export function IntelligencePreview({
  prospect,
  open,
  onClose,
  variant = "drawer",
}: {
  prospect: Prospect | null;
  open: boolean;
  onClose: () => void;
  variant?: "drawer" | "panel";
}) {
  useEffect(() => {
    if (!open || variant === "panel") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, variant]);

  if (!open || !prospect) return null;

  const evidence = buildEvidenceItems(prospect);
  const grouped = groupEvidenceBySource(evidence);
  const listReason =
    prospect.whyItMatters[0] ?? "Matched your search criteria and signal profile.";
  const freshness = prospectFreshness(prospect);
  const tone = scoreTone(prospect.score);
  const isPanel = variant === "panel";

  const content = (
    <>
      <header
        className={`shrink-0 border-b border-border/80 ${isPanel ? "bg-surface-2/50 px-5 py-4" : "px-5 py-4"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="label-mono text-accent-cyan">Intelligence preview</p>
            <h2 className="mt-1.5 text-xl font-semibold leading-tight tracking-tight text-foreground">
              {prospect.name}
            </h2>
            <p className="mt-1 text-sm text-muted">{prospect.location}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-muted transition hover:border-border-strong hover:text-foreground"
          >
            {isPanel ? "Close" : "Esc"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div
            className={`inline-flex items-baseline gap-2 rounded-xl border px-3 py-2 ${tone.bg} ${tone.border}`}
          >
            <span
              className={`font-mono text-3xl font-bold tabular-nums leading-none ${tone.text}`}
            >
              {prospect.score}
            </span>
            <span className={`font-mono text-[0.625rem] uppercase ${tone.text}`}>
              {tone.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-[0.6875rem] text-foreground">
              {prospect.buyerType}
            </span>
            <span
              className={`rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-[0.6875rem] ${freshnessTone(freshness)}`}
            >
              {formatFreshness(freshness)}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <section className="rounded-xl border border-border/80 bg-background/50 p-4">
          <h3 className="label-mono text-accent-cyan/90">
            Why this made the list
          </h3>
          <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-foreground">
            {listReason}
          </p>
        </section>

        <section className="mt-4 rounded-xl border border-border/80 bg-background/50 p-4">
          <h3 className="label-mono">Why now</h3>
          <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-foreground">
            {prospect.whyNow}
          </p>
        </section>

        <section className="mt-5">
          <h3 className="label-mono">Top evidence</h3>
          <div className="mt-3 space-y-4">
            {[...grouped.entries()].map(([source, items]) => {
              const st = sourceTone(source);
              return (
                <div key={source}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                    <p
                      className={`font-mono text-xs font-semibold uppercase tracking-wide ${st.text}`}
                    >
                      {source}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {items.slice(0, 2).map((item) => {
                      const conf = confidenceTone(item.confidence);
                      return (
                        <li
                          key={item.id}
                          className={`rounded-lg border border-border/60 border-l-[3px] bg-surface/60 px-3.5 py-3 ${st.borderLeft} ${st.bg}`}
                        >
                          <p className="text-[0.875rem] leading-relaxed text-foreground">
                            {item.snippet}
                          </p>
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <span
                              className={`font-mono text-[0.625rem] ${freshnessTone(item.freshnessDays)}`}
                            >
                              {formatFreshness(item.freshnessDays)}
                            </span>
                            <span className="text-muted-2">·</span>
                            <span
                              className={`inline-flex items-center gap-1 font-mono text-[0.625rem] ${conf.text}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${conf.dot}`}
                              />
                              {confidenceLabel(item.confidence)} confidence
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-good/20 bg-good/5 p-4">
          <h3 className="label-mono text-good">Suggested outreach</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">
            {prospect.outreachAngle}
          </p>
        </section>

        <section className="mt-4">
          <h3 className="label-mono">Suggested contact roles</h3>
          <p className="mt-2 font-mono text-xs leading-relaxed text-muted">
            {prospect.contactRoles.join(" · ")}
          </p>
        </section>

        <section className="mt-5">
          <h3 className="label-mono">Source trail</h3>
          <ul className="mt-2 space-y-2">
            {prospect.sourceTrail.slice(0, 6).map((item, i) => {
              const st = sourceTone(item.source);
              return (
                <li
                  key={i}
                  className={`rounded-lg border border-border/60 px-3 py-2 font-mono text-[0.6875rem] ${st.bg}`}
                >
                  <span className={`${st.text}`}>{item.source}</span>
                  <span className="mt-1 block text-foreground/85">
                    {analystSnippet(item.evidenceText)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <footer className="shrink-0 border-t border-border/80 bg-surface-2/40 p-4">
        <Link
          href={`/dossier/${encodeURIComponent(prospect.id)}`}
          className="flex w-full items-center justify-center rounded-lg bg-accent py-3 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Open full dossier
        </Link>
      </footer>
    </>
  );

  if (isPanel) {
    return (
      <aside
        className="flex min-h-0 w-full shrink-0 flex-col border-l border-border/80 bg-surface/80 lg:w-[min(42%,28rem)] xl:w-[min(38%,32rem)]"
        role="complementary"
        aria-label={`Intelligence preview for ${prospect.name}`}
      >
        {content}
      </aside>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close preview"
        className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border bg-surface shadow-2xl shadow-black/60"
        role="dialog"
        aria-modal="true"
        aria-label={`Intelligence preview for ${prospect.name}`}
      >
        {content}
      </aside>
    </>
  );
}
