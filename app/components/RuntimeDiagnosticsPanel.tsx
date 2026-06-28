import type { RuntimeDiagnostics } from "@/lib/runtime";

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between border-b border-[var(--border)] py-2 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="max-w-[60%] truncate text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

function formatEnvironment(env: RuntimeDiagnostics["deployment"]["environment"]): string {
  if (env === "production") return "Production";
  if (env === "preview") return "Preview";
  if (env === "development") return "Development";
  return "Local";
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function RuntimeDiagnosticsPanel({ runtime }: { runtime: RuntimeDiagnostics }) {
  const commit =
    runtime.deployment.gitCommitShort ??
    runtime.deployment.gitCommitSha?.slice(0, 7) ??
    "—";

  return (
    <section className="card-float p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">Deployment &amp; Runtime</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Compare this snapshot with local dev to verify the live site is running the
            expected commit and warehouse configuration.
            {" "}
            <a
              href="/api/diagnostics/runtime"
              className="underline hover:text-[var(--foreground)]"
              target="_blank"
              rel="noreferrer"
            >
              JSON API
            </a>
          </p>
        </div>
        {runtime.warnings.length > 0 ? (
          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            {runtime.warnings.length} warning{runtime.warnings.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Looks healthy
          </span>
        )}
      </div>

      <StatRow label="Git commit" value={commit} />
      <StatRow
        label="Git branch"
        value={runtime.deployment.gitBranch ?? "—"}
      />
      <StatRow
        label="Deployment environment"
        value={formatEnvironment(runtime.deployment.environment)}
      />
      <StatRow label="NODE_ENV" value={runtime.deployment.nodeEnv} />
      <StatRow
        label="Vercel deployment"
        value={runtime.deployment.vercelDeploymentId ?? "—"}
      />

      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">
          Organization Warehouse
        </p>
        <StatRow label="ORG_WAREHOUSE env" value={runtime.warehouse.orgWarehouseEnv ?? "(default)"} />
        <StatRow
          label="Warehouse enabled"
          value={yesNo(runtime.warehouse.enabled)}
        />
        <StatRow
          label="Warehouse active for search"
          value={yesNo(runtime.warehouse.activeForSearch)}
        />
        <StatRow label="Runtime mode" value={runtime.warehouse.runtimeMode} />
        <StatRow
          label="Registered connectors"
          value={runtime.warehouse.registeredConnectors.join(", ")}
        />
        <StatRow
          label="Warehouse organization count"
          value={runtime.warehouse.totalOrganizations.toLocaleString()}
        />
        <StatRow
          label="Health plan organizations"
          value={runtime.warehouse.healthPlanOrganizations.toLocaleString()}
        />
        <StatRow
          label="Manufacturer organizations"
          value={runtime.warehouse.manufacturerOrganizations.toLocaleString()}
        />
        <StatRow label="Duplicate org ids" value={runtime.warehouse.duplicateOrganizationIds} />
        <StatRow
          label="Last warehouse import"
          value={
            runtime.warehouse.lastImportAt
              ? new Date(runtime.warehouse.lastImportAt).toLocaleString()
              : "—"
          }
        />
        <StatRow label="Catalog version" value={runtime.warehouse.catalogVersion ?? "—"} />
        <StatRow label="Catalog mode" value={runtime.warehouse.catalogMode ?? "—"} />
        <StatRow label="Strict import" value={yesNo(runtime.warehouse.strictImport)} />
      </div>

      {runtime.warnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-amber-800 dark:text-amber-200">
            Warnings
          </p>
          <ul className="list-disc space-y-1 pl-4 text-sm text-amber-900 dark:text-amber-100">
            {runtime.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-[var(--muted)]">
        Generated {new Date(runtime.generatedAt).toLocaleString()}
      </p>
    </section>
  );
}
