import type { Organization } from "@/lib/discovery/organization";
import { getWarehouseOrganizations } from "@/lib/import/warehouse/organizations";
import { upsertWarehouseOrganization } from "@/lib/import/warehouse/dbPersistence";
import { indexHealthPlanOrganizations } from "@/lib/import/healthPlans/memoryIndex";
import { indexManufacturerOrganizations } from "@/lib/import/manufacturers/memoryIndex";
import type { OrganizationExternalId } from "@/lib/organization/model";
import { enrichOrganizationDomain } from "./enrichOrganization";
import { computeDomainCoverageReport } from "./coverage";

export type CatalogEntry<T extends OrganizationExternalId = OrganizationExternalId> = {
  organization: Organization;
  externalIds: T[];
};

export interface CatalogDomainEnrichmentResult<T extends OrganizationExternalId = OrganizationExternalId> {
  entries: CatalogEntry<T>[];
  enrichmentsApplied: number;
}

/** Enrich catalog entries with high-confidence website/domain assignments. */
export function enrichCatalogDomains<T extends OrganizationExternalId>(
  entries: CatalogEntry<T>[],
): CatalogDomainEnrichmentResult<T> {
  let enrichmentsApplied = 0;
  const enriched = entries.map((entry) => {
    const { organization, applied } = enrichOrganizationDomain(
      entry.organization,
      entry.externalIds,
    );
    if (applied) enrichmentsApplied += 1;
    const domain = organization.domain;
    const externalIds = [...entry.externalIds];
    if (domain && !externalIds.some((ext) => ext.idType === "domain" && ext.idValue === domain)) {
      externalIds.push({ idType: "domain", idValue: domain } as T);
    }
    return { organization, externalIds };
  });
  return { entries: enriched, enrichmentsApplied };
}

function reindexWarehouseOrganizations(orgs: Organization[]): void {
  const hp = orgs.filter((o) => o.buyerPack === "health-plans");
  const mfg = orgs.filter((o) => o.buyerPack === "manufacturers");
  if (hp.length) indexHealthPlanOrganizations(hp);
  if (mfg.length) indexManufacturerOrganizations(mfg);
}

/** Backfill domains for all warehouse organizations with optional limit. */
export async function applyDomainIntelligenceToWarehouseOrgs(
  orgs: Organization[],
  opts: { limit?: number; persist?: boolean } = {},
): Promise<{ organizations: Organization[]; enriched: number; coverage: ReturnType<typeof computeDomainCoverageReport> }> {
  const slice = opts.limit ? orgs.slice(0, opts.limit) : orgs;
  let enriched = 0;
  const out: Organization[] = [];

  for (const org of slice) {
    const { organization, applied } = enrichOrganizationDomain(org, org.externalIds, {
      force: !org.domain,
    });
    if (applied) enriched += 1;
    out.push(organization);
    if (opts.persist !== false) {
      await upsertWarehouseOrganization(organization);
    }
  }

  reindexWarehouseOrganizations(out);
  const coverage = computeDomainCoverageReport(out);
  return { organizations: out, enriched, coverage };
}

export function runDomainIntelligenceAfterWarehouseImport(): Promise<number> {
  const orgs = getWarehouseOrganizations();
  return applyDomainIntelligenceToWarehouseOrgs(orgs).then((r) => r.enriched);
}

export { computeDomainCoverageReport };
