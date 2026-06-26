"use client";

import type { Prospect, SignalStrength } from "@/lib/search/types";

function scoreTone(score: number): { text: string; bar: string; label: string } {
  if (score >= 80)
    return { text: "text-good", bar: "bg-good", label: "High" };
  if (score >= 60)
    return { text: "text-warn", bar: "bg-warn", label: "Moderate" };
  return { text: "text-muted", bar: "bg-muted-2", label: "Watch" };
}

function strengthDot(strength: SignalStrength): string {
  if (strength === "strong") return "bg-good";
  if (strength === "moderate") return "bg-warn";
  return "bg-muted-2";
}

export function ProspectCard({
  prospect,
  rank,
}: {
  prospect: Prospect;
  rank?: number;
}) {
  const tone = scoreTone(prospect.score);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur-sm transition hover:border-border-strong hover:bg-surface">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 transition group-hover:opacity-100" />

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {typeof rank === "number" ? (
              <span className="label-mono text-accent-cyan">
                {String(rank).padStart(2, "0")}
              </span>
            ) : null}
            <span className="label-mono">{prospect.buyerType}</span>
          </div>
          <h3 className="mt-1.5 truncate text-base font-semibold tracking-tight text-foreground">
            {prospect.name}
          </h3>
          <p className="mt-0.5 text-sm text-muted">{prospect.location}</p>
        </div>

        <div className="shrink-0 text-right">
          <div
            className={`font-mono text-3xl font-bold leading-none tabular-nums ${tone.text}`}
          >
            {prospect.score}
          </div>
          <div className="label-mono mt-1">{tone.label}</div>
          <div className="mt-1.5 h-1 w-16 overflow-hidden rounded-full bg-border-strong">
            <div
              className={`h-full ${tone.bar}`}
              style={{ width: `${prospect.score}%` }}
            />
          </div>
        </div>
      </header>

      <section className="mt-5">
        <h4 className="label-mono">Why it matters</h4>
        <ul className="mt-2.5 space-y-2">
          {prospect.whyItMatters.map((reason, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-snug text-foreground">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </section>

      {prospect.signals.length > 0 ? (
        <section className="mt-5">
          <h4 className="label-mono">Signals</h4>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {prospect.signals.map((signal) => (
              <span
                key={signal.id}
                title={`${signal.strength} · ~${signal.freshnessDays}d ago · ${signal.source}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent-soft px-2 py-0.5 font-mono text-[11px] text-accent-cyan"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${strengthDot(signal.strength)}`}
                />
                {signal.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-5 rounded-xl border-l-2 border-accent-cyan/60 bg-accent-soft/40 px-4 py-3">
        <h4 className="label-mono text-accent-cyan">Why now?</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">
          {prospect.whyNow}
        </p>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-background/60 px-4 py-3.5">
        <h4 className="label-mono">Suggested outreach</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">
          {prospect.outreachAngle}
        </p>
      </section>

      <section className="mt-4">
        <h4 className="label-mono">Suggested contacts</h4>
        <p className="mt-1.5 font-mono text-xs leading-relaxed text-muted">
          {prospect.contactRoles.join("  ·  ")}
        </p>
      </section>

      {prospect.sourceTrail.length > 0 ? (
        <section className="mt-4">
          <h4 className="label-mono">Source trail</h4>
          <ul className="mt-2 space-y-1.5">
            {prospect.sourceTrail.map((item, i) => (
              <li key={i} className="flex items-baseline gap-2 font-mono text-[11px]">
                <span className="shrink-0 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-accent-cyan">
                  {item.source}
                </span>
                <span className="text-muted">{item.evidenceText}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="group/d mt-4">
        <summary className="label-mono inline-flex cursor-pointer select-none items-center gap-1 text-accent transition hover:text-accent-cyan">
          <span className="group-open/d:hidden">+ Score breakdown</span>
          <span className="hidden group-open/d:inline">− Score breakdown</span>
        </summary>
        <ul className="mt-3 space-y-2">
          {prospect.scoreBreakdown.factors.map((factor) => (
            <li key={factor.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-xs text-muted">
                  {factor.detail}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">
                  {factor.points}/{factor.maxPoints}
                </span>
              </div>
              <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-accent/70"
                  style={{
                    width: `${(factor.points / factor.maxPoints) * 100}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </details>

      <footer className="mt-5 border-t border-border pt-4">
        <button
          type="button"
          disabled
          title="Saving prospects is coming soon"
          className="w-full cursor-not-allowed rounded-lg border border-border bg-surface-2 py-2 font-mono text-xs uppercase tracking-wider text-muted-2"
        >
          Save prospect · soon
        </button>
      </footer>
    </article>
  );
}
