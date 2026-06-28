import type { ManufacturerImportStats } from "./types";

export interface ManufacturerCatalogImportManifest {
  importedAt: string;
  mode: "production" | "fixture" | "bootstrap-seed";
  includeBootstrapSeed: boolean;
  importMode: "production" | "fixture";
  rawRecords: {
    sec: number;
    fda: number;
    seed: number;
  };
  pipeline: {
    candidatesBuilt: number;
    merged: number;
    added: number;
    collapsed: number;
    canonicalTotal: number;
    duplicateIds: number;
  };
  bySourceConnector: Record<string, number>;
  byState: Record<string, number>;
  byIndustry: Record<string, number>;
  byOrganizationType: Record<string, number>;
  stats: ManufacturerImportStats;
}

let lastManifest: ManufacturerCatalogImportManifest | null = null;

export function setManufacturerCatalogImportManifest(
  manifest: ManufacturerCatalogImportManifest,
): void {
  lastManifest = manifest;
}

export function getManufacturerCatalogImportManifest(): ManufacturerCatalogImportManifest | null {
  return lastManifest;
}

export function countOrganizationsByConnector(
  organizations: import("@/lib/discovery/organization").Organization[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const org of organizations) {
    for (const source of org.sources) {
      counts[source.connector] = (counts[source.connector] ?? 0) + 1;
    }
  }
  return counts;
}

function countByField(
  organizations: import("@/lib/discovery/organization").Organization[],
  field: "states" | "industries" | "organizationType",
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const org of organizations) {
    if (field === "states") {
      for (const state of org.states) {
        counts[state] = (counts[state] ?? 0) + 1;
      }
      continue;
    }
    if (field === "industries") {
      for (const industry of org.industries) {
        counts[industry] = (counts[industry] ?? 0) + 1;
      }
      continue;
    }
    const key = org.organizationType ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function buildManufacturerManifestFields(
  organizations: import("@/lib/discovery/organization").Organization[],
) {
  return {
    bySourceConnector: countOrganizationsByConnector(organizations),
    byState: countByField(organizations, "states"),
    byIndustry: countByField(organizations, "industries"),
    byOrganizationType: countByField(organizations, "organizationType"),
  };
}
