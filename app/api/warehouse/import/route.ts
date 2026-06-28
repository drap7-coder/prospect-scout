import { NextResponse } from "next/server";
import {
  importOrganizationWarehouse,
  ensureOrganizationWarehouseHydrated,
} from "@/lib/import/warehouse";
import { computeRuntimeDiagnostics } from "@/lib/runtime/runtimeDiagnostics";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "WAREHOUSE_ADMIN_SECRET is not configured. Set it in Vercel env vars to enable remote import.",
    },
    { status: 503 },
  );
}

/** Protected warehouse import for production Neon + in-memory index refresh. */
export async function POST(request: Request) {
  const secret = process.env.WAREHOUSE_ADMIN_SECRET?.trim();
  if (!secret) return notConfigured();

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return unauthorized();

  try {
    const importResult = await importOrganizationWarehouse();
    const hydration = await ensureOrganizationWarehouseHydrated();
    const diagnostics = await computeRuntimeDiagnostics({ skipHydration: true });

    return NextResponse.json({
      ok: true,
      import: importResult,
      hydration,
      diagnostics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[warehouse/import] failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Hydration status without running import. */
export async function GET(request: Request) {
  const secret = process.env.WAREHOUSE_ADMIN_SECRET?.trim();
  if (!secret) return notConfigured();

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return unauthorized();

  const hydration = await ensureOrganizationWarehouseHydrated();
  const diagnostics = await computeRuntimeDiagnostics({ skipHydration: true });

  return NextResponse.json({
    ok: hydration.totalLoaded > 0 && diagnostics.warehouse.activeForSearch,
    hydration,
    diagnostics,
  });
}
