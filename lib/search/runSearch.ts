import type {
  RawProspect,
  RawSearchInput,
  SearchResponse,
} from "@/lib/search/types";
import { getBuyerPack } from "@/lib/packs";
import { searchDirectory } from "@/lib/directories/search";
import { directoryRecordsToRawProspects } from "@/lib/directories/toRawProspect";
import { discoverOrganizationsSync } from "@/lib/discovery/discoveryEngine";
import { getCatalogIndex } from "@/lib/discovery/catalog/catalogIndex";
import { catalogOrganizations } from "@/lib/discovery/diagnostics";
import { rankedOrganizationsToRawProspects } from "@/lib/discovery/toRawProspect";
import { parseIntent } from "./intentParser";
import { planSources } from "./sourcePlanner";
import { buildProspectSignals } from "./signalBuilder";
import { scoreProspect } from "./score";
import { synthesizeProspect } from "./synthesize";
import { getMockProspects } from "@/lib/providers/mockProspects";
import { ANY_REGION } from "./regions";

function buildDirectoryQuery(input: RawSearchInput, region: string): string {
  return [input.targets, input.sells, region !== ANY_REGION ? region : ""]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(" ")
    .trim();
}

function hasDiscoveryIntent(input: RawSearchInput, queryText: string): boolean {
  return Boolean(
    input.sectorId ||
      input.industryId ||
      input.organizationTypeId ||
      input.state ||
      /\b(manufacturer|bank|universit|nonprofit|retail|government|health plan|hospital|food|aerospace|logistics|software)\b/i.test(
        queryText,
      ) ||
      /\b(in|near)\s+[a-z]/i.test(queryText),
  );
}

/**
 * Orchestrates the full search pipeline:
 *   raw input -> parse intent -> discovery engine (structured) OR directory
 *   -> (mock fallback) -> exclude targets -> build signals -> score -> sort.
 */
export function runSearch(input: RawSearchInput): SearchResponse {
  const query = parseIntent(input);
  const { profile } = query;
  const plan = planSources(query);
  const pack = getBuyerPack(profile.targetBuyer);

  const queryText =
    (input.query ?? input.targets ?? "").trim() ||
    buildDirectoryQuery(input, profile.region);

  let candidates: RawProspect[] = [];
  let searchedRecords = 0;
  let discoveryMeta: SearchResponse["discovery"];

  if (hasDiscoveryIntent(input, queryText)) {
    const discovery = discoverOrganizationsSync(queryText, {
      sectorId: profile.sectorId,
      industryId: profile.industryId,
      organizationTypeId: profile.organizationTypeId,
      state: profile.state,
      region: profile.region !== ANY_REGION ? profile.region : null,
    });
    searchedRecords = discovery.totalBeforeDedupe;
    discoveryMeta = {
      totalAfterRank: discovery.totalAfterRank,
      totalReturned: discovery.totalReturned,
      catalogTotal: getCatalogIndex().orgs.length,
    };
    if (discovery.organizations.length > 0) {
      candidates = rankedOrganizationsToRawProspects(discovery.organizations);
    }
  }

  if (candidates.length === 0) {
    const directoryQuery = buildDirectoryQuery(input, profile.region);
    const directoryMatches = searchDirectory({
      query: directoryQuery,
      buyerPack: profile.targetBuyer,
      region: profile.region !== ANY_REGION ? profile.region : undefined,
    });
    candidates = directoryRecordsToRawProspects(
      directoryMatches.map((m) => m.record),
    );
  }

  if (candidates.length === 0) {
    candidates = getMockProspects(plan);
  }

  if (profile.excludedTargets.length > 0) {
    candidates = candidates.filter((c) => {
      const haystack = `${c.name} ${c.location} ${c.fitKeywords.join(" ")}`.toLowerCase();
      return !profile.excludedTargets.some((term) => term && haystack.includes(term));
    });
  }

  if (profile.region !== ANY_REGION) {
    const matches = candidates.filter((c) => c.region === profile.region);
    if (matches.length > 0) candidates = matches;
  }

  const prospects = candidates
    .map((candidate) => {
      const signals = buildProspectSignals(candidate);
      const breakdown = scoreProspect(candidate, signals, query);
      return synthesizeProspect(candidate, signals, query, pack, breakdown);
    })
    .sort((a, b) => b.score - a.score);

  const totalCatalogRecords = catalogOrganizations().length;
  const searched = searchedRecords || candidates.length;
  const coveragePercent =
    totalCatalogRecords > 0 ? Math.round((searched / totalCatalogRecords) * 1000) / 10 : 0;
  const confidence =
    prospects.length > 0
      ? Math.round((Math.min(0.95, 0.45 + coveragePercent / 200) + Math.min(0.3, prospects.length / 100)) * 100) / 100
      : 0.25;

  return {
    query,
    prospects,
    coverage: {
      totalCatalogRecords,
      searchedRecords: searched,
      coveragePercent,
      confidence,
    },
    discovery: discoveryMeta ?? {
      totalAfterRank: prospects.length,
      totalReturned: prospects.length,
      catalogTotal: totalCatalogRecords,
    },
  };
}
