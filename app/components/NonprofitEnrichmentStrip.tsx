"use client";

import { useEffect, useState } from "react";
import type { NonprofitEnrichment } from "@/lib/discovery/connectors/propublica/types";

function formatUsd(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000).toLocaleString()}K`;
  }
  return `$${value.toLocaleString()}`;
}

function parseCityFromLocation(location: string): string | null {
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
  const [enrichment, setEnrichment] = useState<NonprofitEnrichment | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setFailed(false);
    setEnrichment(null);

    fetch("/api/enrich/nonprofit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        ein: ein ?? undefined,
        city: city ?? undefined,
        state: state ?? undefined,
      }),
      signal: ac.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          enrichment?: NonprofitEnrichment | null;
          available?: boolean;
        } | null) => {
          if (data?.enrichment) {
            setEnrichment(data.enrichment);
          } else if (data?.available === false) {
            setFailed(true);
          }
        },
      )
      .catch(() => {
        /* enrichment is best-effort */
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [name, ein, city, state]);

  if (loading) {
    return (
      <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 pl-[calc(1.25rem+2.25rem+0.75rem)]">
        <p className="font-mono text-[0.625rem] text-[var(--result-card-muted-2)]">
          Loading nonprofit filing data…
        </p>
      </div>
    );
  }

  if (!enrichment) {
    if (failed) return null;
    return null;
  }

  const revenue = formatUsd(enrichment.revenue);
  const assets = formatUsd(enrichment.assets);

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
        {enrichment.form990PdfUrl ? (
          <a
            href={enrichment.form990PdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-emerald-300/90 underline hover:text-emerald-200"
          >
            View Form 990
          </a>
        ) : enrichment.profileUrl ? (
          <a
            href={enrichment.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-emerald-300/90 underline hover:text-emerald-200"
          >
            View Form 990
          </a>
        ) : null}
      </div>
    </div>
  );
}

export { parseCityFromLocation };
