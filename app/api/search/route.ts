import { NextResponse } from "next/server";
import type { RawSearchInput } from "@/lib/search/types";
import { searchStateToRawInput } from "@/lib/search/searchState";
import {
  plannedPrimaryProviders,
  plannedSecondaryProviders,
  runProviderPhase,
  runPublicWebPhase,
  type LiveProviderKey,
} from "@/lib/search/providerPhase";
import { planSources } from "@/lib/search/sourcePlanner";
import {
  runSearchMockOnly,
  runSearchWithProviders,
} from "@/lib/search/runSearchSec";

type SearchPhase = "mock" | "provider" | "full";

function buildInput(
  body: Partial<RawSearchInput> & {
    query?: string;
    sector?: string;
    industry?: string;
    organizationType?: string;
    location?: string;
    companySize?: string;
    freshness?: string;
    signals?: string[];
    sources?: string[];
    sellerContext?: string;
    ownership?: string;
    state?: string;
    metro?: string;
    opStates?: string;
    sort?: string;
  },
): RawSearchInput | NextResponse {
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

  if (
    body.sector ||
    body.industry ||
    body.organizationType ||
    body.location ||
    body.companySize ||
    body.freshness ||
    body.signals?.length ||
    body.sources?.length ||
    body.ownership ||
    body.state ||
    body.metro ||
    body.opStates
  ) {
    return searchStateToRawInput({
      query: query.trim() || sells.trim(),
      sector: body.sector ?? null,
      industry: body.industry ?? null,
      organizationType: body.organizationType ?? null,
      location: body.location ?? null,
      companySize: body.companySize ?? null,
      freshness: body.freshness ?? null,
      signals: body.signals ?? [],
      sources: body.sources ?? [],
      sellerContext: body.sellerContext ?? (sells || null),
      ownership: body.ownership ?? null,
      state: body.state ?? null,
      metro: body.metro ?? null,
      operatingStates: body.opStates
        ? body.opStates.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      sort: body.sort ?? null,
    });
  }

  return {
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

function isLiveProvider(value: string): value is LiveProviderKey {
  return (
    value === "cms" ||
    value === "sec" ||
    value === "rss" ||
    value === "fda" ||
    value === "public-web"
  );
}

/**
 * POST /api/search
 *
 * phase=mock     — instant local/mock results + planned provider list
 * phase=provider — single live provider enrichment (parallel-friendly)
 * phase=full     — mock + all providers (default, parallel with timeouts)
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
    phase?: SearchPhase;
    provider?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const built = buildInput(body);
  if (built instanceof NextResponse) return built;
  const input = built;

  const phase: SearchPhase =
    body.phase === "mock" || body.phase === "provider" || body.phase === "full"
      ? body.phase
      : "full";

  if (phase === "mock") {
    const start = Date.now();
    const result = runSearchMockOnly(input);
    const plan = planSources(result.query);
    const primary = plannedPrimaryProviders(plan);
    const secondary = plannedSecondaryProviders(plan);
    console.info(`[search] phase=mock ms=${Date.now() - start} prospects=${result.prospects.length}`);
    return NextResponse.json({
      ...result,
      phase: "mock",
      plannedProviders: primary,
      secondaryProviders: secondary,
    });
  }

  if (phase === "provider") {
    const providerRaw = typeof body.provider === "string" ? body.provider : "";
    if (!isLiveProvider(providerRaw)) {
      return NextResponse.json(
        { error: "Invalid or missing provider for phase=provider." },
        { status: 400 },
      );
    }

    const base = runSearchMockOnly(input);
    const plan = planSources(base.query);
    const allowed = [
      ...plannedPrimaryProviders(plan),
      ...plannedSecondaryProviders(plan),
    ];
    if (!allowed.includes(providerRaw)) {
      return NextResponse.json({
        phase: "provider",
        provider: providerRaw,
        status: "skipped",
        prospects: base.prospects,
        ms: 0,
      });
    }

    const outcome =
      providerRaw === "public-web"
        ? await runPublicWebPhase(base, plan)
        : await runProviderPhase(providerRaw, base);

    return NextResponse.json({
      phase: "provider",
      provider: outcome.provider,
      status: outcome.status,
      prospects: outcome.prospects,
      ms: outcome.ms,
    });
  }

  const result = await runSearchWithProviders(input);
  return NextResponse.json(result);
}
