import type { Organization } from "@/lib/discovery/organization";
import {
  enrichHealthPlanLobClassifications,
  HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
} from "../warehouseMapping";
import { matchGroupCommercialEvidence } from "./matchEvidence";
import { evidencePromotesCommercialLob } from "./promotion";
import {
  mergeGroupCommercialEvidence,
  readGroupCommercialEvidence,
  writeGroupCommercialEvidence,
} from "./storage";
import type {
  ApplyGroupCommercialEvidenceResult,
  GroupCommercialEvidenceRecord,
} from "./types";

function attachEvidenceToOrganization(
  org: Organization,
  record: GroupCommercialEvidenceRecord,
): Organization {
  const existing = readGroupCommercialEvidence(org.sectorAttributes);
  const mergedEvidence = mergeGroupCommercialEvidence(existing, [record]);
  const classifications = enrichHealthPlanLobClassifications(
    org.classifications ?? [],
    org.tags ?? [],
    mergedEvidence,
  );

  const commercialLob = classifications.find(
    (c) => c.namespace === HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
  )?.id;
  const healthPlanType =
    commercialLob === "medicare_advantage" ||
    commercialLob === "aca_marketplace" ||
    commercialLob === "medicaid_managed_care" ||
    commercialLob === "commercial"
      ? commercialLob
      : org.healthPlanType;

  return {
    ...org,
    sectorAttributes: writeGroupCommercialEvidence(org.sectorAttributes, mergedEvidence),
    classifications,
    healthPlanType,
  };
}

/** Apply curated group-commercial evidence to warehouse health-plan organizations. */
export function applyGroupCommercialEvidenceToOrganizations(
  organizations: Organization[],
  records: GroupCommercialEvidenceRecord[],
): { organizations: Organization[]; stats: ApplyGroupCommercialEvidenceResult } {
  let organizationsUpdated = 0;
  let evidenceAttached = 0;
  let commercialPromoted = 0;

  const updated = organizations.map((org) => {
    if (org.buyerPack !== "health-plans" || org.organizationType === "pbm") {
      return org;
    }

    const match = matchGroupCommercialEvidence(org, records);
    if (!match) return org;

    const next = attachEvidenceToOrganization(org, match.record);
    organizationsUpdated += 1;
    evidenceAttached += 1;
    if (evidencePromotesCommercialLob(readGroupCommercialEvidence(next.sectorAttributes))) {
      const hasCommercial = (next.classifications ?? []).some(
        (c) =>
          c.namespace === HEALTH_PLANS_CLASSIFICATION_NAMESPACE && c.id === "commercial",
      );
      if (hasCommercial) commercialPromoted += 1;
    }
    return next;
  });

  return {
    organizations: updated,
    stats: {
      organizationsUpdated,
      evidenceAttached,
      commercialPromoted,
    },
  };
}

export function applyGroupCommercialEvidenceToCatalogEntries<
  T extends { organization: Organization },
>(entries: T[], records: GroupCommercialEvidenceRecord[]): { entries: T[]; stats: ApplyGroupCommercialEvidenceResult } {
  const { organizations, stats } = applyGroupCommercialEvidenceToOrganizations(
    entries.map((entry) => entry.organization),
    records,
  );
  return {
    entries: entries.map((entry, index) => ({
      ...entry,
      organization: organizations[index]!,
    })),
    stats,
  };
}
