import type { Organization } from "@/lib/discovery/organization";
import { extractExternalIds } from "@/lib/discovery/externalIds";
import type { DiscoveryV2Diagnostics } from "@/lib/discovery/discoveryPipelineV2";
import type { SearchIntent } from "@/lib/discovery/intent";
import type { NewDiscoveryRunRow } from "./schema/discoveryRuns";
import type { NewExternalIdRow } from "./schema/externalIds";
import type { NewOrganizationRow } from "./schema/organizations";
import type { NewOrganizationSourceRow } from "./schema/organizationSources";

/** Map in-memory Organization → organizations insert row. */
export function organizationToRow(org: Organization): NewOrganizationRow {
  return {
    id: org.id,
    canonicalName: org.canonicalName,
    aliases: org.aliases,
    website: org.website,
    domain: org.domain,
    organizationType: org.organizationType,
    canonicalOrganizationType: org.canonicalOrganizationType,
    industries: org.industries,
    sectorId: org.sectorId,
    headquarters: org.headquarters,
    locations: org.locations,
    states: org.states,
    regions: org.regions,
    ownership: org.ownership,
    employeeRange: org.employeeRange,
    memberEstimate: org.memberEstimate ?? null,
    revenueRange: org.revenueRange,
    description: org.description,
    buyerPack: org.buyerPack,
    healthPlanType: org.healthPlanType ?? null,
    relevance: org.relevance != null ? String(org.relevance) : null,
    confidence: org.confidence != null ? String(org.confidence) : null,
  };
}

/** Map Organization sources → organization_sources insert rows. */
export function organizationSourcesToRows(
  org: Organization,
): NewOrganizationSourceRow[] {
  return org.sources.map((src) => ({
    organizationId: org.id,
    connector: src.connector,
    sourceId: src.sourceId,
    sourceName: src.sourceName ?? null,
    sourceUrl: src.sourceUrl ?? null,
    lastUpdated: src.lastUpdated ?? null,
    confidence: src.confidence != null ? String(src.confidence) : null,
    retrievedAt: new Date(src.retrievedAt),
    evidence: src.evidence,
  }));
}

/** Map extracted registry ids → external_ids insert rows. */
export function externalIdsToRows(org: Organization): NewExternalIdRow[] {
  const ids = extractExternalIds(org);
  const rows: NewExternalIdRow[] = [];

  if (ids.cik) {
    rows.push({
      organizationId: org.id,
      idType: "cik",
      idValue: ids.cik,
      sourceConnector: "sec",
    });
  }
  if (ids.ein) {
    rows.push({
      organizationId: org.id,
      idType: "ein",
      idValue: ids.ein,
      sourceConnector: "irs-nonprofits",
    });
  }
  if (ids.npi) {
    rows.push({
      organizationId: org.id,
      idType: "npi",
      idValue: ids.npi,
      sourceConnector: "cms",
    });
  }
  if (ids.fdaOrganizationId) {
    rows.push({
      organizationId: org.id,
      idType: "fda",
      idValue: ids.fdaOrganizationId,
      sourceConnector: "fda",
    });
  }
  if (org.domain) {
    rows.push({
      organizationId: org.id,
      idType: "domain",
      idValue: org.domain,
      sourceConnector: null,
    });
  }

  return rows;
}

/** Map discovery v2 diagnostics → discovery_runs insert row. */
export function discoveryRunToRow(input: {
  intent: SearchIntent;
  diagnostics: DiscoveryV2Diagnostics;
  totalBeforeDedupe: number;
  latencyMs: number;
  stagesRun: string[];
  expanded: boolean;
  fallbackReason: string | null;
}): NewDiscoveryRunRow {
  return {
    queryText: input.intent.query,
    intent: {
      query: input.intent.query,
      sectorId: input.intent.sectorId,
      industryId: input.intent.industryId,
      organizationTypeId: input.intent.organizationTypeId,
      state: input.intent.state,
      city: input.intent.city,
      region: input.intent.region,
      keywords: input.intent.keywords,
    },
    connectorCandidates: input.diagnostics.connectorCandidates,
    mergedUnique: input.diagnostics.mergedUnique,
    rankedCount: input.diagnostics.rankedCount,
    displayedCount: input.diagnostics.displayedCount,
    totalBeforeDedupe: input.totalBeforeDedupe,
    latencyMs: String(input.latencyMs),
    stagesRun: input.stagesRun,
    expanded: input.expanded,
    fallbackReason: input.fallbackReason,
  };
}
