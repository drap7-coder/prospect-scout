import { HEALTH_PLANS_CLASSIFICATION_NAMESPACE } from "@/lib/import/healthPlans/warehouseMapping";
import type { IndustryCatalogNode } from "./types";

const W = "warehouse" as const;
const L = "live-discovery" as const;
const P = "planned" as const;

function healthPlanLobNode(
  id: string,
  label: string,
  description: string,
  classificationId: string,
): IndustryCatalogNode {
  return {
    id,
    label,
    description,
    coverage: W,
    phase: 1,
    sectorId: "healthcare",
    industryId: "payers",
    organizationTypeId: "health-plan",
    warehouseBuyerPack: "health-plans",
    classificationNamespace: HEALTH_PLANS_CLASSIFICATION_NAMESPACE,
    classificationId,
  };
}

/** Health Plans LOB branches — employer/group commercial, government markets, and specialty lines. */
export const HEALTH_PLANS_BRANCH_CHILDREN: IndustryCatalogNode[] = [
  healthPlanLobNode(
    "commercial-plans",
    "Commercial Plans",
    "Employer and group commercial medical plans",
    "commercial",
  ),
  healthPlanLobNode(
    "aca-marketplace-plans",
    "ACA Marketplace",
    "ACA Marketplace and QHP exchange issuers",
    "aca_marketplace",
  ),
  healthPlanLobNode(
    "medicare-advantage-plans",
    "Medicare Advantage Plans",
    "Medicare Advantage and MA-PD plans with CMS warehouse coverage",
    "medicare_advantage",
  ),
  healthPlanLobNode(
    "medicaid-mcos",
    "Medicaid MCOs",
    "Medicaid managed care organizations with CMS warehouse coverage",
    "medicaid_managed_care",
  ),
  {
    id: "tpas-asos",
    label: "TPAs / ASOs",
    description: "Third-party administrators, ASOs, and claims processors",
    coverage: W,
    phase: 1,
    sectorId: "healthcare",
    industryId: "payers",
    organizationTypeId: "tpa",
    warehouseBuyerPack: "health-plans",
  },
  {
    id: "employer-benefit-vendors",
    label: "Employer Benefit Vendors",
    description: "Benefits administration, stop-loss, and enrollment platforms",
    coverage: P,
    phase: 2,
    sectorId: "healthcare",
    industryId: "payers",
  },
  {
    id: "specialty-pharmacy-vendors",
    label: "Specialty / Pharmacy Vendors",
    description: "Specialty drug distribution and patient support vendors",
    coverage: P,
    phase: 2,
    sectorId: "healthcare",
    industryId: "life-sciences",
  },
];

/** Healthcare sector drill-down — v2 warehouse hierarchy. */
export const HEALTHCARE_CATALOG_CHILDREN: IndustryCatalogNode[] = [
  {
    id: "health-plans",
    label: "Health Plans",
    description: "Commercial, ACA Marketplace, Medicare Advantage, and Medicaid plans",
    coverage: W,
    phase: 1,
    sectorId: "healthcare",
    industryId: "payers",
    organizationTypeId: "health-plan",
    warehouseBuyerPack: "health-plans",
    children: HEALTH_PLANS_BRANCH_CHILDREN,
  },
  {
    id: "pbms",
    label: "PBMs",
    description: "Pharmacy benefit managers and drug pricing intermediaries",
    coverage: W,
    phase: 1,
    sectorId: "healthcare",
    industryId: "payers",
    organizationTypeId: "pbm",
    warehouseBuyerPack: "health-plans",
  },
  {
    id: "hospitals-health-systems",
    label: "Hospitals & Health Systems",
    description: "IDNs, hospital operators, and integrated delivery networks",
    coverage: P,
    phase: 2,
    sectorId: "healthcare",
    industryId: "providers",
    organizationTypeId: "health-system",
  },
  {
    id: "provider-groups",
    label: "Provider Groups",
    description: "Medical groups, clinics, and ambulatory networks",
    coverage: L,
    phase: 2,
    sectorId: "healthcare",
    industryId: "providers",
    organizationTypeId: "physician-group",
  },
  {
    id: "pharma-life-sciences",
    label: "Pharma / Life Sciences",
    description: "Pharmaceutical and biotech manufacturers in the warehouse",
    coverage: W,
    phase: 1,
    sectorId: "healthcare",
    industryId: "life-sciences",
    organizationTypeId: "pharma-manufacturer",
    warehouseBuyerPack: "manufacturers",
  },
];
