import { NextResponse } from "next/server";
import {
  computeCatalogFacetCounts,
  hydrateFacetCounts,
} from "@/lib/discovery/catalog/facetCounts";
import { searchStateToDiscoveryIntent } from "@/lib/discovery/searchStateIntent";
import { initDiscoveryEngine } from "@/lib/discovery/discoveryEngine";
import type { SearchState } from "@/lib/search/searchState";

/**
 * POST /api/facets
 * Returns catalog-scoped facet counts (full indexed universe, not current page).
 */
export async function POST(request: Request) {
  initDiscoveryEngine();
  let body: Partial<SearchState> & { query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const intent = searchStateToDiscoveryIntent({
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
  });

  const facets = hydrateFacetCounts(computeCatalogFacetCounts(intent));
  return NextResponse.json({ facets, intent: { query: intent.query } });
}
