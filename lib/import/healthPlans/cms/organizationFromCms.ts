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
  CMS_QHP_CONNECTOR_ID,
  CMS_QHP_SOURCE_NAME,
} from "./types";
import type { CmsCpscOrganization } from "./types";
import { normalizeContractId } from "./parseCsv";

function externalId(
  idType: HealthPlanExternalId["idType"],
  idValue: string,
): HealthPlanExternalId {
  return { idType, idValue };
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

  const organization = finalizeOrganization({
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
    description:
      existing?.description ??
      (org.parentOrganization ? `Part of ${org.parentOrganization}` : null),
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
    healthPlanType: "medicare_advantage",
    tags: [...new Set([...(existing?.tags ?? []), ...org.tags])],
  });

  return { organization, externalIds, healthPlanType: "medicare_advantage" };
}

export function candidateFromQhpIssuer(
  issuer: {
    id: string;
    issuerLegalName: string;
    parentOrganization?: string;
    states: string[];
    hiosIds: string[];
    marketplace: "HealthCare.gov" | "State-Based";
    naicId?: string;
    website?: string;
    datasetRowIds: string[];
  },
  existing?: Organization,
): HealthPlanImportCandidate {
  const externalIds: HealthPlanExternalId[] = issuer.hiosIds.map((hiosId) =>
    externalId("hios", hiosId),
  );
  if (issuer.naicId) externalIds.push(externalId("naic", issuer.naicId));
  const domain = issuer.website ? deriveDomain(issuer.website) : null;
  if (domain) externalIds.push(externalId("domain", domain));
  for (const rowId of issuer.datasetRowIds) {
    externalIds.push(externalId("other", `qhp:${rowId}`));
  }

  const evidence = [
    "CMS QHP issuer import",
    `HIOS ids: ${issuer.hiosIds.join(", ")}`,
    `Marketplace: ${issuer.marketplace}`,
    issuer.parentOrganization ? `Parent: ${issuer.parentOrganization}` : null,
  ].filter((value): value is string => Boolean(value));

  const organization = finalizeOrganization({
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
    description:
      existing?.description ??
      (issuer.parentOrganization ? `Part of ${issuer.parentOrganization}` : null),
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
    healthPlanType: "aca_marketplace",
    tags: [...new Set([...(existing?.tags ?? []), "exchange", "commercial"])],
  });

  return { organization, externalIds, healthPlanType: "aca_marketplace" };
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

  const organization = finalizeOrganization({
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
    description:
      existing?.description ??
      (mco.parentOrganization ? `Part of ${mco.parentOrganization}` : null),
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
    healthPlanType: "medicaid_managed_care",
    tags: [...new Set([...(existing?.tags ?? []), "medicaid"])],
  });

  return { organization, externalIds, healthPlanType: "medicaid_managed_care" };
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
