export type {
  DomainCoverageBucket,
  DomainCoverageReport,
  DomainIntelligenceSource,
  DomainConfidenceLabel,
  DomainLookupResult,
  OrganizationDomainIntelligence,
} from "./types";

export {
  DOMAIN_INTELLIGENCE_SECTOR_KEY,
  DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD,
} from "./types";

export {
  normalizeOrganizationName,
  normalizePrimaryDomain,
  normalizeWebsiteUrl,
  websiteFromDomain,
  confidenceLabelFromScore,
} from "./normalize";

export {
  buildDomainRegistry,
  resetDomainRegistryCache,
  type DirectoryDomainRecord,
  type DomainRegistryIndex,
} from "./registry";

export {
  resolveHighConfidenceDomain,
  domainLookupFromPropagatedDomain,
} from "./resolveDomain";

export {
  enrichOrganizationDomain,
  readDomainIntelligence,
} from "./enrichOrganization";

export { computeDomainCoverageReport } from "./coverage";

export {
  enrichCatalogDomains,
  applyDomainIntelligenceToWarehouseOrgs,
  runDomainIntelligenceAfterWarehouseImport,
  type CatalogEntry,
  type CatalogDomainEnrichmentResult,
} from "./pipeline";
