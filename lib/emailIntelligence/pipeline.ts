import type { Organization } from "@/lib/discovery/organization";
import { getWarehouseOrganizations } from "@/lib/import/warehouse/organizations";
import { upsertWarehouseOrganization } from "@/lib/import/warehouse/dbPersistence";
import { indexHealthPlanOrganizations } from "@/lib/import/healthPlans/memoryIndex";
import { indexManufacturerOrganizations } from "@/lib/import/manufacturers/memoryIndex";
import {
  enrichOrganizationEmailPattern,
  enrichOrganizationsEmailPatterns,
} from "./enrichOrganization";
import {
  readEmailPatternFromSectorAttributes,
  writeEmailPatternToOrganization,
} from "./sectorAttributes";

export function isEmailIntelligenceOnImportEnabled(): boolean {
  return process.env.EMAIL_INTELLIGENCE_ON_IMPORT === "1";
}

export function isEmailIntelligenceOnDiscoveryEnabled(): boolean {
  return process.env.EMAIL_INTELLIGENCE_ON_DISCOVERY === "1";
}

/** Re-index warehouse connectors after in-memory org mutation. */
export function reindexWarehouseOrganizations(orgs: Organization[]): void {
  const hp = orgs.filter((o) => o.buyerPack === "health-plans");
  const mfg = orgs.filter((o) => o.buyerPack === "manufacturers");
  if (hp.length > 0) indexHealthPlanOrganizations(hp);
  if (mfg.length > 0) indexManufacturerOrganizations(mfg);
}

/** Copy cached warehouse email patterns onto discovery results (sync, no network). */
export function attachEmailPatternsFromWarehouseIndex<T extends Organization>(
  orgs: T[],
): T[] {
  const warehouseIndex = new Map(
    getWarehouseOrganizations().map((o) => [o.id, o]),
  );

  return orgs.map((org) => {
    const cached = warehouseIndex.get(org.id);
    const pattern = readEmailPatternFromSectorAttributes(cached?.sectorAttributes);
    if (!pattern) return org;
    return writeEmailPatternToOrganization(org, pattern) as T;
  });
}

/** Enrich warehouse orgs and persist updates when configured. */
export async function applyEmailIntelligenceToWarehouseOrgs(
  orgs: Organization[],
  opts: { force?: boolean; skipNetwork?: boolean; limit?: number } = {},
): Promise<{ enriched: Organization[]; processed: number }> {
  const slice = opts.limit ? orgs.slice(0, opts.limit) : orgs;
  const enriched = await enrichOrganizationsEmailPatterns(slice, {
    force: opts.force,
    skipNetwork: opts.skipNetwork,
  });

  reindexWarehouseOrganizations(enriched);

  for (const org of enriched) {
    await upsertWarehouseOrganization(org);
  }

  return { enriched, processed: enriched.length };
}

/** Post-import hook — opt-in via EMAIL_INTELLIGENCE_ON_IMPORT=1. */
export async function runEmailIntelligenceAfterWarehouseImport(): Promise<number> {
  if (!isEmailIntelligenceOnImportEnabled()) return 0;
  const orgs = getWarehouseOrganizations().filter((o) => o.website || o.domain);
  const { processed } = await applyEmailIntelligenceToWarehouseOrgs(orgs, {
    skipNetwork: false,
  });
  return processed;
}

/** Attach email intelligence to discovery results (warehouse + live). */
export async function applyEmailIntelligenceToDiscoveryOrgs<T extends Organization>(
  orgs: T[],
): Promise<T[]> {
  if (orgs.length === 0) return orgs;

  const warehouseIndex = new Map(
    getWarehouseOrganizations().map((o) => [o.id, o]),
  );

  const out: T[] = [];
  for (const org of orgs) {
    const cached = warehouseIndex.get(org.id);
    const cachedPattern = readEmailPatternFromSectorAttributes(cached?.sectorAttributes);
    if (cachedPattern) {
      out.push(writeEmailPatternToOrganization(org, cachedPattern) as T);
      continue;
    }

    if (!isEmailIntelligenceOnDiscoveryEnabled()) {
      out.push(org);
      continue;
    }

    if (!org.website && !org.domain) {
      out.push(org);
      continue;
    }

    const { org: enriched } = await enrichOrganizationEmailPattern(org, {
      skipNetwork: false,
    });
    out.push(enriched as T);
  }

  return out;
}

export {
  enrichOrganizationEmailPattern,
  enrichOrganizationsEmailPatterns,
};