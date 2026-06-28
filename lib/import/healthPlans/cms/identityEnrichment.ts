import type { Organization } from "@/lib/discovery/organization";
import type { HealthPlanExternalId } from "./types";

type CatalogEntry = {
  organization: Organization;
  externalIds: HealthPlanExternalId[];
};

export interface PossibleDuplicateReview {
  idType: HealthPlanExternalId["idType"];
  idValue: string;
  organizationIds: string[];
  organizationNames: string[];
}

export interface IdentityEnrichmentResult {
  entries: CatalogEntry[];
  enrichmentsApplied: number;
  possibleDuplicates: PossibleDuplicateReview[];
}

function externalIdKey(idType: string, idValue: string): string {
  return `${idType}:${idValue.trim().toLowerCase()}`;
}

/** Propagate verified NAIC/EIN/domain ids across catalog entries sharing HIOS or contract ids. */
export function enrichCatalogIdentity(entries: CatalogEntry[]): IdentityEnrichmentResult {
  const naicByContract = new Map<string, string>();
  const naicByHios = new Map<string, string>();
  const domainByHios = new Map<string, string>();
  const domainByContract = new Map<string, string>();

  for (const entry of entries) {
    const naic = entry.externalIds.find((ext) => ext.idType === "naic")?.idValue;
    const domain =
      entry.externalIds.find((ext) => ext.idType === "domain")?.idValue ??
      entry.organization.domain ??
      undefined;

    for (const ext of entry.externalIds) {
      if (ext.idType === "cms_contract" && naic) {
        naicByContract.set(ext.idValue, naic);
      }
      if (ext.idType === "hios" && naic) {
        naicByHios.set(ext.idValue, naic);
      }
      if (ext.idType === "hios" && domain) {
        domainByHios.set(ext.idValue, domain);
      }
      if (ext.idType === "cms_contract" && domain) {
        domainByContract.set(ext.idValue, domain);
      }
    }
  }

  let enrichmentsApplied = 0;
  const enriched: CatalogEntry[] = entries.map((entry) => {
    const externalIds = [...entry.externalIds];
    const seen = new Set(externalIds.map((ext) => externalIdKey(ext.idType, ext.idValue)));
    let domain = entry.organization.domain;

    const addId = (idType: HealthPlanExternalId["idType"], idValue: string) => {
      const key = externalIdKey(idType, idValue);
      if (seen.has(key)) return;
      seen.add(key);
      externalIds.push({ idType, idValue });
      enrichmentsApplied += 1;
    };

    for (const ext of entry.externalIds) {
      if (ext.idType === "cms_contract") {
        const naic = naicByContract.get(ext.idValue);
        if (naic) addId("naic", naic);
        const contractDomain = domainByContract.get(ext.idValue);
        if (contractDomain) {
          addId("domain", contractDomain);
          domain = domain ?? contractDomain;
        }
      }
      if (ext.idType === "hios") {
        const naic = naicByHios.get(ext.idValue);
        if (naic) addId("naic", naic);
        const hiosDomain = domainByHios.get(ext.idValue);
        if (hiosDomain) {
          addId("domain", hiosDomain);
          domain = domain ?? hiosDomain;
        }
      }
    }

    if (domain && domain !== entry.organization.domain) {
      return {
        organization: { ...entry.organization, domain },
        externalIds,
      };
    }

    return { organization: entry.organization, externalIds };
  });

  return {
    entries: enriched,
    enrichmentsApplied,
    possibleDuplicates: findPossibleDuplicates(enriched),
  };
}

/** Find org pairs sharing verified ids but different organization ids — needs manual review. */
export function findPossibleDuplicates(entries: CatalogEntry[]): PossibleDuplicateReview[] {
  const index = new Map<string, { orgId: string; name: string }[]>();

  for (const entry of entries) {
    for (const ext of entry.externalIds) {
      if (!["naic", "ein", "domain", "hios", "cms_contract"].includes(ext.idType)) {
        continue;
      }
      const key = externalIdKey(ext.idType, ext.idValue);
      const bucket = index.get(key) ?? [];
      bucket.push({ orgId: entry.organization.id, name: entry.organization.canonicalName });
      index.set(key, bucket);
    }
    if (entry.organization.domain) {
      const key = externalIdKey("domain", entry.organization.domain);
      const bucket = index.get(key) ?? [];
      bucket.push({ orgId: entry.organization.id, name: entry.organization.canonicalName });
      index.set(key, bucket);
    }
  }

  const reviews: PossibleDuplicateReview[] = [];
  for (const [key, orgs] of index.entries()) {
    const uniqueOrgIds = [...new Set(orgs.map((org) => org.orgId))];
    if (uniqueOrgIds.length <= 1) continue;
    const [idType, ...rest] = key.split(":");
    reviews.push({
      idType: idType as HealthPlanExternalId["idType"],
      idValue: rest.join(":"),
      organizationIds: uniqueOrgIds,
      organizationNames: uniqueOrgIds.map(
        (orgId) => orgs.find((org) => org.orgId === orgId)?.name ?? orgId,
      ),
    });
  }

  return reviews.sort(
    (a, b) => b.organizationIds.length - a.organizationIds.length || a.idValue.localeCompare(b.idValue),
  );
}
