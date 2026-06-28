/**
 * CMS → warehouse classification extraction with provenance.
 * Health-plans connector layer — not interpreted by warehouse core.
 */

import type { OrganizationClassification } from "@/lib/organization/model";
import type { IntelligenceProvenance } from "@/lib/organization/intelligence";
import { mergeClassificationRecords } from "@/lib/organization/intelligence";
import {
  HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
  healthPlanClassification,
  type HealthPlanMarketSegmentId,
} from "../warehouseMapping";
import type {
  CmsCpscOrganization,
  CmsMedicaidMcoRow,
  CmsMedicaidEnrollmentRow,
  CmsQhpRow,
} from "./types";
import {
  CMS_CPSC_CONNECTOR_ID,
  CMS_CPSC_SOURCE_NAME,
  CMS_MEDICAID_ENROLLMENT_CONNECTOR_ID,
  CMS_MEDICAID_ENROLLMENT_SOURCE_NAME,
  CMS_MEDICAID_MCO_CONNECTOR_ID,
  CMS_MEDICAID_MCO_SOURCE_NAME,
  CMS_QHP_CONNECTOR_ID,
  CMS_QHP_SOURCE_NAME,
} from "./types";

export const HEALTH_PLAN_PLAN_TYPE_NAMESPACE = "health-plans.plan_type";
export const HEALTH_PLAN_SNP_NAMESPACE = "health-plans.snp";

export type HealthPlanPlanTypeId = "hmo" | "ppo" | "pos" | "epo" | "pffs";
export type HealthPlanSnpId = "d_snp" | "c_snp" | "i_snp";

function provenance(
  sourceConnector: string,
  sourceName: string,
  sourceId?: string,
  confidence = 0.88,
): IntelligenceProvenance {
  return {
    sourceConnector,
    sourceName,
    sourceId,
    refreshedAt: new Date().toISOString(),
    confidence,
  };
}

function withProv(
  namespace: string,
  id: string,
  label: string,
  prov: IntelligenceProvenance,
): OrganizationClassification {
  return { namespace, id, label, provenance: prov };
}

function planTypeFromText(text: string): HealthPlanPlanTypeId | null {
  const hay = text.toUpperCase();
  if (/\bHMO\b/.test(hay)) return "hmo";
  if (/\bPPO\b/.test(hay)) return "ppo";
  if (/\bPOS\b/.test(hay)) return "pos";
  if (/\bEPO\b/.test(hay)) return "epo";
  if (/\bPFFS\b/.test(hay)) return "pffs";
  return null;
}

function snpFromText(text: string): HealthPlanSnpId | null {
  const hay = text.toUpperCase();
  if (/\bD-SNP\b|\bDSNP\b|\bDUAL\b/.test(hay)) return "d_snp";
  if (/\bC-SNP\b|\bCSNP\b|\bCHRONIC\b/.test(hay)) return "c_snp";
  if (/\bI-SNP\b|\bISNP\b|\bINSTITUTIONAL\b/.test(hay)) return "i_snp";
  return null;
}

function marketSegmentsFromCpsc(org: CmsCpscOrganization): HealthPlanMarketSegmentId[] {
  const segments = new Set<HealthPlanMarketSegmentId>();
  if (org.contractTypes.has("MA") || org.contractTypes.has("MA-PD")) {
    segments.add("medicare_advantage");
  }
  if (org.contractTypes.has("PDP") || org.contractTypes.has("MA-PD")) {
    segments.add("part_d");
  }
  if (segments.size === 0 && org.tags.includes("medicare-advantage")) {
    segments.add("medicare_advantage");
  }
  if (segments.size === 0 && org.tags.includes("part-d")) {
    segments.add("part_d");
  }
  if (segments.size === 0) {
    segments.add("medicare_advantage");
  }
  return [...segments];
}

