import type { Organization } from "@/lib/discovery/organization";
import type { WarehouseConnectorDefinition, WarehouseConnectorSummary } from "../types";
import {
  getHealthPlanOrganizations,
  getHealthPlanIndexSize,
  setHealthPlanIndex,
} from "@/lib/import/healthPlans/memoryIndex";
import { getHealthPlanCatalogImportManifest } from "@/lib/import/healthPlans/catalogManifest";
import { cmsImportMode } from "@/lib/import/healthPlans/cms/resolvePaths";
import {
  importNationalHealthPlanCatalog,
  importHealthPlanFullCatalog,
} from "@/lib/import/healthPlans/cms/importCms";
import { fetchNationalCmsHealthPlanData } from "@/lib/import/healthPlans/cms/sources/fetch";
import { computeHealthPlanCoverageReport } from "@/lib/import/healthPlans/coverageReport";
import { computeHealthPlanCatalogDiagnostics } from "@/lib/import/healthPlans/healthPlanDiagnostics";
import {
  kickoffHealthPlanIndexHydration,
  ensureHealthPlanIndexHydrated,
} from "@/lib/import/healthPlans/hydrateIndex";

export const HEALTH_PLANS_CONNECTOR: WarehouseConnectorDefinition = {
  id: "health-plans",
  label: "Health Plans",
  description:
    "National CMS ingestion — Medicare Advantage / Part D, ACA marketplace issuers, Medicaid MCO.",
  status: "production",
  buyerPack: "health-plans",
};

export function getHealthPlansConnectorOrganizations(): Organization[] {
  return getHealthPlanOrganizations();
}

export function getHealthPlansConnectorIndexSize(): number {
  return getHealthPlanIndexSize();
}

export function summarizeHealthPlansConnector(): WarehouseConnectorSummary {
  const manifest = getHealthPlanCatalogImportManifest();
  return {
    id: HEALTH_PLANS_CONNECTOR.id,
    label: HEALTH_PLANS_CONNECTOR.label,
    status: HEALTH_PLANS_CONNECTOR.status,
    organizationsIndexed: getHealthPlanIndexSize(),
    lastImportAt: manifest?.importedAt ?? null,
    importMode: manifest?.cmsImportMode ?? cmsImportMode(),
  };
}

export const healthPlansConnectorApi = {
  definition: HEALTH_PLANS_CONNECTOR,
  getOrganizations: getHealthPlansConnectorOrganizations,
  getIndexSize: getHealthPlansConnectorIndexSize,
  summarize: summarizeHealthPlansConnector,
  importNational: importNationalHealthPlanCatalog,
  importFull: importHealthPlanFullCatalog,
  fetch: fetchNationalCmsHealthPlanData,
  computeCoverageReport: computeHealthPlanCoverageReport,
  computeDiagnostics: computeHealthPlanCatalogDiagnostics,
  kickoffHydration: kickoffHealthPlanIndexHydration,
  ensureHydrated: ensureHealthPlanIndexHydrated,
  restoreIndex: setHealthPlanIndex,
};
