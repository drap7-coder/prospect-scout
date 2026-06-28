import { sourceStamp } from "@/lib/discovery/connector";
import {
  deriveDomain,
  finalizeOrganization,
  type Organization,
} from "@/lib/discovery/organization";
import type { HealthPlanImportCandidate, HealthPlanExternalId } from "./types";
import {
  CMS_CPSC_CONNECTOR_ID,
  CMS_CPSC_SOURCE_NAME,
  CMS_MEDICAID_MCO_CONNECTOR_ID,
  CMS_MEDICAID_MCO_SOURCE_NAME,
  CMS_MEDICAID_ENROLLMENT_CONNECTOR_ID,
  CMS_MEDICAID_ENROLLMENT_SOURCE_NAME,
  CMS_QHP_CONNECTOR_ID,
  CMS_QHP_SOURCE_NAME,
} from "./types";
import type { CmsCpscOrganization } from "./types";
import { normalizeContractId } from "./parseCsv";
import {
  applyHealthPlanWarehouseFields,
  buildHealthPlanOrganizationFields,
} from "../warehouseMapping";
import {
  classificationsFromCpscOrganization,
  classificationsFromMedicaidEnrollmentRow,
  classificationsFromMedicaidMcoRow,
  classificationsFromQhpRow,
} from "./classificationsFromCms";
import type { OrganizationMetric } from "@/lib/organization/intelligence";

function externalId(
  idType: HealthPlanExternalId["idType"],
  idValue: string,
): HealthPlanExternalId {
  return { idType, idValue };
}

function finalizeHealthPlanOrganization(
  base: Organization,
  externalIds: HealthPlanExternalId[],
  fields: Omit<Parameters<typeof buildHealthPlanOrganizationFields>[0], "externalIds">,
  healthPlanType?: HealthPlanImportCandidate["healthPlanType"],
  metrics?: OrganizationMetric[],
): HealthPlanImportCandidate {
  const warehouseFields = buildHealthPlanOrganizationFields({
    ...fields,
    externalIds,
  });
  const organization = finalizeOrganization({
    ...applyHealthPlanWarehouseFields(base, warehouseFields),
    metrics: metrics?.length ? metrics : base.metrics,
  });
  return {
    organization,
    externalIds,
    healthPlanType: healthPlanType ?? organization.healthPlanType,
  };
}

export function candidateFromCpscOrganization(
  org: CmsCpscOrganization,
  existing?: Organization,
): HealthPlanImportCandidate {
  const externalIds: HealthPlanExternalId[] = org.contractIds.map((contractId) =>
    externalId("cms_contract", normalizeContractId(contractId)),
  );
  if (org.naicId) externalIds.push(externalId("naic", org.naicId));

  for (const rowId of org.datasetRowIds) {
    externalIds.push(externalId("other", `cpsc:${rowId}`));
  }

  const evidence = [
    "CMS CPSC contract summary import",
    `Contracts: ${org.contractIds.join(", ")}`,
    org.parentOrganization ? `Parent: ${org.parentOrganization}` : null,
    org.starRating != null ? `Star rating: ${org.starRating}` : null,
  ].filter((value): value is string => Boolean(value));

  const organization: Organization = {
    id: existing?.id ?? org.id,
    canonicalName: existing?.canonicalName ?? org.marketingName,
    aliases: [...new Set([...org.aliases, ...(existing?.aliases ?? [])])],
    website: existing?.website ?? null,
    domain: existing?.domain ?? null,
    organizationType: "health-plan",
    industries: ["payers"],
    sectorId: "healthcare",
    headquarters: existing?.headquarters ?? null,
    locations: existing?.locations ?? [],
    states: [...new Set([...org.states, ...(existing?.states ?? [])])],
    regions: existing?.regions ?? [],
    ownership: existing?.ownership ?? "private",
    employeeRange: existing?.employeeRange ?? null,
    memberEstimate: existing?.memberEstimate ?? null,
    revenueRange: existing?.revenueRange ?? null,
    description: existing?.description ?? null,
    sources: [
      sourceStamp(CMS_CPSC_CONNECTOR_ID, org.id, evidence, {
        sourceName: CMS_CPSC_SOURCE_NAME,
        sourceUrl: "fixtures/import/cms/cpsc-contracts.csv",
        lastUpdated: new Date().toISOString().slice(0, 10),
        confidence: 0.88,
      }),
      ...(existing?.sources.filter((s) => s.connector !== CMS_CPSC_CONNECTOR_ID) ??
        []),
    ],
    buyerPack: "health-plans",
    canonicalOrganizationType: "health-plan",
    tags: [...new Set([...(existing?.tags ?? []), ...org.tags])],
  };

  return finalizeHealthPlanOrganization(
    organization,
    externalIds,
    {
      parentOrganization: org.parentOrganization,
      states: organization.states,
      regions: organization.regions,
      headquarters: organization.headquarters,
      classifications: classificationsFromCpscOrganization(org),
      marketSegment: "medicare_advantage",
      national: organization.states.length === 0,
      tags: organization.tags,
    },
    "medicare_advantage",
  );
}

