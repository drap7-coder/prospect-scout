"use client";

import { useNonprofitEnrichment } from "@/lib/intelligence/useNonprofitEnrichment";
import { formatUsdCompact } from "@/lib/intelligence/format";

export function parseCityFromLocation(location: string): string | null {
  const part = location.split(",")[0]?.trim();
  return part && part.length > 1 ? part : null;
}

export function extractEinFromProspectId(id: string): string | null {
  const match = id.match(/(?:irs-nonprofits-|nonprofit-)(\d{9})/i);
  if (match) return match[1]!;
  const digits = id.replace(/\D/g, "");
  if (digits.length === 9) return digits;
  return null;
}

export function isNonprofitProspect(prospect: {
  canonicalOrganizationTypeId?: string;
  sectorId?: string;
  buyerType?: string;
}): boolean {
  return (
    prospect.canonicalOrganizationTypeId === "nonprofit" ||
    prospect.sectorId === "nonprofit" ||
    /nonprofit/i.test(prospect.buyerType ?? "")
  );
}

/** @deprecated Intelligence is synthesized in ResultCard — kept for standalone use. */
export function NonprofitEnrichmentStrip({
  name,
  ein,
  city,
  state,
}: {
  name: string;
  ein?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  const { enrichment, loading } = useNonprofitEnrichment({
    enabled: true,
    name,
    ein,
    city,
    state,
  });

  if (loading || !enrichment) return null;

  const revenue = formatUsdCompact(enrichment.revenue);
  const assets = formatUsdCompact(enrichment.assets);

  return (
    <div className="mt-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2 pl-[calc(1.25rem+2.25rem+0.75rem)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.625rem] text-[var(--result-card-muted)]">
        {enrichment.subsection501c ? (
          <span className="text-emerald-300/90">{enrichment.subsection501c}</span>
        ) : null}
        {revenue ? <span>Revenue {revenue}</span> : null}
        {assets ? <span>Assets {assets}</span> : null}
        {enrichment.latestForm990Year ? (
          <span>990 {enrichment.latestForm990Year}</span>
        ) : null}
        <span>EIN {enrichment.strein}</span>
      </div>
    </div>
  );
}
