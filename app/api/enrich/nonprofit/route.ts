import { NextResponse } from "next/server";
import { enrichNonprofit } from "@/lib/discovery/connectors/propublica";

/**
 * POST /api/enrich/nonprofit
 * Server-side ProPublica enrichment — no API key required.
 */
export async function POST(request: Request) {
  let body: {
    name?: string;
    ein?: string;
    city?: string;
    state?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await enrichNonprofit({
    name: body.name ?? null,
    ein: body.ein ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
  });

  return NextResponse.json(result);
}
