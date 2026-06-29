import Link from "next/link";
import { notFound } from "next/navigation";
import {
  computeEnterpriseRollupDiagnostics,
  findEnterpriseProfileById,
  getSourceOrganizationsForEnterprise,
} from "@/lib/enterprise/diagnostics";
import { getWarehouseOrganizations } from "@/lib/import/warehouse/organizations";

export const metadata = {
  title: "Enterprise Profile",
  robots: "noindex",
};

export const dynamic = "force-dynamic";

function formatLob(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function EnterpriseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = findEnterpriseProfileById(id);
  if (!profile) notFound();

  const sources = getSourceOrganizationsForEnterprise(id);
  const diagnostics = computeEnterpriseRollupDiagnostics(getWarehouseOrganizations());

  const statesByLob = new Map<string, Set<string>>();
  for (const evidence of profile.segmentEvidence) {
    for (const lob of evidence.classificationIds) {
      const bucket = statesByLob.get(lob) ?? new Set<string>();
      for (const state of evidence.states) bucket.add(state.toUpperCase());
      statesByLob.set(lob, bucket);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Enterprise prospect · {profile.childCount} source records
        </p>
        <h1 className="mt-1 text-2xl font-medium">{profile.name}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {profile.hqCity && profile.hqState
            ? `HQ ${profile.hqCity}, ${profile.hqState}`
            : profile.hqState
              ? `HQ ${profile.hqState}`
              : "HQ unknown"}
          {profile.canonicalDomain ? ` · ${profile.canonicalDomain}` : ""}
          {profile.ticker ? ` · ${profile.ticker}` : ""}
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Overview</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--muted)]">Website</dt>
              <dd>
                {profile.website ? (
                  <a href={profile.website} className="underline" target="_blank" rel="noreferrer">
                    {profile.canonicalDomain ?? profile.website}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">States served</dt>
              <dd>{profile.statesServed.length}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Operating brands</dt>
              <dd>{profile.operatingBrands.length}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Total covered lives</dt>
              <dd>
                {profile.totalCoveredLives
                  ? profile.totalCoveredLives.toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Rollup method</dt>
              <dd>{profile.rollupMethod}</dd>
            </div>
          </dl>
        </section>

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Lines of business</h2>
          <div className="flex flex-wrap gap-2">
            {profile.linesOfBusiness.map((lob) => (
              <span
                key={lob}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs"
              >
                {formatLob(lob)}
              </span>
            ))}
          </div>
        </section>

        {statesByLob.size > 0 ? (
          <section className="card-float p-5">
            <h2 className="mb-3 text-lg font-medium">State presence by LOB</h2>
            <div className="space-y-3 text-sm">
              {[...statesByLob.entries()].map(([lob, states]) => (
                <div key={lob}>
                  <p className="font-medium">{formatLob(lob)}</p>
                  <p className="text-[var(--muted)]">{[...states].sort().join(", ")}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Operating brands & subsidiaries</h2>
          <ul className="max-h-64 list-disc space-y-1 overflow-y-auto pl-5 text-sm">
            {profile.operatingBrands.map((brand) => (
              <li key={brand}>{brand}</li>
            ))}
          </ul>
        </section>

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Source records</h2>
          <p className="mb-3 text-xs text-[var(--muted)]">
            Child warehouse organizations aggregated into this enterprise profile.
          </p>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Organization</th>
                  <th className="py-2 pr-3 font-medium">States</th>
                  <th className="py-2 font-medium">Domain</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((org) => (
                  <tr key={org.id} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3">{org.canonicalName}</td>
                    <td className="py-2 pr-3 text-[var(--muted)]">
                      {(org.states ?? []).slice(0, 5).join(", ") || "—"}
                    </td>
                    <td className="py-2 text-[var(--muted)]">{org.domain ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Rollup context</h2>
          <p className="text-sm text-[var(--muted)]">
            {diagnostics.rawOrganizationCount.toLocaleString()} raw warehouse organizations collapse
            to {diagnostics.searchResultCount.toLocaleString()} search results (
            {diagnostics.rollupProfileCount.toLocaleString()} enterprise profiles,
            {diagnostics.suppressedChildRecords.toLocaleString()} child records hidden from default
            search).
          </p>
        </section>
      </div>

      <p className="mt-8 text-center text-xs text-[var(--muted)]">
        <Link href="/results" className="underline hover:text-[var(--foreground)]">
          Back to results
        </Link>
        {" · "}
        <Link href="/diagnostics" className="underline hover:text-[var(--foreground)]">
          Diagnostics
        </Link>
      </p>
    </main>
  );
}
