import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Organization } from "@/lib/discovery/organization";
import type { CmsImportStats } from "./cms/types";
import { productionCmsPaths } from "./cms/sources/fetch";
import type { HealthPlanCatalogImportManifest } from "./catalogManifest";

export type RegressionSeverity = "error" | "warning";

export interface RegressionFinding {
  severity: RegressionSeverity;
  code: string;
  message: string;
}

export interface ImportBaseline {
  importedAt: string;
  totalHealthPlans: number;
  qhpIssuers: number;
  medicaidMcos: number;
  medicareAdvantage: number;
  duplicateOrganizationIds: number;
  statesCovered: number;
  stateCounts: Record<string, number>;
}

const MATERIAL_DROP_RATIO = 0.15;
const MATERIAL_QHP_DROP = 10;

function countByType(organizations: Organization[]) {
  return {
    medicareAdvantage: organizations.filter((o) => o.healthPlanType === "medicare_advantage")
      .length,
    acaMarketplace: organizations.filter((o) => o.healthPlanType === "aca_marketplace").length,
    medicaidManagedCare: organizations.filter(
      (o) => o.healthPlanType === "medicaid_managed_care",
    ).length,
  };
}

function stateCountsFromOrgs(organizations: Organization[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const org of organizations) {
    for (const state of org.states) {
      counts[state] = (counts[state] ?? 0) + 1;
    }
  }
  return counts;
}

export function buildImportBaseline(
  organizations: Organization[],
  manifest: HealthPlanCatalogImportManifest,
): ImportBaseline {
  const byType = countByType(organizations);
  const stateCounts = stateCountsFromOrgs(organizations);
  return {
    importedAt: manifest.importedAt,
    totalHealthPlans: organizations.length,
    qhpIssuers: byType.acaMarketplace,
    medicaidMcos: byType.medicaidManagedCare,
    medicareAdvantage: byType.medicareAdvantage,
    duplicateOrganizationIds: manifest.organizations.duplicateIds,
    statesCovered: Object.keys(stateCounts).length,
    stateCounts,
  };
}

export function loadImportBaseline(
  path: string = productionCmsPaths().importBaselineJson,
): ImportBaseline | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ImportBaseline;
  } catch {
    return null;
  }
}

export function saveImportBaseline(
  baseline: ImportBaseline,
  path: string = productionCmsPaths().importBaselineJson,
): void {
  writeFileSync(path, JSON.stringify(baseline, null, 2), "utf8");
}

/** Compare current import against prior baseline; return errors and warnings. */
export function evaluateImportRegression(
  organizations: Organization[],
  stats: CmsImportStats,
  manifest: HealthPlanCatalogImportManifest,
  prior: ImportBaseline | null,
): RegressionFinding[] {
  const findings: RegressionFinding[] = [];
  const byType = countByType(organizations);
  const stateCounts = stateCountsFromOrgs(organizations);

  if (manifest.organizations.duplicateIds > 0) {
    findings.push({
      severity: "error",
      code: "duplicate_org_ids",
      message: `Duplicate organization IDs detected: ${manifest.organizations.duplicateIds}`,
    });
  }

  if (byType.medicareAdvantage === 0) {
    findings.push({
      severity: "error",
      code: "missing_ma_partd",
      message: "No Medicare Advantage / Part D organizations in catalog after import.",
    });
  }

  if (!prior) {
    findings.push({
      severity: "warning",
      code: "no_prior_baseline",
      message: "No prior import baseline — regression comparison skipped for count drops.",
    });
    return findings;
  }

  const totalDrop = prior.totalHealthPlans - organizations.length;
  if (
    totalDrop > 0 &&
    totalDrop / Math.max(prior.totalHealthPlans, 1) >= MATERIAL_DROP_RATIO
  ) {
    findings.push({
      severity: "error",
      code: "total_plans_drop",
      message: `Total health plans dropped materially: ${prior.totalHealthPlans} → ${organizations.length} (-${totalDrop})`,
    });
  }

  const qhpDrop = prior.qhpIssuers - byType.acaMarketplace;
  if (qhpDrop >= MATERIAL_QHP_DROP) {
    findings.push({
      severity: "error",
      code: "qhp_issuer_drop",
      message: `QHP issuer count dropped materially: ${prior.qhpIssuers} → ${byType.acaMarketplace} (-${qhpDrop})`,
    });
  }

  const medicaidDrop = prior.medicaidMcos - byType.medicaidManagedCare;
  if (
    medicaidDrop > 0 &&
    medicaidDrop / Math.max(prior.medicaidMcos, 1) >= MATERIAL_DROP_RATIO
  ) {
    findings.push({
      severity: "error",
      code: "medicaid_mco_drop",
      message: `Medicaid MCO count dropped materially: ${prior.medicaidMcos} → ${byType.medicaidManagedCare} (-${medicaidDrop})`,
    });
  }

  for (const [state, priorCount] of Object.entries(prior.stateCounts)) {
    const currentCount = stateCounts[state] ?? 0;
    if (priorCount > 0 && currentCount === 0) {
      findings.push({
        severity: "error",
        code: "state_zero_coverage",
        message: `State ${state} unexpectedly went to zero coverage (was ${priorCount} orgs).`,
      });
    }
  }

  if (stats.qhpNetNewFromServiceArea < 0) {
    findings.push({
      severity: "warning",
      code: "qhp_service_area_anomaly",
      message: "QHP service area net-new issuer count is negative — check merge inputs.",
    });
  }

  return findings;
}

export function formatRegressionFindings(findings: RegressionFinding[]): string {
  if (findings.length === 0) return "Import regression: all checks passed.";
  return findings
    .map((finding) => `[${finding.severity.toUpperCase()}] ${finding.code}: ${finding.message}`)
    .join("\n");
}

export function hasRegressionErrors(findings: RegressionFinding[]): boolean {
  return findings.some((finding) => finding.severity === "error");
}
