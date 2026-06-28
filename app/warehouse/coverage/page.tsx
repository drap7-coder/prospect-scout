import { computeOrganizationWarehouseCoverageReport } from "@/lib/import/warehouse/coverageReport";

export const metadata = {
  title: "Organization Warehouse Coverage",
  robots: "noindex",
};

export const dynamic = "force-dynamic";

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <tr className="border-b border-[var(--border)]">
      <td className="py-2 pr-4 text-sm text-[var(--muted)]">{label}</td>
      <td className="py-2 text-right text-sm font-medium tabular-nums">{value}</td>
    </tr>
  );
}

export default async function OrganizationWarehouseCoveragePage() {
  const { warehouse, connectors, connectorDetails, healthPlans, healthPlanBreakdown, manufacturers } =
    computeOrganizationWarehouseCoverageReport();

  const healthPlanStateRows = Object.entries(healthPlans.countByState).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const manufacturerStateRows = Object.entries(manufacturers.byState).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Internal · Organization Warehouse
        </p>
        <h1 className="mt-1 text-2xl font-medium">Warehouse Coverage</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Generated {new Date(warehouse.lastImportAt ?? Date.now()).toLocaleString()}
          {warehouse.lastImportAt
            ? ` · Last import ${new Date(warehouse.lastImportAt).toLocaleString()}`
            : ""}
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Warehouse Summary</h2>
          <table className="w-full">
            <tbody>
              <StatRow label="Runtime mode" value={warehouse.runtimeMode} />
              <StatRow
                label="Total canonical organizations"
                value={warehouse.totalOrganizations.toLocaleString()}
              />
              <StatRow label="Duplicate organization IDs" value={warehouse.duplicateOrganizationIds} />
              <StatRow label="Production connectors" value={connectors.length} />
            </tbody>
          </table>
        </section>

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Connectors</h2>
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-4 font-medium">Connector</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 text-right font-medium">Indexed</th>
                <th className="py-2 text-right font-medium">Import mode</th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((connector) => (
                <tr key={connector.id} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4">{connector.label}</td>
                  <td className="py-2 pr-4 capitalize">{connector.status}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {connector.organizationsIndexed.toLocaleString()}
                  </td>
                  <td className="py-2 text-right">{connector.importMode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Connector Diagnostics</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Per-connector import status and searchable organization counts.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Connector</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 text-right font-medium">Raw</th>
                  <th className="py-2 pr-3 text-right font-medium">Canonical</th>
                  <th className="py-2 pr-3 text-right font-medium">Indexed</th>
                  <th className="py-2 pr-3 text-right font-medium">Searchable</th>
                  <th className="py-2 pr-3 text-right font-medium">Dupes</th>
                  <th className="py-2 pr-3 text-right font-medium">Merged</th>
                  <th className="py-2 font-medium">Last import</th>
                </tr>
              </thead>
              <tbody>
                {connectorDetails.map((connector) => (
                  <tr key={connector.id} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3">{connector.label}</td>
                    <td className="py-2 pr-3 capitalize">{connector.importStatus}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {connector.rawRecords.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {connector.canonicalOrganizations.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {connector.indexedOrganizations.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {connector.searchableOrganizations.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{connector.duplicateCount}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {connector.mergeCount ?? "—"}
                    </td>
                    <td className="py-2 text-xs text-[var(--muted)]">
                      {connector.lastImportAt
                        ? new Date(connector.lastImportAt).toLocaleString()
                        : "—"}
                      {connector.error ? (
                        <span className="mt-1 block text-amber-700">{connector.error}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-float p-5">
          <h2 className="mb-1 text-lg font-medium">Health Plans · Warehouse Breakdown</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">
            CMS national ingestion — Medicare Advantage / Part D, QHP marketplace issuers, Medicaid
            MCO.
          </p>
          <table className="w-full">
            <tbody>
              <StatRow label="CMS import mode" value={healthPlans.cmsImportMode} />
              <StatRow
                label="Total health plan organizations"
                value={healthPlanBreakdown.totalHealthPlans.toLocaleString()}
              />
              <StatRow label="Medicare Advantage" value={healthPlanBreakdown.medicareAdvantage} />
              <StatRow label="Medicaid MCOs" value={healthPlanBreakdown.medicaidMcos} />
              <StatRow label="Marketplace issuers" value={healthPlanBreakdown.marketplaceIssuers} />
              <StatRow label="BCBS organizations" value={healthPlanBreakdown.bcbsOrganizations} />
              <StatRow
                label="National commercial insurers"
                value={healthPlanBreakdown.nationalCarriers}
              />
              <StatRow label="Regional plans" value={healthPlanBreakdown.regionalCarriers} />
              <StatRow
                label="Provider-sponsored plans"
                value={healthPlanBreakdown.providerSponsoredPlans}
              />
              <StatRow label="States represented" value={healthPlanBreakdown.statesRepresented} />
              <StatRow
                label="States missing"
                value={healthPlans.missingStates.length}
              />
              <StatRow label="Part D (tagged)" value={healthPlans.countByMarket.partD} />
              <StatRow
                label="Possible duplicates (needs review)"
                value={healthPlans.possibleDuplicateCount}
              />
              <StatRow
                label="Net-new orgs (latest import)"
                value={healthPlans.netNewOrganizationsFromLatestImport ?? "—"}
              />
              <StatRow
                label="Net-new QHP issuers (Service Area PUF)"
                value={healthPlans.netNewQhpFromServiceArea ?? "—"}
              />
              <StatRow
                label="Net-new Medicaid plans (enrollment report)"
                value={healthPlans.netNewMedicaidFromEnrollment ?? "—"}
              />
              <StatRow label="Merged in latest import" value={healthPlans.mergeCount ?? "—"} />
            </tbody>
          </table>
        </section>

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Health Plans · Count by Source</h2>
          <table className="w-full">
            <tbody>
              {Object.entries(healthPlans.countBySource)
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => (
                  <StatRow key={source} label={source} value={count} />
                ))}
            </tbody>
          </table>
        </section>

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Health Plans · Count by Market</h2>
          <table className="w-full">
            <tbody>
              <StatRow label="Medicare Advantage" value={healthPlans.countByMarket.medicareAdvantage} />
              <StatRow label="Part D" value={healthPlans.countByMarket.partD} />
              <StatRow label="ACA Marketplace (QHP)" value={healthPlans.countByMarket.acaMarketplace} />
              <StatRow label="Medicaid MCO" value={healthPlans.countByMarket.medicaidManagedCare} />
              <StatRow label="Commercial (tagged)" value={healthPlans.countByMarket.commercial} />
              <StatRow label="BCBS (pattern)" value={healthPlans.countByMarket.bcbs} />
              <StatRow
                label="Provider-sponsored (pattern)"
                value={healthPlans.countByMarket.providerSponsored}
              />
            </tbody>
          </table>
        </section>

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Health Plans · State Coverage</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">
            {healthPlanStateRows.length} states/DC with coverage · {healthPlans.missingStates.length} missing
          </p>
          {healthPlans.sbeStatesMissing.length > 0 ? (
            <p className="mb-3 text-sm text-amber-700">
              SBE states missing marketplace issuers: {healthPlans.sbeStatesMissing.join(", ")}
            </p>
          ) : null}
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2 pr-4 font-medium">State</th>
                  <th className="py-2 text-right font-medium">Organizations</th>
                </tr>
              </thead>
              <tbody>
                {healthPlanStateRows.map(([state, count]) => (
                  <StatRow key={state} label={state} value={count} />
                ))}
              </tbody>
            </table>
          </div>
          {healthPlans.missingStates.length > 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Missing states: {healthPlans.missingStates.join(", ")}
            </p>
          ) : null}
        </section>

        <section className="card-float p-5">
          <h2 className="mb-1 text-lg font-medium">Connector: Manufacturers</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">
            SEC EDGAR public manufacturers and FDA establishment registrations merged on verified
            identifiers (CIK, ticker, FDA establishment id, domain).
          </p>
          <table className="w-full">
            <tbody>
              <StatRow label="Import mode" value={manufacturers.importMode} />
              <StatRow
                label="Raw SEC records"
                value={manufacturers.rawSourceRecords.sec.toLocaleString()}
              />
              <StatRow
                label="Raw FDA records"
                value={manufacturers.rawSourceRecords.fda.toLocaleString()}
              />
              <StatRow
                label="Normalized candidates"
                value={manufacturers.normalizedCandidates.toLocaleString()}
              />
              <StatRow
                label="Canonical organizations"
                value={manufacturers.canonicalOrganizations.toLocaleString()}
              />
              <StatRow label="Merged count" value={manufacturers.mergedCount} />
              <StatRow
                label="Duplicate organization IDs"
                value={manufacturers.duplicateOrganizationIds}
              />
              <StatRow label="Indexed count" value={manufacturers.indexedCount} />
              <StatRow label="Searchable count" value={manufacturers.searchableCount} />
            </tbody>
          </table>
        </section>

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Manufacturers · Count by Source</h2>
          <table className="w-full">
            <tbody>
              {Object.entries(manufacturers.bySourceConnector)
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => (
                  <StatRow key={source} label={source} value={count} />
                ))}
            </tbody>
          </table>
        </section>

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Manufacturers · Count by Industry</h2>
          <table className="w-full">
            <tbody>
              {Object.entries(manufacturers.byIndustry)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 25)
                .map(([industry, count]) => (
                  <StatRow key={industry} label={industry} value={count} />
                ))}
            </tbody>
          </table>
        </section>

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Manufacturers · State Coverage</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">
            {manufacturerStateRows.length} states with indexed manufacturer organizations
          </p>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2 pr-4 font-medium">State</th>
                  <th className="py-2 text-right font-medium">Organizations</th>
                </tr>
              </thead>
              <tbody>
                {manufacturerStateRows.map(([state, count]) => (
                  <StatRow key={`mfg-${state}`} label={state} value={count} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {healthPlans.possibleDuplicates.length > 0 ? (
          <section className="card-float p-5">
            <h2 className="mb-3 text-lg font-medium">Possible Duplicates (Needs Review)</h2>
            <p className="mb-3 text-xs text-[var(--muted)]">
              Organizations sharing verified IDs but different catalog IDs. Not auto-merged.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">ID type</th>
                    <th className="py-2 pr-3 font-medium">ID value</th>
                    <th className="py-2 font-medium">Organizations</th>
                  </tr>
                </thead>
                <tbody>
                  {healthPlans.possibleDuplicates.map((dup) => (
                    <tr key={`${dup.idType}:${dup.idValue}`} className="border-b border-[var(--border)]">
                      <td className="py-2 pr-3">{dup.idType}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{dup.idValue}</td>
                      <td className="py-2">{dup.organizationNames.join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>

      <p className="mt-8 text-center text-xs text-[var(--muted)]">
        <a href="/warehouse" className="underline hover:text-[var(--foreground)]">
          Warehouse overview
        </a>
        {" · "}
        <a href="/diagnostics" className="underline hover:text-[var(--foreground)]">
          Discovery diagnostics
        </a>
      </p>
    </main>
  );
}
