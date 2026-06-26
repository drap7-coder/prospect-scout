"use client";

import type { BuyerPackId } from "@/lib/search/types";
import { buyerPackList } from "@/lib/packs";

interface BuyerPackSelectorProps {
  value: BuyerPackId;
  onChange: (value: BuyerPackId) => void;
}

export function BuyerPackSelector({ value, onChange }: BuyerPackSelectorProps) {
  const selected = buyerPackList.find((p) => p.id === value);

  return (
    <div>
      <span className="label-mono">Who buys it</span>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {buyerPackList.map((pack) => {
          const active = pack.id === value;
          return (
            <button
              key={pack.id}
              type="button"
              onClick={() => onChange(pack.id)}
              aria-pressed={active}
              className={`group relative overflow-hidden rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
                active
                  ? "border-accent bg-accent-soft text-foreground"
                  : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground"
              }`}
            >
              {active ? (
                <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
              ) : null}
              {pack.label}
            </button>
          );
        })}
      </div>
      {selected ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-2">
          {selected.description}
        </p>
      ) : null}
    </div>
  );
}
