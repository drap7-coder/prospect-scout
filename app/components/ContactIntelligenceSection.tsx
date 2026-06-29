import type { Prospect } from "@/lib/search/types";
import { buildContactIntelligenceView } from "@/lib/emailIntelligence/formatContactIntelligence";
import { confidenceTone } from "@/lib/intelligence/colors";

export function ContactIntelligenceSection({ prospect }: { prospect: Prospect }) {
  const view = buildContactIntelligenceView(prospect.emailPattern);

  return (
    <section className="border-b border-border/60 py-8">
      <h2 className="label-mono text-accent-cyan/90">{view.title}</h2>
      <div className="mt-4 rounded-xl border border-border/80 bg-surface/40 p-5">
        {!view.hasData ? (
          <p className="text-sm text-muted">{view.emptyMessage}</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">
                Domain
              </dt>
              <dd className="mt-1 text-sm text-foreground">{view.domain ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">
                Dominant pattern
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {view.patternLabel}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">
                Format template
              </dt>
              <dd className="mt-1 font-mono text-sm text-foreground/90">
                {view.formatTemplate}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">
                Confidence
              </dt>
              <dd className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded border px-2 py-0.5 font-mono text-xs ${
                    confidenceTone(prospect.emailPattern!.confidenceLabel).text
                  } border-border/70 bg-surface`}
                >
                  {view.confidenceLabel}
                </span>
                <span className="font-mono text-xs text-muted">
                  {view.confidencePercent}%
                </span>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">
                Source
              </dt>
              <dd className="mt-1 text-sm text-foreground">{view.sourceLabel}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">
                Public evidence
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {view.evidenceCount} observed
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">
                MX provider
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {view.mxProvider ?? "Unknown"}
              </dd>
            </div>
            {view.sampleEvidence.length > 0 ? (
              <div className="sm:col-span-2">
                <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">
                  Sample evidence
                </dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {view.sampleEvidence.map((email) => (
                    <code
                      key={email}
                      className="rounded-md border border-border/70 bg-surface px-2 py-1 font-mono text-xs text-foreground/90"
                    >
                      {email}
                    </code>
                  ))}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">
                Catch-all
              </dt>
              <dd className="mt-1 text-sm text-muted">{view.catchAllStatus}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">
                Last checked
              </dt>
              <dd className="mt-1 text-sm text-muted">{view.lastCheckedLabel}</dd>
            </div>
          </dl>
        )}
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Inferred from public web evidence on the company domain. No SMTP mailbox
          probing or LinkedIn scraping.
        </p>
      </div>
    </section>
  );
}
