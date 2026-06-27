export type {
  Organization,
  OrganizationSource,
} from "./organization";
export {
  deriveDomain,
  directoryRecordToOrganization,
  organizationsFromDirectory,
  mergeOrganizations,
  dedupeOrganizations,
  organizationDedupeKey,
  normalizeNameKey,
} from "./organization";

export type { SearchIntent, ParseSearchIntentOptions } from "./intent";
export { parseSearchIntent } from "./intent";

export type { RankedOrganization } from "./rank";
export {
  rankOrganizations,
  filterIncompatibleOrganizations,
  scoreOrganizationRelevance,
} from "./rank";

export type { DiscoveryConnector, ConnectorRecord } from "./connector";
export {
  registerConnector,
  getConnectors,
  getConnector,
  sourceStamp,
} from "./connector";

export {
  initDiscoveryEngine,
  discoverOrganizations,
  discoverOrganizationsSync,
  type DiscoverOptions,
  type DiscoverResult,
} from "./discoveryEngine";

export { directoryConnector, filterDirectoryByIntent } from "./connectors/directoryConnector";

export type {
  CoverageReport,
  CompletenessReport,
  DuplicateReport,
  DuplicateGroup,
  DiagnosticsReport,
} from "./diagnostics";
export {
  computeCoverage,
  computeCompleteness,
  detectDuplicates,
  runDiagnostics,
} from "./diagnostics";

export {
  BENCHMARK_QUERIES,
  runBenchmark,
  type BenchmarkReport,
  type BenchmarkQueryResult,
} from "./benchmark";
export {
  assertBenchmarkQuality,
  summarizeBenchmarkQueries,
  type BenchmarkQuerySummary,
} from "./benchmarkQueries";
