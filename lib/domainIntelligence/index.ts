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
  normalizeBrandPhrase,
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
  resolveParentOrganizationDomain,
} from "./parentPropagation";

export {
  buildParentDomainRules,
  resetParentDomainRulesCache,
  type ParentDomainRule,
  type ParentMatchSignal,
} from "./parentMappings";

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
