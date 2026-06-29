import type { SearchIntent } from "@/lib/discovery/intent";
import { HEALTH_PLANS_CLASSIFICATION_NAMESPACE } from "@/lib/import/healthPlans/warehouseMapping";

export type {
  EnterpriseProfile,
  EnterpriseRegistryEntry,
  EnterpriseRollupDiagnostics,
  EnterpriseRollupResult,
  EnterpriseSegmentEvidence,
  ResolvedEnterpriseKey,
} from "./types";

export { ENTERPRISE_PROFILE_SECTOR_KEY } from "./types";

export {
  buildEnterpriseRegistry,
  resetEnterpriseRegistryCache,
  registryByParentName,
} from "./registry";

export { resolveEnterpriseKey } from "./resolveKey";

export {
  buildEnterpriseProfile,
  enterpriseProfileToClassifications,
} from "./buildProfile";

export {
  rollupRankedOrganizations,
  rollupAllHealthPlanOrganizations,
  enterpriseProfileToRankedOrganization,
  type RollupRankedResult,
} from "./rollup";

export {
  computeEnterpriseRollupDiagnostics,
  findEnterpriseProfileById,
  getSourceOrganizationsForEnterprise,
} from "./diagnostics";

export {
  buildEnterpriseProspectDisplay,
  formatEnterpriseRollupSummary,
  type EnterpriseProspectDisplay,
} from "./prospectDisplay";

/** Whether default search should roll child orgs into enterprise profiles. */
export function shouldApplyEnterpriseRollup(intent: SearchIntent): boolean {
  if (process.env.ENTERPRISE_ROLLUP === "0") return false;
  if (process.env.ENTERPRISE_ROLLUP === "1") return true;

  const q = intent.query.toLowerCase();

  if (
    intent.organizationTypeId === "health-plan" ||
    intent.classificationFilter?.namespace === HEALTH_PLANS_CLASSIFICATION_NAMESPACE
  ) {
    return true;
  }

  if (
    /\b(health plan|health plans|payer|payers|insurer|insurers|mco|medicare|medicaid|carrier|carriers|qhps?|managed care)\b/.test(
      q,
    )
  ) {
    return true;
  }

  if (intent.sectorId === "healthcare" && intent.organizationTypeId !== "manufacturer") {
    return true;
  }

  return false;
}

export function readEnterpriseProfileFromOrg(
  org: { sectorAttributes?: Record<string, unknown> | null },
): import("./types").EnterpriseProfile | null {
  const raw = org.sectorAttributes?.enterpriseProfile;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as import("./types").EnterpriseProfile;
}