export function candidateFromQhpIssuer(
  issuer: {
    id: string;
    hiosIssuerId: string;
    issuerLegalName: string;
    parentOrganization?: string;
    states: string[];
    hiosIds: string[];
    marketplace: "HealthCare.gov" | "State-Based";
    marketplaces?: ("HealthCare.gov" | "State-Based")[];
    naicId?: string;
    website?: string;
    serviceAreaIds?: string[];
    serviceAreaNames?: string[];
    marketCoverages?: string[];
    sourcePufs?: string[];
    datasetRowIds: string[];
  },
  existing?: Organization,
): HealthPlanImportCandidate {
  const externalIds: HealthPlanExternalId[] = issuer.hiosIds.map((hiosId) =>
    externalId("hios", hiosId),
  );
  if (issuer.hiosIssuerId && !issuer.hiosIds.includes(issuer.hiosIssuerId)) {
    externalIds.push(externalId("hios", issuer.hiosIssuerId));
  }
  if (issuer.naicId) externalIds.push(externalId("naic", issuer.naicId));
  const domain = issuer.website ? deriveDomain(issuer.website) : null;
  if (domain) externalIds.push(externalId("domain", domain));
  for (const rowId of issuer.datasetRowIds) {
    externalIds.push(externalId("other", `qhp:${rowId}`));
  }

  const evidence = [
    "CMS QHP issuer import",
    `HIOS issuer id: ${issuer.hiosIssuerId}`,
    `HIOS ids: ${issuer.hiosIds.join(", ")}`,
    `Marketplace: ${issuer.marketplaces?.join(", ") ?? issuer.marketplace}`,
    issuer.marketCoverages?.length
      ? `Market coverage: ${issuer.marketCoverages.join(", ")}`
      : null,
    issuer.serviceAreaNames?.length
      ? `Service areas: ${issuer.serviceAreaNames.slice(0, 5).join("; ")}${issuer.serviceAreaNames.length > 5 ? "…" : ""}`
      : null,
    issuer.sourcePufs?.length ? `Sources: ${issuer.sourcePufs.join(", ")}` : null,
    issuer.parentOrganization ? `Parent: ${issuer.parentOrganization}` : null,
  ].filter((value): value is string => Boolean(value));

  const organization: Organization = {
    id: existing?.id ?? issuer.id,
    canonicalName: existing?.canonicalName ?? issuer.issuerLegalName,
    aliases: existing?.aliases ?? [],
    website: issuer.website ?? existing?.website ?? null,
    domain: domain ?? existing?.domain ?? null,
    organizationType: "health-plan",
    industries: ["payers"],
    sectorId: "healthcare",
    headquarters: existing?.headquarters ?? null,
    locations: existing?.locations ?? [],
    states: [...new Set([...issuer.states, ...(existing?.states ?? [])])],
    regions: existing?.regions ?? [],
    ownership: existing?.ownership ?? "private",
    employeeRange: existing?.employeeRange ?? null,
    memberEstimate: existing?.memberEstimate ?? null,
    revenueRange: existing?.revenueRange ?? null,
    description: existing?.description ?? null,
    sources: [
      sourceStamp(CMS_QHP_CONNECTOR_ID, issuer.id, evidence, {
        sourceName: CMS_QHP_SOURCE_NAME,
        sourceUrl: "fixtures/import/cms/qhp-issuers.csv",
        lastUpdated: new Date().toISOString().slice(0, 10),
        confidence: 0.86,
      }),
      ...(existing?.sources.filter((s) => s.connector !== CMS_QHP_CONNECTOR_ID) ??
        []),
    ],
    buyerPack: "health-plans",
    canonicalOrganizationType: "health-plan",
    tags: [...new Set([...(existing?.tags ?? []), "exchange", "commercial"])],
  };

  return finalizeHealthPlanOrganization(
    organization,
    externalIds,
    {
      parentOrganization: issuer.parentOrganization,
      states: organization.states,
      classifications: classificationsFromQhpRow({
        hiosIssuerId: issuer.hiosIssuerId,
        hiosId: issuer.hiosIds[0] ?? issuer.hiosIssuerId,
        issuerLegalName: issuer.issuerLegalName,
        state: issuer.states[0] ?? "",
        marketplace: issuer.marketplace,
        serviceAreaIds: issuer.serviceAreaIds ?? [],
        serviceAreaNames: issuer.serviceAreaNames ?? [],
        marketCoverages: issuer.marketCoverages ?? [],
        coverEntireState: [],
        sourcePufs: issuer.sourcePufs ?? [],
        datasetRowId: issuer.datasetRowIds[0] ?? issuer.id,
      }),
      tags: organization.tags,
    },
    "aca_marketplace",
  );
}

