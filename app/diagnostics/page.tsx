import { runDiagnostics } from "@/lib/discovery/diagnostics";
import { canonicalOrgTypeLabel } from "@/lib/discovery/canonicalOrgType";
import {
  computeMarketCoveragePercent,
  getCensusConnectorStatus,
} from "@/lib/discovery/connectors/census";
import { getProPublicaConnectorStatus } from "@/lib/discovery/connectors/propublica";
import { getAcaMarketplaceConnectorStatus } from "@/lib/discovery/connectors/aca";
import { computeCatalogFacetCounts } from "@/lib/discovery/catalog/facetCounts";
import { parseSearchIntent } from "@/lib/discovery/intent";

export const metadata = {
  title: "Discovery Diagnostics",
  robots: "noindex",
};

export const dynamic = "force-dynamic";

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

export default async function DiagnosticsPage() {
  const report = runDiagnostics();
  const census = await getCensusConnectorStatus();
  const propublica = await getProPublicaConnectorStatus();
  const acaMarketplace = getAcaMarketplaceConnectorStatus();
  const sampleIntent = parseSearchIntent("manufacturers in ohio");
  const sampleFacets = computeCatalogFacetCounts(sampleIntent);
  const sampleCoverage = computeMarketCoveragePercent(
    sampleFacets.scopeTotal,
    census.sampleMarketSize?.estimatedEstablishments ?? null,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Internal · Discovery Engine v2
        </p>
        <h1 className="mt-1 text-2xl font-medium">Organization Catalog Diagnostics</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Generated {new Date(report.generatedAt).toLocaleString()}
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <Section title="Coverage">
          <StatRow label="Total organizations (canonical)" value={report.coverage.total.toLocaleString()} />
          <StatRow label="Catalog confidence" value={`${Math.round(report.coverage.confidence * 100)}%`} />
          <StatRow label="Domain duplicate rate" value={`${report.duplicates.duplicateRate}%`} />
          <StatRow label="Domain duplicate clusters" value={report.duplicates.duplicateDomains.length} />
          <StatRow label="Companies" value={report.coverage.categories.companies} />
          <StatRow label="Nonprofits" value={report.coverage.categories.nonprofits} />
          <StatRow label="Education" value={report.coverage.categories.education} />
          <StatRow label="Healthcare" value={report.coverage.categories.healthcare} />
          <StatRow label="Manufacturers" value={report.coverage.categories.manufacturers} />
          <StatRow label="Financial Services" value={report.coverage.categories.financialServices} />
        </Section>

        <Section title="Performance">
          <StatRow label="Catalog load (once per process)" value={`${report.latency.catalogLoadMs} ms`} />
          <StatRow label="Search latency p50" value={`${report.latency.p50Ms} ms`} />
          <StatRow label="Search latency p95" value={`${report.latency.p95Ms} ms`} />
          <StatRow label="Search latency max (sample)" value={`${report.latency.maxMs} ms`} />
          <h3 className="mb-2 mt-4 text-sm font-medium text-[var(--muted)]">Sample queries</h3>
          {report.latency.sampleQueries.map((s) => (
            <StatRow
              key={s.query}
              label={s.query}
              value={`${s.latencyMs} ms · ${s.resultCount} results`}
            />
          ))}
        </Section>

        <Section title="Catalog Index">
          <StatRow
            label="Source records (raw ingested)"
            value={report.catalogIndex.sourceRecordCount.toLocaleString()}
          />
          <StatRow
            label="Normalized (pre-dedupe)"
            value={report.catalogIndex.normalizedCount.toLocaleString()}
          />
          <StatRow
            label="Excluded during normalization"
            value={report.catalogIndex.excludedCount.toLocaleString()}
          />
          <StatRow
            label="Organizations merged (dedupe)"
            value={report.catalogIndex.mergedCount.toLocaleString()}
          />
          <StatRow
            label="Canonical organizations indexed"
            value={report.catalogIndex.canonicalTotal.toLocaleString()}
          />
          <StatRow
            label="Missing taxonomy org type"
            value={report.catalogIndex.missingOrganizationType.toLocaleString()}
          />
          <StatRow
            label="Missing canonical type (unclassified)"
            value={report.catalogIndex.missingCanonicalType.toLocaleString()}
          />
          <StatRow
            label="Index loaded at"
            value={new Date(report.catalogIndex.loadedAt).toLocaleString()}
          />
        </Section>

        <Section title="By Canonical Organization Type">
          {Object.entries(report.catalogIndex.byCanonicalOrganizationType)
            .sort((a, b) => b[1] - a[1])
            .map(([id, count]) => (
              <StatRow
                key={id}
                label={canonicalOrgTypeLabel(id)}
                value={count.toLocaleString()}
              />
            ))}
        </Section>

        <Section title="By Sector">
          {Object.entries(report.coverage.bySector)
            .sort((a, b) => b[1] - a[1])
            .map(([id, count]) => (
              <StatRow key={id} label={id} value={count.toLocaleString()} />
            ))}
        </Section>

        <Section title="By State (top 20)">
          {Object.entries(report.catalogIndex.byState)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([id, count]) => (
              <StatRow key={id} label={id} value={count.toLocaleString()} />
            ))}
        </Section>

        <Section title="Benchmark Summary">
          <StatRow label="Queries sampled" value={report.benchmarkSummary.queryCount} />
          <StatRow label="Avg results per query" value={report.benchmarkSummary.avgResultCount} />
          <StatRow label="Avg relevance" value={report.benchmarkSummary.avgRelevance} />
          <StatRow label="Avg confidence" value={report.benchmarkSummary.avgConfidence} />
          <StatRow label="Queries with coverage gaps" value={report.benchmarkSummary.queriesWithGaps} />
          <StatRow label="Queries with zero results" value={report.benchmarkSummary.queriesWithZeroResults} />
        </Section>

        <Section title="Catalog Freshness">
          <StatRow label="Last successful ingest" value={report.catalogFreshness.lastIngest.slice(0, 10)} />
          <StatRow label="Manifest generated" value={report.catalogFreshness.generatedAt.slice(0, 10)} />
        </Section>

        <Section title="Market Analytics (Census CBP)">
          <p className="mb-3 text-xs text-[var(--muted)]">
            Census data is used for market sizing only — establishments are never
            ingested into the organization catalog.
          </p>
          <StatRow
            label="API key configured"
            value={census.configured ? "Yes" : "No (set CENSUS_API_KEY)"}
          />
          <StatRow label="Cache entries" value={census.cacheEntries} />
          <StatRow
            label="Last query"
            value={
              census.lastQueryAt
                ? new Date(census.lastQueryAt).toLocaleString()
                : "—"
            }
          />
          {census.lastError ? (
            <StatRow label="Last error" value={census.lastError} />
          ) : null}
          {census.sampleMarketSize?.available ? (
            <>
              <StatRow
                label="Sample query"
                value={`${census.sampleMarketSize.geography.label} · NAICS ${census.sampleMarketSize.naics}`}
              />
              <StatRow
                label="Estimated establishments (CBP)"
                value={
                  census.sampleMarketSize.estimatedEstablishments?.toLocaleString() ??
                  "—"
                }
              />
              <StatRow
                label="Indexed orgs (same scope)"
                value={sampleFacets.scopeTotal.toLocaleString()}
              />
              <StatRow
                label="Catalog vs market coverage"
                value={
                  sampleCoverage != null ? `${sampleCoverage}%` : "—"
                }
              />
              <StatRow
                label="Employment (CBP)"
                value={census.sampleMarketSize.employment?.toLocaleString() ?? "—"}
              />
            </>
          ) : null}
        </Section>

        <Section title="Nonprofit Enrichment (ProPublica)">
          <p className="mb-3 text-xs text-[var(--muted)]">
            ProPublica enriches nonprofit result cards with Form 990 data. It does
            not add organizations to the catalog index.
          </p>
          <StatRow label="Status" value={propublica.configured ? "Available" : "Unavailable"} />
          <StatRow
            label="Last request"
            value={
              propublica.lastRequestAt
                ? new Date(propublica.lastRequestAt).toLocaleString()
                : "—"
            }
          />
          <StatRow label="Cache entries" value={propublica.cacheEntries} />
          <StatRow label="Cache hit rate" value={`${propublica.cacheHitRate}%`} />
          <StatRow
            label="Average latency"
            value={
              propublica.averageLatencyMs > 0
                ? `${propublica.averageLatencyMs} ms`
                : "—"
            }
          />
          {propublica.lastError ? (
            <StatRow label="Last error" value={propublica.lastError} />
          ) : null}
          {propublica.sampleResult?.enrichment ? (
            <>
              <StatRow
                label="Sample query"
                value="Pro Publica · NY"
              />
              <StatRow
                label="Sample match confidence"
                value={`${Math.round(propublica.sampleResult.confidence * 100)}%`}
              />
              <StatRow
                label="Sample legal name"
                value={propublica.sampleResult.enrichment.legalName}
              />
              <StatRow
                label="Sample EIN"
                value={propublica.sampleResult.enrichment.strein}
              />
            </>
          ) : propublica.sampleResult?.error ? (
            <StatRow label="Sample error" value={propublica.sampleResult.error} />
          ) : null}
        </Section>

        <Section title="ACA Marketplace (seed)">
          <p className="mb-3 text-xs text-[var(--muted)]">
            Curated ACA Marketplace (QHP) issuers seeded into the catalog as
            health plans (healthPlanType = aca_marketplace). This is a small,
            transparent starting point — the live CMS Marketplace API and QHP
            Public Use Files will be added in a later pull request.
          </p>
          <StatRow label="Connector status" value={acaMarketplace.status} />
          <StatRow label="Completeness" value={acaMarketplace.completeness} />
          <StatRow label="API" value={acaMarketplace.api} />
          <StatRow label="Seeded issuers" value={acaMarketplace.issuerCount} />
          <StatRow label="States covered (seed)" value={acaMarketplace.stateCount} />
        </Section>

        <Section title="Connector Health">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Connector</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Records</th>
                  <th className="py-2 pr-3 font-medium">Last updated</th>
                  <th className="py-2 pr-3 font-medium">Coverage</th>
                  <th className="py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {report.connectorHealth.map((item) => (
                  <tr key={item.connectorId} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3 font-medium">{item.label}</td>
                    <td className="max-w-[180px] truncate py-2 pr-3 text-[var(--muted)]">
                      <a
                        href={item.sourceUrl}
                        className="underline hover:text-[var(--foreground)]"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.sourceName}
                      </a>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{item.recordsIngested.toLocaleString()}</td>
                    <td className="py-2 pr-3 tabular-nums text-[var(--muted)]">{item.lastUpdated}</td>
                    <td className="py-2 pr-3 tabular-nums">{item.sourceCoveragePercent}%</td>
                    <td className="py-2 tabular-nums">{Math.round(item.confidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Completeness">
          <StatRow label="With state" value={`${report.completeness.pctState}%`} />
          <StatRow label="With industry" value={`${report.completeness.pctIndustry}%`} />
          <StatRow label="With organization type" value={`${report.completeness.pctOrganizationType}%`} />
          <StatRow label="With website" value={`${report.completeness.pctWebsite}%`} />
          <StatRow label="With domain" value={`${report.completeness.pctDomain}%`} />
        </Section>

        <Section title="Duplicate Detection">
          <StatRow label="Duplicate domains" value={report.duplicates.duplicateDomains.length} />
          <StatRow label="Similar names (sample)" value={report.duplicates.similarNames.length} />
          <StatRow label="Probable duplicates (sample)" value={report.duplicates.probableDuplicates.length} />
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
