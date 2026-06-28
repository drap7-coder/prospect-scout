import type { Prospect } from "@/lib/search/types";
import type { BrowseContext, BrowseLensId, BrowseRow } from "./types";
import { buildAlphabetRows } from "@/lib/discovery/alphabetRows";
import { buildCategoryRows } from "./buildCategoryRows";
import { buildGeographyRows } from "./buildGeographyRows";
import { buildOpportunityRows } from "./buildOpportunityRows";

function alphabetToBrowseRows(prospects: Prospect[]): BrowseRow[] {
  return buildAlphabetRows(prospects).map((row) => ({
    ...row,
    totalCount: row.prospects.length,
    summaryMetrics: [
      { label: "Organizations", value: String(row.prospects.length) },
    ],
  }));
}

export function buildBrowseRows(
  lens: BrowseLensId,
  prospects: Prospect[],
  ctx: BrowseContext,
): BrowseRow[] {
  switch (lens) {
    case "category":
      return buildCategoryRows(prospects, ctx);
    case "geography":
      return buildGeographyRows(prospects);
    case "opportunity":
      return buildOpportunityRows(prospects);
    case "alphabet":
      return alphabetToBrowseRows(prospects);
    default:
      return [];
  }
}

export function defaultBrowseLens(): BrowseLensId {
  return "category";
}
