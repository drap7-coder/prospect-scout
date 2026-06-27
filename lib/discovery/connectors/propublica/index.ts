export type {
  NonprofitCandidate,
  NonprofitEnrichment,
  NonprofitEnrichInput,
  NonprofitEnrichResult,
  NonprofitOfficer,
  ProPublicaConnectorStatus,
} from "./types";

export {
  enrichNonprofit,
  getProPublicaConnectorStatus,
  isNonprofitEnrichmentEligible,
} from "./enrich";

export {
  ProPublicaClient,
  getProPublicaClient,
  getProPublicaCacheSize,
  getProPublicaRuntimeStatus,
  resetProPublicaForTests,
  averageProPublicaLatencyMs,
} from "./client";

export {
  normalizeEinDigits,
  einForApiPath,
  formatStrein,
  profileUrlForEin,
  normalizeOrganizationEnrichment,
  normalizeSearchCandidate,
  subsectionLabel,
  nteeCategoryFromCode,
} from "./normalize";

export {
  nameSimilarity,
  scoreNonprofitMatch,
  ENRICHMENT_CONFIDENCE_THRESHOLD,
} from "./confidence";

export { cacheHitRate, resetCacheStatsForTests } from "./cache";
