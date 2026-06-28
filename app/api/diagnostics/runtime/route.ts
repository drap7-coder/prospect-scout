import { NextResponse } from "next/server";
import { computeRuntimeDiagnostics } from "@/lib/runtime/runtimeDiagnostics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Lightweight JSON snapshot for comparing local vs deployed runtime. */
export async function GET() {
  const diagnostics = await computeRuntimeDiagnostics();
  return NextResponse.json(diagnostics, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
