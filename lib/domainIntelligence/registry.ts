import { HEALTH_PLANS_DIRECTORY } from "@/lib/directories/healthPlans";
import { MANUFACTURERS_DIRECTORY } from "@/lib/directories/manufacturers";
import { HEALTH_PLAN_DIRECTORY } from "@/lib/providers/directories/healthPlanDirectory";
import { normalizeDirectoryRecord } from "@/lib/directories/types";
import type { OrganizationRecord } from "@/lib/directories/types";
import {
  normalizeOrganizationName,
  normalizePrimaryDomain,
  normalizeWebsiteUrl,
} from "./normalize";

export interface DirectoryDomainRecord {
  name: string;
  website: string;
  domain: string;
  headquarters: string | null;
  states: string[];
  cmsContracts: string[];
  naicId: string | null;
  ticker: string | null;
  aliases: string[];
  parentOrganization: string | null;
}

function toDirectoryDomainRecord(record: OrganizationRecord): DirectoryDomainRecord | null {
  const website = normalizeWebsiteUrl(record.website);
  const domain = normalizePrimaryDomain({ website });
  if (!website || !domain) return null;
  return {
    name: record.name,
    website,
    domain,
    headquarters: record.headquarters ?? null,
    states: record.statesServed ?? [],
    cmsContracts: (record.cmsContracts ?? []).map((c) => c.toUpperCase()),
    naicId: record.naicId?.trim() || null,
    ticker: record.ticker?.trim().toUpperCase() || null,
    aliases: record.aliases ?? [],
    parentOrganization: record.parentOrganization?.trim() || null,
  };
}

function supplementalToRecord(entry: (typeof HEALTH_PLAN_DIRECTORY)[number]): OrganizationRecord {
  return normalizeDirectoryRecord({
    id: entry.id,
    name: entry.name,
    aliases: entry.aliases,
    organizationType: "health-plan",
    industry: "health-plans",
    website: entry.website,
    headquarters: entry.state,
    statesServed: [entry.state],
    regions: [entry.region],
    buyerPack: "health-plans",
  });
}

export interface DomainRegistryIndex {
  byName: Map<string, DirectoryDomainRecord[]>;
  byAlias: Map<string, DirectoryDomainRecord[]>;
  byCmsContract: Map<string, DirectoryDomainRecord>;
  byNaic: Map<string, DirectoryDomainRecord>;
  byHios: Map<string, DirectoryDomainRecord>;
  byTicker: Map<string, DirectoryDomainRecord>;
  byParentName: Map<string, DirectoryDomainRecord[]>;
  records: DirectoryDomainRecord[];
}

function indexRecords(records: DirectoryDomainRecord[]): DomainRegistryIndex {
  const byName = new Map<string, DirectoryDomainRecord[]>();
  const byAlias = new Map<string, DirectoryDomainRecord[]>();
  const byCmsContract = new Map<string, DirectoryDomainRecord>();
  const byNaic = new Map<string, DirectoryDomainRecord>();
  const byHios = new Map<string, DirectoryDomainRecord>();
  const byTicker = new Map<string, DirectoryDomainRecord>();
  const byParentName = new Map<string, DirectoryDomainRecord[]>();

  const push = (map: Map<string, DirectoryDomainRecord[]>, key: string, rec: DirectoryDomainRecord) => {
    const bucket = map.get(key) ?? [];
    if (!bucket.some((r) => r.domain === rec.domain)) bucket.push(rec);
    map.set(key, bucket);
  };

  for (const rec of records) {
    push(byName, normalizeOrganizationName(rec.name), rec);
    for (const alias of rec.aliases) {
      push(byAlias, normalizeOrganizationName(alias), rec);
    }
    for (const contract of rec.cmsContracts) {
      byCmsContract.set(contract.toUpperCase(), rec);
      const hiosPrefix = contract.replace(/^H/i, "").slice(0, 4);
      if (hiosPrefix) byHios.set(`H${hiosPrefix}`.toUpperCase(), rec);
    }
    if (rec.naicId) byNaic.set(rec.naicId, rec);
    if (rec.ticker) byTicker.set(rec.ticker, rec);
    if (rec.parentOrganization) {
      push(byParentName, normalizeOrganizationName(rec.parentOrganization), rec);
    }
  }

  return {
    byName,
    byAlias,
    byCmsContract,
    byNaic,
    byHios,
    byTicker,
    byParentName,
    records,
  };
}

let cachedRegistry: DomainRegistryIndex | null = null;

/** Curated high-confidence domain registry from master directories. */
export function buildDomainRegistry(): DomainRegistryIndex {
  if (cachedRegistry) return cachedRegistry;

  const rawRecords: OrganizationRecord[] = [
    ...HEALTH_PLANS_DIRECTORY.map(normalizeDirectoryRecord),
    ...MANUFACTURERS_DIRECTORY.map(normalizeDirectoryRecord),
    ...HEALTH_PLAN_DIRECTORY.map(supplementalToRecord),
  ];

  const seenDomains = new Set<string>();
  const records: DirectoryDomainRecord[] = [];
  for (const raw of rawRecords) {
    const rec = toDirectoryDomainRecord(raw);
    if (!rec || seenDomains.has(rec.domain)) continue;
    seenDomains.add(rec.domain);
    records.push(rec);
  }

  cachedRegistry = indexRecords(records);
  return cachedRegistry;
}

export function resetDomainRegistryCache(): void {
  cachedRegistry = null;
}