export function candidateFromMedicaidMco(
  mco: {
    id: string;
    organizationName: string;
    parentOrganization: string;
    states: string[];
    mcoIds: string[];
    planType: string;
    naicId?: string;
    datasetRowIds: string[];
  },
  existing?: Organization,
): HealthPlanImportCandidate {
  const externalIds: HealthPlanExternalId[] = mco.mcoIds.map((mcoId) =>
    externalId("other", `medicaid-mco:${mcoId}`),
  );
  if (mco.naicId) externalIds.push(externalId("naic", mco.naicId));
  for (const rowId of mco.datasetRowIds) {
    externalIds.push(externalId("other", `medicaid:${rowId}`));
  }

  const evidence = [
    "CMS Medicaid MCO import",
    `MCO ids: ${mco.mcoIds.join(", ")}`,
    `Parent: ${mco.parentOrganization}`,
  ];

  const organization: Organization = {
    id: existing?.id ?? mco.id,
    canonicalName: existing?.canonicalName ?? mco.organizationName,
    aliases: existing?.aliases ?? [],
    website: existing?.website ?? null,
    domain: existing?.domain ?? null,
    organizationType: "health-plan",
    industries: ["payers"],
    sectorId: "healthcare",
    headquarters: existing?.headquarters ?? null,
    locations: existing?.locations ?? [],
    states: [...new Set([...mco.states, ...(existing?.states ?? [])])],
    regions: existing?.regions ?? [],
    ownership: existing?.ownership ?? "private",
    employeeRange: existing?.employeeRange ?? null,
    memberEstimate: existing?.memberEstimate ?? null,
    revenueRange: existing?.revenueRange ?? null,
    description: existing?.description ?? null,
    sources: [
      sourceStamp(CMS_MEDICAID_MCO_CONNECTOR_ID, mco.id, evidence, {
        sourceName: CMS_MEDICAID_MCO_SOURCE_NAME,
        sourceUrl: "fixtures/import/cms/medicaid-mcos.csv",
        lastUpdated: new Date().toISOString().slice(0, 10),
        confidence: 0.84,
      }),
      ...(existing?.sources.filter(
        (s) => s.connector !== CMS_MEDICAID_MCO_CONNECTOR_ID,
      ) ?? []),
    ],
    buyerPack: "health-plans",
    canonicalOrganizationType: "health-plan",
    tags: [...new Set([...(existing?.tags ?? []), "medicaid"])],
  };

  return finalizeHealthPlanOrganization(
    organization,
    externalIds,
    {
      parentOrganization: mco.parentOrganization,
      states: organization.states,
      classifications: classificationsFromMedicaidMcoRow({
        mcoId: mco.mcoIds[0] ?? mco.id,
        organizationName: mco.organizationName,
        parentOrganization: mco.parentOrganization,
        state: mco.states[0] ?? "",
        planType: mco.planType,
        datasetRowId: mco.datasetRowIds[0] ?? mco.id,
      }),
      tags: organization.tags,
    },
    "medicaid_managed_care",
  );
}

