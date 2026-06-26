"use client";

import { useState } from "react";
import type {
  BuyerPackId,
  Prospect,
  SearchResponse,
} from "@/lib/search/types";
import { ANY_REGION, regionLabel } from "@/lib/search/regions";
import { SellerInput } from "./SellerInput";
import { BuyerPackSelector } from "./BuyerPackSelector";
import { RegionSelector } from "./RegionSelector";
import { ProspectCard } from "./ProspectCard";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";

type Status = "idle" | "loading" | "done" | "error";

export function SearchPanel() {
  const [sells, setSells] = useState("");
  const [buyerPack, setBuyerPack] = useState<BuyerPackId>("health-plans");
  const [targets, setTargets] = useState("");
  const [region, setRegion] = useState<string>(ANY_REGION);

  const [status, setStatus] = useState<Status>("idle");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<{
    sells: string;
    region: string;
  } | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!sells.trim()) {
      setError("Tell Prospect Scout what you sell to begin a search.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sells, buyerPack, targets, region }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Search failed. Please try again.");
      }

      const data = (await res.json()) as SearchResponse;
      setProspects(data.prospects);
      setLastQuery({
        sells: data.query.profile.whatTheySell,
        region: data.query.profile.region,
      });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <form
        onSubmit={handleSearch}
        className="h-fit space-y-5 rounded-2xl border border-border bg-surface/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm lg:sticky lg:top-20"
      >
        <SellerInput value={sells} onChange={setSells} />
        <BuyerPackSelector value={buyerPack} onChange={setBuyerPack} />

        <div>
          <label htmlFor="targets-input" className="label-mono">
            Who you target <span className="normal-case">(optional)</span>
          </label>
          <input
            id="targets-input"
            type="text"
            value={targets}
            onChange={(e) => setTargets(e.target.value)}
            placeholder="e.g. Regional health plans"
            className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-foreground placeholder:text-muted-2 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
        </div>

        <RegionSelector value={region} onChange={setRegion} />

        <button
          type="submit"
          disabled={status === "loading"}
          className="group relative w-full overflow-hidden rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Scouting…" : "Search prospects"}
        </button>

        {status === "error" && error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : null}
      </form>

      <div>
        {status === "done" && lastQuery ? (
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {prospects.length} prospect{prospects.length === 1 ? "" : "s"} worth
              calling
            </h2>
            <p className="label-mono">
              {(lastQuery.sells || "Your offering") + " · " + regionLabel(lastQuery.region)}
            </p>
          </div>
        ) : null}

        {status === "loading" ? <LoadingState /> : null}

        {status === "idle" || (status === "error" && prospects.length === 0) ? (
          <EmptyState />
        ) : null}

        {status === "done" && prospects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">
              No matching prospects yet.
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Try a different buyer ecosystem or widen the geography.
            </p>
          </div>
        ) : null}

        {status === "done" && prospects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {prospects.map((prospect, i) => (
              <ProspectCard key={prospect.id} prospect={prospect} rank={i + 1} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