/** Classifications derived from aggregated CPSC contract rows. */
export function classificationsFromCpscOrganization(
  org: CmsCpscOrganization,
): OrganizationClassification[] {
  const prov = provenance(
    CMS_CPSC_CONNECTOR_ID,
    CMS_CPSC_SOURCE_NAME,
    org.id,
  );
  const records: OrganizationClassification[] = [];

  for (const segment of marketSegmentsFromCpsc(org)) {
    records.push(
      withProv(
        HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
        segment,
        segment === "part_d" ? "Part D" : "Medicare Advantage",
        prov,
      ),
    );
  }

  const planHay = [...org.contractTypes].join(" ") + " " + org.tags.join(" ");
  const planType = planTypeFromText(planHay);
  if (planType) {
    records.push(
      withProv(HEALTH_PLAN_PLAN_TYPE_NAMESPACE, planType, planType.toUpperCase(), prov),
    );
  }

  const snp = snpFromText(planHay);
  if (snp) {
    const snpLabel =
      snp === "d_snp" ? "D-SNP" : snp === "c_snp" ? "C-SNP" : "I-SNP";
    records.push(withProv(HEALTH_PLAN_SNP_NAMESPACE, snp, snpLabel, prov));
  }

  return mergeClassificationRecords(records);
}

export function classificationsFromQhpRow(row: CmsQhpRow): OrganizationClassification[] {
  const prov = provenance(CMS_QHP_CONNECTOR_ID, CMS_QHP_SOURCE_NAME, row.hiosIssuerId);
  return [
    withProv(
      HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
      "aca_marketplace",
      "ACA Marketplace",
      prov,
    ),
  ];
}

export function classificationsFromMedicaidMcoRow(
  row: CmsMedicaidMcoRow,
): OrganizationClassification[] {
  const prov = provenance(
    CMS_MEDICAID_MCO_CONNECTOR_ID,
    CMS_MEDICAID_MCO_SOURCE_NAME,
    row.mcoId,
  );
  const records: OrganizationClassification[] = [
    withProv(
      HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
      "medicaid_managed_care",
      "Medicaid Managed Care",
      prov,
    ),
  ];
  if (/\bchip\b/i.test(row.planType)) {
    records.push(
      withProv(HEALTH_PLANS_CLASSIFICATION_NAMESPACE, "chip", "CHIP", prov),
    );
  }
  return mergeClassificationRecords(records);
}

export function classificationsFromMedicaidEnrollmentRow(
  row: CmsMedicaidEnrollmentRow,
): OrganizationClassification[] {
  const prov = provenance(
    CMS_MEDICAID_ENROLLMENT_CONNECTOR_ID,
    CMS_MEDICAID_ENROLLMENT_SOURCE_NAME,
    row.planId,
  );
  const records: OrganizationClassification[] = [
    withProv(
      HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
      "medicaid_managed_care",
      "Medicaid Managed Care",
      prov,
    ),
  ];
  if (/\bchip\b/i.test(row.programName) || /\bchip\b/i.test(row.planType)) {
    records.push(
      withProv(HEALTH_PLANS_CLASSIFICATION_NAMESPACE, "chip", "CHIP", prov),
    );
  }
  return mergeClassificationRecords(records);
}

/** Backfill classifications from legacy healthPlanType when JSON column is empty. */
export function legacyHealthPlanClassifications(
  healthPlanType: string | null | undefined,
): OrganizationClassification[] {
  if (!healthPlanType) return [];
  if (healthPlanType === "part_d") {
    return [healthPlanClassification("part_d", "Part D")];
  }
  if (
    healthPlanType === "medicare_advantage" ||
    healthPlanType === "aca_marketplace" ||
    healthPlanType === "medicaid_managed_care" ||
    healthPlanType === "commercial"
  ) {
    return [healthPlanClassification(healthPlanType, healthPlanType)];
  }
  return [{ namespace: HEALTH_PLANS_CLASSIFICATION_NAMESPACE, id: healthPlanType }];
}
