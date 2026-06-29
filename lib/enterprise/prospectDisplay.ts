import type { EnterpriseProfile } from "./types";
import type { Prospect } from "@/lib/search/types";
import type { SearchState } from "@/lib/search/searchState";
import { classificationFilterLabel } from "@/lib/search/classificationFilters";
import { HEALTH_PLANS_CLASSIFICATION_NAMESPACE } from "@/lib/import/healthPlans/warehouseMapping";

const LOB_LABELS: Record<string, string> = {
  commercial: "Commercial",
  medicare_advantage: "Medicare Advantage",
  medicaid_managed_care: "Medicaid",
  aca_marketplace: "ACA Marketplace",
  part_d: "Part D",
  chip: "CHIP",
};

function lobLabel(id: string): string {
  return LOB_LABELS[id] ?? classificationFilterLabel(HEALTH_PLANS_CLASSIFICATION_NAMESPACE, id) ?? id.replace(/_/g, " ");
}

function prospectLobIds(prospect: Prospect): string[] {
  if (prospect.enterpriseProfile?.linesOfBusiness.length) {
    return prospect.enterpriseProfile.linesOfBusiness;
  }
  return (prospect.classifications ?? [])
    .filter((c) => c.namespace === HEALTH_PLANS_CLASSIFICATION_NAMESPACE)
    .map((c) => c.id);
}

export interface EnterpriseProspectDisplay {
  isEnterprise: boolean;
  enterpriseBadge: string | null;
  collapseLine: string | null;
  matchedLob: string | null;
  alsoOffers: string | null;
}

export function buildEnterpriseProspectDisplay(
  prospect: Prospect,
  searchState?: Pick<SearchState, "classificationNamespace" | "classificationId"> | null,
): EnterpriseProspectDisplay {
  const enterprise = prospect.enterpriseProfile;
  const isEnterprise = Boolean(prospect.isEnterpriseRollup && enterprise);

  let enterpriseBadge: string | null = null;
  let collapseLine: string | null = null;

  if (isEnterprise && enterprise) {
    enterpriseBadge = "Enterprise";
    if (enterprise.childCount > 1) {
      collapseLine = `Collapsed from ${enterprise.childCount} organizations`;
    } else if (prospect.childOrganizationCount && prospect.childOrganizationCount > 1) {
      collapseLine = `Collapsed from ${prospect.childOrganizationCount} organizations`;
    }
  }

  const matchedLob =
    searchState?.classificationNamespace && searchState.classificationId
      ? `Matched: ${classificationFilterLabel(searchState.classificationNamespace, searchState.classificationId) ?? lobLabel(searchState.classificationId)}`
      : null;

  let alsoOffers: string | null = null;
  if (searchState?.classificationId) {
    const requested = searchState.classificationId;
    const otherLobs = prospectLobIds(prospect).filter((id) => id !== requested);
    if (otherLobs.length > 0) {
      alsoOffers = `Also offers: ${otherLobs.map(lobLabel).join(", ")}`;
    }
  }

  return {
    isEnterprise,
    enterpriseBadge,
    collapseLine,
    matchedLob,
    alsoOffers,
  };
}

export function formatEnterpriseRollupSummary(meta: {
  rawCount: number;
  enterpriseCount: number;
  suppressedChildCount: number;
}): string {
  return `${meta.rawCount.toLocaleString()} health plan records collapsed into ${meta.enterpriseCount.toLocaleString()} enterprise profiles`;
}

export function enterpriseProfileChildCount(profile: EnterpriseProfile): number {
  return profile.childCount;
}