export function candidateFromMedicaidEnrollmentPlan(
  plan: {
    id: string;
    planId: string;
    organizationName: string;
    parentOrganization: string;
    states: string[];
    programNames: string[];
    planType: string;
    enrollment: number;
    reportingPeriod: string;
    naicId?: string;
    datasetRowIds: string[];
  },
  existing?: Organization,
): HealthPlanImportCandidate {
  const externalIds: HealthPlanExternalId[] = [
    externalId("other", `medicaid-enrollment:${plan.planId}`),
  ];
  if (plan.naicId) externalIds.push(externalId("naic", plan.naicId));
  for (const rowId of plan.datasetRowIds) {
    externalIds.push(externalId("other", `medicaid-enroll:${rowId}`));
  }

  const evidence = [
    "Medicaid Managed Care Enrollment Report",
    `Programs: ${plan.programNames.join(", ")}`,
    `Reporting period: ${plan.reportingPeriod}`,
    plan.enrollment > 0
      ? `Total enrollment: ${plan.enrollment.toLocaleString()}`
      : null,
    plan.parentOrganization ? `Parent: ${plan.parentOrganization}` : null,
  ].filter((value): value is string => Boolean(value));

  const organization: Organization = {
    id: existing?.id ?? plan.id,
    canonicalName: existing?.canonicalName ?? plan.organizationName,
    aliases: existing?.aliases ?? [],
    website: existing?.website ?? null,
    domain: existing?.domain ?? null,
    organizationType: "health-plan",
    industries: ["payers"],
    sectorId: "healthcare",
    headquarters: existing?.headquarters ?? null,
    locations: existing?.locations ?? [],
    states: [...new Set([...plan.states, ...(existing?.states ?? [])])],
    regions: existing?.regions ?? [],
    ownership: existing?.ownership ?? "private",
    employeeRange: existing?.employeeRange ?? null,
    memberEstimate:
      plan.enrollment > 0 ? plan.enrollment : (existing?.memberEstimate ?? null),
    revenueRange: existing?.revenueRange ?? null,
    description: existing?.description ?? null,
    sources: [
      sourceStamp(CMS_MEDICAID_ENROLLMENT_CONNECTOR_ID, plan.id, evidence, {
        sourceName: CMS_MEDICAID_ENROLLMENT_SOURCE_NAME,
        sourceUrl:
          "https://data.medicaid.gov/dataset/0bef7b8a-c663-5b14-9a46-0b5c2b86b0fe",
        lastUpdated: plan.reportingPeriod || new Date().toISOString().slice(0, 10),
        confidence: 0.9,
      }),
      ...(existing?.sources.filter(
        (s) => s.connector !== CMS_MEDICAID_ENROLLMENT_CONNECTOR_ID,
      ) ?? []),
    ],
    buyerPack: "health-plans",
    canonicalOrganizationType: "health-plan",
    tags: [...new Set([...(existing?.tags ?? []), "medicaid", "enrollment"])],
  };

  const enrollmentMetrics: OrganizationMetric[] =
    plan.enrollment > 0
      ? [
          {
            id: "enrollment",
            namespace: "health-plans",
            value: plan.enrollment,
            unit: "lives",
            asOfDate: plan.reportingPeriod,
            label: "Medicaid enrollment",
            provenance: {
              sourceConnector: CMS_MEDICAID_ENROLLMENT_CONNECTOR_ID,
              sourceName: CMS_MEDICAID_ENROLLMENT_SOURCE_NAME,
              sourceId: plan.planId,
              refreshedAt: new Date().toISOString(),
              confidence: 0.9,
            },
          },
        ]
      : [];

  return finalizeHealthPlanOrganization(
    organization,
    externalIds,
    {
      parentOrganization: plan.parentOrganization,
      states: organization.states,
      classifications: classificationsFromMedicaidEnrollmentRow({
        planId: plan.planId,
        organizationName: plan.organizationName,
        parentOrganization: plan.parentOrganization,
        state: plan.states[0] ?? "",
        programName: plan.programNames[0] ?? "",
        planType: plan.planType,
        enrollment: plan.enrollment,
        reportingPeriod: plan.reportingPeriod,
        datasetRowId: plan.datasetRowIds[0] ?? plan.id,
      }),
      tags: organization.tags,
    },
    "medicaid_managed_care",
    enrollmentMetrics,
  );
}

export function externalIdsForCandidate(
  candidate: HealthPlanImportCandidate,
): HealthPlanExternalId[] {
  return candidate.externalIds;
}

export function externalIdsForOrganizationFromSeed(
  org: Organization,
  seedExternalIds: HealthPlanExternalId[],
): HealthPlanExternalId[] {
  const ids = [...seedExternalIds];
  if (org.domain) ids.push(externalId("domain", org.domain));
  return ids;
}
