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
  normalizeBluesBrandPhrase,
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

export { CURATED_PARENT_DOMAIN_RULES } from "./curatedParents";

export {
  resolveRegionalPlanDomain,
  REGIONAL_PLAN_DOMAIN_ENTRIES,
  type RegionalPlanDomainEntry,
  type RegionalPlanType,
} from "./regionalPlanRegistry";

export {
  resolveImportTimeDomain,
  type ImportPropagationResult,
} from "./importPropagation";

export {
  inferStatesFromOrgText,
  resolveOrgStates,
  collectOrgNameTexts,
} from "./stateInference";

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
