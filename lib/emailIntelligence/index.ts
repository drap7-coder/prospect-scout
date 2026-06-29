export type {
  CatchAllStatus,
  EmailCandidateResult,
  EmailEvidenceSourceType,
  EmailPatternConfidenceLabel,
  EmailPatternEnrichmentInput,
  EmailPatternEnrichmentResult,
  EmailPatternEvidenceRecord,
  EmailPatternId,
  EmailPatternSource,
  OrganizationEmailPattern,
  PublicEmailObservation,
} from "./types";

export { EMAIL_PATTERN_SECTOR_KEY } from "./types";

export {
  EMAIL_PATTERN_IDS,
  PATTERN_FORMAT_TEMPLATES,
  buildLocalPart,
  classifyLocalPartWithNames,
  formatTemplateForPattern,
  normalizeNameToken,
} from "./patterns";

export { isGenericInboxLocalPart } from "./genericInboxes";

export {
  extractEmailsFromHtml,
  extractMailtoNamePairs,
  isBlockedEvidenceUrl,
} from "./extractEmails";

export {
  confidenceLabelFromScore,
  pickDominantPattern,
  scorePatternConfidence,
} from "./confidence";

export {
  inferOrganizationEmailPattern,
  observationsToEvidence,
} from "./inferPattern";

export {
  generateEmailCandidate,
  describeFormatTemplate,
} from "./generateCandidate";

export { lookupMxProvider, mxProviderFromHosts } from "./mxLookup";

export {
  EMAIL_INTELLIGENCE_PAGE_PATHS,
  MAX_EMAIL_SOURCES_PER_COMPANY,
  MAX_OBSERVED_EMAILS_PER_COMPANY,
  extractPublicEmailEvidence,
} from "./publicWebExtractor";

export {
  readEmailPatternFromSectorAttributes,
  resolveOrganizationDomain,
  organizationNeedsEmailRefresh,
  writeEmailPatternToOrganization,
} from "./sectorAttributes";

export {
  clearInMemoryEmailEvidence,
  emailIntelligenceCacheTtlMs,
  getInMemoryEmailEvidence,
  mergeInMemoryEmailEvidence,
  setInMemoryEmailEvidence,
  shouldSkipEmailEnrichment,
} from "./cache";

export {
  loadEmailPatternEvidence,
  persistEmailPatternEvidence,
} from "./storage";

export {
  attachEmailPatternsFromIndex,
  enrichOrganizationEmailPattern,
  enrichOrganizationsEmailPatterns,
  readOrganizationEmailPattern,
} from "./enrichOrganization";

export type { EnrichEmailPatternOptions } from "./enrichOrganization";

export {
  attachEmailPatternsFromWarehouseIndex,
  applyEmailIntelligenceToDiscoveryOrgs,
  applyEmailIntelligenceToWarehouseOrgs,
  runEmailIntelligenceAfterWarehouseImport,
  isEmailIntelligenceOnDiscoveryEnabled,
  isEmailIntelligenceOnImportEnabled,
} from "./pipeline";

export { buildContactIntelligenceView } from "./formatContactIntelligence";
export type { ContactIntelligenceViewModel } from "./formatContactIntelligence";
