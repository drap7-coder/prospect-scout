import { NextResponse } from "next/server";
import type { RawSearchInput } from "@/lib/search/types";
import { searchStateToRawInput } from "@/lib/search/searchState";
import { runSearchWithProviders } from "@/lib/search/runSearchSec";

/**
 * POST /api/search
 *
 * Accepts company-discovery queries and optional structured filters.
 * Legacy fields (sells, buyerPack, targets, region) remain supported.
 */
export async function POST(request: Request) {
  let body: Partial<RawSearchInput> & {
    query?: string;
    industry?: string;
    organizationType?: string;
    location?: string;
    companySize?: string;
    signals?: string[];
    sources?: string[];
    sellerContext?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const query =
    typeof body.query === "string"
      ? body.query
      : typeof body.targets === "string"
        ? body.targets
        : "";

  const sells =
    typeof body.sells === "string"
      ? body.sells
      : typeof body.sellerContext === "string"
        ? body.sellerContext
        : "";

  if (!query.trim() && !sells.trim()) {
    return NextResponse.json(
      { error: "Enter a search query to discover companies." },
      { status: 400 },
    );
  }

  let input: RawSearchInput;

  if (
    body.industry ||
    body.organizationType ||
    body.location ||
    body.companySize ||
    body.signals?.length ||
    body.sources?.length
  ) {
    input = searchStateToRawInput({
      query: query.trim() || sells.trim(),
      industry: body.industry ?? null,
      organizationType: body.organizationType ?? null,
      location: body.location ?? null,
      companySize: body.companySize ?? null,
      signals: body.signals ?? [],
      sources: body.sources ?? [],
      sellerContext: body.sellerContext ?? (sells || null),
    });
  } else {
    input = {
      query: query.trim() || undefined,
      sells,
      targets: query.trim() || undefined,
      buyerPack: typeof body.buyerPack === "string" ? body.buyerPack : undefined,
      region: typeof body.region === "string" ? body.region : undefined,
      sellerContext:
        typeof body.sellerContext === "string" ? body.sellerContext : undefined,
      excludedTargets: Array.isArray(body.excludedTargets)
        ? body.excludedTargets.filter((t): t is string => typeof t === "string")
        : undefined,
    };
  }

  const result = await runSearchWithProviders(input);
  return NextResponse.json(result);
}
