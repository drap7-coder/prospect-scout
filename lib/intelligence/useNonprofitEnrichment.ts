"use client";

import { useEffect, useState } from "react";
import type { NonprofitEnrichment } from "@/lib/discovery/connectors/propublica/types";

export function useNonprofitEnrichment(input: {
  enabled: boolean;
  name: string;
  ein?: string | null;
  city?: string | null;
  state?: string | null;
}): {
  enrichment: NonprofitEnrichment | null;
  loading: boolean;
} {
  const [enrichment, setEnrichment] = useState<NonprofitEnrichment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!input.enabled) {
      setEnrichment(null);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);

    fetch("/api/enrich/nonprofit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        ein: input.ein ?? undefined,
        city: input.city ?? undefined,
        state: input.state ?? undefined,
      }),
      signal: ac.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { enrichment?: NonprofitEnrichment | null } | null) => {
        setEnrichment(data?.enrichment ?? null);
      })
      .catch(() => {
        /* optional enrichment */
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [input.enabled, input.name, input.ein, input.city, input.state]);

  return { enrichment, loading };
}
