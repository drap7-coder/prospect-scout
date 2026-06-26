"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MeridianMark } from "@/app/components/ScoutMeridian";
import { ProspectCard } from "@/app/components/ProspectCard";
import type { Prospect } from "@/lib/search/types";
import { regionLabel } from "@/lib/search/regions";
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
  leadershipSignals,
  prospectFreshness,
  topSignals,
} from "@/lib/intelligence/evidence";
import { relatedProspects } from "@/lib/intelligence/feed";
import { getProspectFromSession, loadWorkspace } from "@/lib/intelligence/session";

function confidenceLabel(c: "high" | "medium" | "low"): string {
  if (c === "high") return "High";
  if (c === "medium") return "Medium";
  return "Low";
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border/60 py-8">
      <h2 className={`label-mono ${accent ?? ""}`}>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function DossierClient({ id }: { id: string }) {
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [related, setRelated] = useState<Prospect[]>([]);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    const decoded = decodeURIComponent(id);
    const p = getProspectFromSession(decoded);
    setProspect(p);
    const session = loadWorkspace();
    if (p && session) {
      setRelated(relatedProspects(p, session.prospects));
    }
  }, [id]);

  if (!prospect) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-sm text-muted">
          Dossier not found. Run a search from the workspace first.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-accent hover:text-accent-cyan"
        >
          Return to workspace
        </Link>
      </div>
    );
  }

  const evidence = buildEvidenceItems(prospect);
  const bySource = groupEvidenceBySource(evidence);
  const timelineSignals = [...prospect.signals].sort(
    (a, b) => a.freshnessDays - b.freshnessDays,
  );
  const timelineEvidence = [...evidence].sort(
    (a, b) => a.freshnessDays - b.freshnessDays,
  );
  const leaders = leadershipSignals(prospect);
  const tone = scoreTone(prospect.score);
  const fresh = prospectFreshness(prospect);

  return (
    <div className="min-h-full bg-background">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-sm text-muted hover:text-foreground"
          >
            <MeridianMark className="h-3.5 w-3.5 text-accent" />
            <span>Workspace</span>
          </Link>
          <span className="label-mono">Full dossier</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10 lg:px-10">
        <header className="border-b border-border/60 pb-8">
          <p className="label-mono text-accent-cyan">{prospect.buyerType}</p>
          <h1 className="font-display mt-3 text-3xl font-normal tracking-[-0.02em] text-foreground sm:text-4xl lg:text-[2.75rem]">
            {prospect.name}
          </h1>
          <p className="mt-2 text-base text-muted">{prospect.location}</p>
        </header>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12 lg:pt-2">
          {/* Main column */}
          <div className="min-w-0">
            <Section title="Overview" accent="text-accent-cyan/90">
              <div className="rounded-xl border border-border/80 bg-surface/40 p-5">
                <p className="text-[1.0625rem] leading-relaxed text-foreground">
                  {prospect.whyNow}
                </p>
                <ul className="mt-5 space-y-2.5 border-t border-border/60 pt-5">
                  {prospect.whyItMatters.map((line, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-[0.9375rem] leading-relaxed text-muted"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-good" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </Section>

            <Section title="Opportunity timeline">
              <ol className="relative space-y-0 border-l-2 border-border pl-6">
                {timelineSignals.map((signal) => {
                  const st = sourceTone(signal.source);
                  return (
                    <li key={signal.id} className="relative pb-7 last:pb-0">
                      <span
                        className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ring-2 ring-background ${st.dot}`}
                      />
                      <p className="font-mono text-[11px] text-muted-2">
                        <span className={freshnessTone(signal.freshnessDays)}>
                          {formatFreshness(signal.freshnessDays)}
                        </span>
                        <span className="text-muted-2"> · </span>
                        <span className={st.text}>{signal.source}</span>
                      </p>
                      <p className="mt-1.5 text-[0.9375rem] font-medium text-foreground">
                        {signal.label}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {signal.whyNow}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </Section>

            <Section title="Evidence timeline">
              <ol className="space-y-2.5">
                {timelineEvidence.map((item) => {
                  const st = sourceTone(item.source);
                  const conf = confidenceTone(item.confidence);
                  return (
                    <li
                      key={item.id}
                      className={`rounded-lg border border-border/70 border-l-[3px] bg-surface/30 px-4 py-3.5 ${st.borderLeft}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 font-mono text-xs font-medium ${st.text}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {item.source}
                        </span>
                        <span className="flex items-center gap-2 font-mono text-[10px]">
                          <span className={freshnessTone(item.freshnessDays)}>
                            {formatFreshness(item.freshnessDays)}
                          </span>
                          <span className="text-muted-2">·</span>
                          <span className={`inline-flex items-center gap-1 ${conf.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
                            {confidenceLabel(item.confidence)}
                          </span>
                        </span>
                      </div>
                      <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-foreground">
                        {item.snippet}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </Section>

            <Section title="Signals by source">
              <div className="grid gap-4 sm:grid-cols-2">
                {[...bySource.entries()].map(([source, items]) => {
                  const st = sourceTone(source);
                  return (
                    <div
                      key={source}
                      className={`rounded-xl border border-border/70 p-4 ${st.bg}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                        <h3 className={`font-mono text-sm font-semibold ${st.text}`}>
                          {source}
                        </h3>
                      </div>
                      <ul className="mt-3 space-y-2.5">
                        {items.map((item) => (
                          <li key={item.id} className="text-sm leading-relaxed">
                            <span className="text-foreground">{item.snippet}</span>
                            <span
                              className={`ml-2 font-mono text-[10px] ${freshnessTone(item.freshnessDays)}`}
                            >
                              {formatFreshness(item.freshnessDays)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="Leadership">
              {leaders.length > 0 ? (
                <ul className="space-y-3">
                  {leaders.map((s) => {
                    const st = sourceTone(s.source);
                    return (
                      <li
                        key={s.id}
                        className="rounded-lg border border-border/70 bg-surface/30 px-4 py-3 text-sm"
                      >
                        <span className="font-medium text-foreground">
                          {s.label}
                        </span>
                        <span className={`ml-2 font-mono text-[10px] ${st.text}`}>
                          {s.source}
                        </span>
                        <p className="mt-1.5 leading-relaxed text-muted">
                          {analystSnippet(s.evidenceText, s.whyNow)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">
                  No leadership-specific signals in the current enrichment window.
                </p>
              )}
            </Section>

            {related.length > 0 ? (
              <Section title="Related organizations">
                <ul className="divide-y divide-border/60 rounded-xl border border-border/70 bg-surface/30">
                  {related.map((r) => {
                    const rt = scoreTone(r.score);
                    return (
                      <li key={r.id}>
                        <Link
                          href={`/dossier/${encodeURIComponent(r.id)}`}
                          className="flex items-center justify-between gap-4 px-4 py-3.5 transition hover:bg-surface/60"
                        >
                          <span className="text-sm font-medium text-foreground">
                            {r.name}
                          </span>
                          <span
                            className={`rounded-md border px-2 py-0.5 font-mono text-sm tabular-nums ${rt.bg} ${rt.border} ${rt.text}`}
                          >
                            {r.score}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            ) : null}

            <Section title="Source trail">
              <ul className="space-y-2">
                {prospect.sourceTrail.map((item, i) => {
                  const st = sourceTone(item.source);
                  return (
                    <li
                      key={i}
                      className={`flex flex-wrap items-baseline gap-2 rounded-lg border border-border/60 px-3 py-2 font-mono text-[11px] ${st.bg}`}
                    >
                      <span
                        className={`rounded border px-1.5 py-0.5 ${st.border} ${st.text}`}
                      >
                        {item.source}
                      </span>
                      <span className="text-foreground/90">
                        {analystSnippet(item.evidenceText)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>

            <section className="pt-8">
              <button
                type="button"
                onClick={() => setShowCard((v) => !v)}
                className="label-mono text-accent transition hover:text-accent-cyan"
              >
                {showCard ? "− Hide prospect card" : "+ Show full prospect card"}
              </button>
              {showCard ? (
                <div className="mt-4">
                  <ProspectCard prospect={prospect} />
                </div>
              ) : null}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="mt-8 lg:mt-0">
            <div className="space-y-4 lg:sticky lg:top-20">
              <div
                className={`rounded-2xl border p-5 ${tone.bg} ${tone.border}`}
              >
                <p className="label-mono">Opportunity score</p>
                <p
                  className={`mt-2 font-mono text-5xl font-bold tabular-nums leading-none ${tone.text}`}
                >
                  {prospect.score}
                </p>
                <p className={`mt-1 font-mono text-xs uppercase ${tone.text}`}>
                  {tone.label}
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border-strong/40">
                  <div
                    className={`h-full ${tone.bar}`}
                    style={{ width: `${prospect.score}%` }}
                  />
                </div>
                <p
                  className={`mt-3 font-mono text-xs ${freshnessTone(fresh)}`}
                >
                  {formatFreshness(fresh)}
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-surface/50 p-5">
                <p className="label-mono">Organization profile</p>
                <dl className="mt-4 space-y-3">
                  <div>
                    <dt className="font-mono text-[10px] text-muted-2">
                      Buyer ecosystem
                    </dt>
                    <dd className="mt-0.5 text-sm text-foreground">
                      {prospect.buyerType}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] text-muted-2">
                      Region
                    </dt>
                    <dd className="mt-0.5 text-sm text-foreground">
                      {regionLabel(prospect.region)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] text-muted-2">
                      Evidence sources
                    </dt>
                    <dd className="mt-1 flex flex-wrap gap-1">
                      {[...bySource.keys()].map((src) => {
                        const st = sourceTone(src);
                        return (
                          <span
                            key={src}
                            className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${st.bg} ${st.border} ${st.text}`}
                          >
                            {src}
                          </span>
                        );
                      })}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-border/80 bg-surface/50 p-5">
                <p className="label-mono">Top signals</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {topSignals(prospect, 4).map((s) => {
                    const st = sourceTone(s.source);
                    return (
                      <span
                        key={s.id}
                        className={`rounded-md border px-2 py-1 font-mono text-[10px] ${st.bg} ${st.border} ${st.text}`}
                      >
                        {s.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-surface/50 p-5">
                <p className="label-mono">Suggested contact roles</p>
                <p className="mt-3 text-sm leading-relaxed text-foreground">
                  {prospect.contactRoles.join(" · ")}
                </p>
              </div>

              <div className="rounded-2xl border border-good/25 bg-good/5 p-5">
                <p className="label-mono text-good">Suggested outreach</p>
                <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                  {prospect.outreachAngle}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
