import { NextResponse } from "next/server";
import {
  computeMarketCoveragePercent,
  getMarketSize,
  marketSizeQueryFromSearchState,
} from "@/lib/discovery/connectors/census";
import type { SearchState } from "@/lib/search/searchState";

/**
 * POST /api/market-size
 * Server-side Census CBP market sizing — API key never sent to the client.
 */
export async function POST(request: Request) {
  let body: Partial<SearchState> & {
    county?: string | null;
    zip?: string | null;
    naics?: string | null;
    indexedOrganizations?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const query = marketSizeQueryFromSearchState(
    {
      query: typeof body.query === "string" ? body.query : "",
      sector: body.sector ?? null,
      industry: body.industry ?? null,
      organizationType: body.organizationType ?? null,
      location: body.location ?? null,
      companySize: body.companySize ?? null,
      signals: body.signals ?? [],
      sources: body.sources ?? [],
      freshness: body.freshness ?? null,
      sellerContext: body.sellerContext ?? null,
      ownership: body.ownership ?? null,
      state: body.state ?? null,
      metro: body.metro ?? null,
      operatingStates: body.operatingStates ?? [],
      sort: body.sort ?? null,
    },
    {
      county: body.county ?? null,
      zip: body.zip ?? null,
      naics: body.naics ?? null,
    },
  );

  const marketSize = await getMarketSize(query);
  const indexed =
    typeof body.indexedOrganizations === "number" && body.indexedOrganizations >= 0
      ? body.indexedOrganizations
      : null;

  const coveragePercent =
    indexed != null
      ? computeMarketCoveragePercent(indexed, marketSize.estimatedEstablishments)
      : null;

  return NextResponse.json({
    marketSize,
    indexedOrganizations: indexed,
    coveragePercent,
  });
}
