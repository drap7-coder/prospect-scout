import { NextResponse } from "next/server";
import type { RawSearchInput } from "@/lib/search/types";
import { runSearchWithProviders } from "@/lib/search/runSearchSec";

/**
 * POST /api/search
 *
 * Body: { sells, buyerPack?, targets?, region? }
 * Returns: { query, prospects }
 *
 * The handler is intentionally thin: it validates input shape and delegates
 * to the `runSearchWithProviders` pipeline. That pipeline always serves mock
 * data and augments it with REAL SEC EDGAR signals when the query references a
 * public company/ticker. SEC failures are non-fatal (graceful mock fallback).
 */
export async function POST(request: Request) {
  let body: Partial<RawSearchInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const sells = typeof body.sells === "string" ? body.sells : "";
  if (!sells.trim()) {
    return NextResponse.json(
      { error: "Tell Prospect Scout what you sell to begin a search." },
      { status: 400 },
    );
  }

  const input: RawSearchInput = {
    sells,
    buyerPack: typeof body.buyerPack === "string" ? body.buyerPack : undefined,
    targets: typeof body.targets === "string" ? body.targets : undefined,
    region: typeof body.region === "string" ? body.region : undefined,
    excludedTargets: Array.isArray(body.excludedTargets)
      ? body.excludedTargets.filter((t): t is string => typeof t === "string")
      : undefined,
  };

  const result = await runSearchWithProviders(input);
  return NextResponse.json(result);
}
