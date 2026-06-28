import {
  computeOrganizationWarehouseDiagnostics,
  WAREHOUSE_CONNECTORS,
} from "@/lib/import/warehouse";
import { computeRuntimeDiagnostics } from "@/lib/runtime";
import { RuntimeDiagnosticsPanel } from "@/app/components/RuntimeDiagnosticsPanel";

export const metadata = {
  title: "Organization Warehouse",
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

export default async function OrganizationWarehousePage() {
  const warehouse = computeOrganizationWarehouseDiagnostics();
  const runtime = computeRuntimeDiagnostics();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Internal · Catalog Ingestion
        </p>
        <h1 className="mt-1 text-2xl font-medium">Organization Warehouse</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Refreshable national organization catalogs built from public-source connectors.
          Search reads only from the built warehouse index.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <RuntimeDiagnosticsPanel runtime={runtime} />

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Warehouse Summary</h2>
          <StatRow label="Runtime mode" value={warehouse.runtimeMode} />
          <StatRow
            label="Total organizations"
            value={warehouse.totalOrganizations.toLocaleString()}
          />
          <StatRow label="Duplicate org IDs" value={warehouse.duplicateOrganizationIds} />
          <StatRow
            label="Last import"
            value={
              warehouse.lastImportAt
                ? new Date(warehouse.lastImportAt).toLocaleString()
                : "—"
            }
          />
        </section>

        <section className="card-float p-5">
          <h2 className="mb-3 text-lg font-medium">Connectors</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Connector</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Indexed</th>
                  <th className="py-2 pr-3 font-medium">Import mode</th>
                  <th className="py-2 font-medium">Last import</th>
                </tr>
              </thead>
              <tbody>
                {warehouse.connectors.map((connector) => {
                  const definition = WAREHOUSE_CONNECTORS[connector.id];
                  return (
                    <tr key={connector.id} className="border-b border-[var(--border)]">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{connector.label}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {definition?.description}
                        </div>
                      </td>
                      <td className="py-2 pr-3 capitalize">{connector.status}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {connector.organizationsIndexed.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">{connector.importMode ?? "—"}</td>
                      <td className="py-2 tabular-nums text-[var(--muted)]">
                        {connector.lastImportAt
                          ? new Date(connector.lastImportAt).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <p className="mt-8 text-center text-xs text-[var(--muted)]">
        <a href="/warehouse/coverage" className="underline hover:text-[var(--foreground)]">
          View connector coverage detail
        </a>
        {" · "}
        <a href="/diagnostics" className="underline hover:text-[var(--foreground)]">
          Discovery diagnostics
        </a>
      </p>
    </main>
  );
}
