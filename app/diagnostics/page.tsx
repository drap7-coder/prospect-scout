import { runDiagnostics } from "@/lib/discovery/diagnostics";

export const metadata = {
  title: "Discovery Diagnostics",
  robots: "noindex",
};

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between border-b border-[var(--border)] py-2 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-float p-5">
      <h2 className="mb-3 text-lg font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default function DiagnosticsPage() {
  const report = runDiagnostics();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Internal · Discovery Engine v1
        </p>
        <h1 className="mt-1 text-2xl font-medium">Organization Catalog Diagnostics</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Generated {new Date(report.generatedAt).toLocaleString()}
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <Section title="Coverage">
          <StatRow label="Total organizations" value={report.coverage.total} />
          <StatRow label="Catalog scale target coverage" value={`${report.coverage.sourceCoveragePercent}%`} />
          <StatRow label="Catalog confidence" value={`${Math.round(report.coverage.confidence * 100)}%`} />
          <StatRow label="Companies" value={report.coverage.categories.companies} />
          <StatRow label="Nonprofits" value={report.coverage.categories.nonprofits} />
          <StatRow label="Government" value={report.coverage.categories.government} />
          <StatRow label="Education" value={report.coverage.categories.education} />
          <StatRow label="Healthcare" value={report.coverage.categories.healthcare} />
          <StatRow label="Manufacturers" value={report.coverage.categories.manufacturers} />
          <StatRow
            label="Financial Services"
            value={report.coverage.categories.financialServices}
          />
          <StatRow label="Technology" value={report.coverage.categories.technology} />
          <StatRow label="Retail" value={report.coverage.categories.retail} />
          <h3 className="mb-2 mt-4 text-sm font-medium text-[var(--muted)]">By sector</h3>
          {Object.entries(report.coverage.bySector)
            .sort((a, b) => b[1] - a[1])
            .map(([sector, count]) => (
              <StatRow key={sector} label={sector} value={count} />
            ))}
        </Section>

        <Section title="Connector Health">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Connector</th>
                  <th className="py-2 pr-3 font-medium">Industry</th>
                  <th className="py-2 pr-3 font-medium">Records</th>
                  <th className="py-2 pr-3 font-medium">Freshness</th>
                  <th className="py-2 pr-3 font-medium">Duplicates</th>
                  <th className="py-2 pr-3 font-medium">Failures</th>
                  <th className="py-2 pr-3 font-medium">Coverage</th>
                  <th className="py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {report.connectorHealth.map((item) => (
                  <tr key={item.connectorId} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3 font-medium">{item.label}</td>
                    <td className="py-2 pr-3 text-[var(--muted)]">{item.industry}</td>
                    <td className="py-2 pr-3 tabular-nums">{item.recordsIngested.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-[var(--muted)]">{item.freshness}</td>
                    <td className="py-2 pr-3 tabular-nums">{item.duplicates}</td>
                    <td className="py-2 pr-3 tabular-nums">{item.failures}</td>
                    <td className="py-2 pr-3 tabular-nums">{item.sourceCoveragePercent}%</td>
                    <td className="py-2 tabular-nums">{Math.round(item.confidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Completeness">
          <StatRow
            label="With website"
            value={`${report.completeness.pctWebsite}% (${report.completeness.withWebsite}/${report.completeness.total})`}
          />
          <StatRow
            label="With domain"
            value={`${report.completeness.pctDomain}% (${report.completeness.withDomain}/${report.completeness.total})`}
          />
          <StatRow
            label="With headquarters"
            value={`${report.completeness.pctHeadquarters}% (${report.completeness.withHeadquarters}/${report.completeness.total})`}
          />
          <StatRow
            label="With state"
            value={`${report.completeness.pctState}% (${report.completeness.withState}/${report.completeness.total})`}
          />
          <StatRow
            label="With industry"
            value={`${report.completeness.pctIndustry}% (${report.completeness.withIndustry}/${report.completeness.total})`}
          />
          <StatRow
            label="With organization type"
            value={`${report.completeness.pctOrganizationType}% (${report.completeness.withOrganizationType}/${report.completeness.total})`}
          />
        </Section>

        <Section title="Duplicate Detection">
          <h3 className="mb-2 text-sm font-medium">
            Duplicate domains ({report.duplicates.duplicateDomains.length})
          </h3>
          {report.duplicates.duplicateDomains.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">None detected.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {report.duplicates.duplicateDomains.map((group) => (
                <li key={group.key}>
                  <span className="font-mono text-xs">{group.key}</span>
                  <ul className="ml-4 mt-1 list-disc text-[var(--muted)]">
                    {group.organizations.map((o) => (
                      <li key={o.id}>
                        {o.name} ({o.id})
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-2 mt-4 text-sm font-medium">
            Similar names ({report.duplicates.similarNames.length})
          </h3>
          {report.duplicates.similarNames.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">None detected.</p>
          ) : (
            <ul className="space-y-2 text-sm text-[var(--muted)]">
              {report.duplicates.similarNames.map((group) => (
                <li key={group.key}>{group.key}</li>
              ))}
            </ul>
          )}

          <h3 className="mb-2 mt-4 text-sm font-medium">
            Probable duplicates ({report.duplicates.probableDuplicates.length})
          </h3>
          {report.duplicates.probableDuplicates.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">None detected.</p>
          ) : (
            <ul className="space-y-2 text-sm text-[var(--muted)]">
              {report.duplicates.probableDuplicates.map((group) => (
                <li key={group.key}>
                  {group.organizations.map((o) => o.name).join(" · ")}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <p className="mt-8 text-center text-xs text-[var(--muted)]">
        <a href="/benchmark" className="underline hover:text-[var(--foreground)]">
          View search quality benchmark
        </a>
      </p>
    </main>
  );
}
