import type { SearchIntent } from "../intent";
import type { CatalogRecord } from "./types";
import { ANY_REGION } from "@/lib/search/regions";
import {
  catalogMatchesAnyIndustry,
  catalogSectorMatches,
  intentIndustryIds,
} from "../match";

const REGION_ALIASES: Record<string, string[]> = {
  midwest: ["midwest", "great-lakes", "upper-midwest"],
  northeast: ["northeast", "mid-atlantic", "new-england"],
  southeast: ["southeast", "south"],
  southwest: ["southwest"],
  west: ["west", "mountain-west"],
  "mid-atlantic": ["mid-atlantic", "northeast"],
};

/** Filter catalog records by structured search intent. */
export function filterCatalogByIntent(
  records: CatalogRecord[],
  intent: SearchIntent,
): CatalogRecord[] {
  const hasFilters = Boolean(
    intent.sectorId ||
      intent.industryId ||
      intent.organizationTypeId ||
      intent.state ||
      intent.city ||
      intent.region !== ANY_REGION ||
      intent.keywords.length > 0,
  );

  if (!hasFilters) return records;

  return records.filter((record) => {
    if (!catalogSectorMatches(record, intent)) return false;

    const industries = intentIndustryIds(intent);
    if (industries.length > 0 && !catalogMatchesAnyIndustry(record, industries)) {
      return false;
    }

    if (
      intent.organizationTypeId &&
      record.organizationType !== intent.organizationTypeId
    ) {
      return false;
    }

    if (intent.state) {
      const recordStates = record.states ?? (record.state ? [record.state] : []);
      if (recordStates.length > 0 && !recordStates.includes(intent.state)) {
        return false;
      }
    }

    if (intent.region !== ANY_REGION && record.state) {
      const region = REGION_ALIASES[intent.region] ?? [intent.region];
      const recordRegion = record.regions?.[0];
      if (
        recordRegion &&
        !region.includes(recordRegion.toLowerCase()) &&
        !intent.state
      ) {
        return false;
      }
    }

    if (intent.keywords.length > 0) {
      const hay = [record.name, ...(record.aliases ?? [])]
        .join(" ")
        .toLowerCase();
      const matched = intent.keywords.some((kw) => hay.includes(kw));
      if (!matched && (intent.sectorId || intent.industryId)) {
        // Structured filters already applied; keywords are optional refinement.
      } else if (!matched && !intent.sectorId && !intent.industryId) {
        return false;
      }
    }

    return true;
  });
}
