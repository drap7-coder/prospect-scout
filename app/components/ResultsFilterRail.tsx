"use client";

import { useState } from "react";
import type { SearchState } from "@/lib/search/searchState";
import {
  COMPANY_SIZES,
  INDUSTRIES,
  LOCATIONS,
  ORGANIZATION_TYPES,
  SIGNAL_FILTERS,
  SOURCE_FILTERS,
} from "@/lib/search/searchState";
import { sourceTone } from "@/lib/intelligence/colors";

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/60 py-4 last:border-b-0">
      <h3 className="label-mono text-foreground/80">{title}</h3>
      <div className="mt-2.5 space-y-1">{children}</div>
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
  accent,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  accent?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-surface/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-border accent-accent"
      />
      <span className={`text-sm ${accent ?? "text-muted"}`}>{label}</span>
    </label>
  );
}

function RadioRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-surface/80">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 border-border accent-accent"
      />
      <span className="text-sm text-muted">{label}</span>
    </label>
  );
}

export function ResultsFilterRail({
  state,
  onChange,
}: {
  state: SearchState;
  onChange: (partial: Partial<SearchState>) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleSignal(id: string) {
    const next = state.signals.includes(id)
      ? state.signals.filter((s) => s !== id)
      : [...state.signals, id];
    onChange({ signals: next });
  }

  function toggleSource(id: string) {
    const next = state.sources.includes(id)
      ? state.sources.filter((s) => s !== id)
      : [...state.sources, id];
    onChange({ sources: next });
  }

  const rail = (
    <>
      <FilterSection title="Industry">
        <RadioRow
          label="All industries"
          checked={!state.industry}
          onChange={() => onChange({ industry: null })}
        />
        {INDUSTRIES.map((ind) => (
          <RadioRow
            key={ind}
            label={ind}
            checked={state.industry === ind}
            onChange={() => onChange({ industry: ind })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Organization type">
        <RadioRow
          label="All types"
          checked={!state.organizationType}
          onChange={() => onChange({ organizationType: null })}
        />
        {ORGANIZATION_TYPES.map((org) => (
          <RadioRow
            key={org.id}
            label={org.label}
            checked={state.organizationType === org.id}
            onChange={() => onChange({ organizationType: org.id })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Location">
        <RadioRow
          label="All locations"
          checked={!state.location}
          onChange={() => onChange({ location: null })}
        />
        {LOCATIONS.map((loc) => (
          <RadioRow
            key={loc.id}
            label={loc.label}
            checked={state.location === loc.id}
            onChange={() => onChange({ location: loc.id })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Company size">
        <RadioRow
          label="Any size"
          checked={!state.companySize}
          onChange={() => onChange({ companySize: null })}
        />
        {COMPANY_SIZES.map((size) => (
          <RadioRow
            key={size}
            label={size}
            checked={state.companySize === size}
            onChange={() => onChange({ companySize: size })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Signals">
        {SIGNAL_FILTERS.map((sig) => (
          <CheckboxRow
            key={sig.id}
            label={sig.label}
            checked={state.signals.includes(sig.id)}
            onChange={() => toggleSignal(sig.id)}
          />
        ))}
      </FilterSection>

      <FilterSection title="Sources">
        {SOURCE_FILTERS.map((src) => {
          const st = src.id === "Mock" ? null : sourceTone(src.id);
          return (
            <CheckboxRow
              key={src.id}
              label={src.label}
              checked={state.sources.includes(src.id)}
              onChange={() => toggleSource(src.id)}
              accent={st?.text}
            />
          );
        })}
      </FilterSection>

      {(state.industry ||
        state.organizationType ||
        state.location ||
        state.companySize ||
        state.signals.length ||
        state.sources.length) && (
        <button
          type="button"
          onClick={() =>
            onChange({
              industry: null,
              organizationType: null,
              location: null,
              companySize: null,
              signals: [],
              sources: [],
            })
          }
          className="mt-3 w-full rounded-lg border border-border py-2 font-mono text-[11px] text-muted transition hover:text-foreground"
        >
          Clear all filters
        </button>
      )}
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="mb-3 w-full rounded-lg border border-border bg-surface/60 py-2.5 font-mono text-xs text-foreground lg:hidden"
      >
        {mobileOpen ? "Hide filters" : "Show filters"}
      </button>

      <aside
        className={`w-full shrink-0 lg:block lg:w-56 xl:w-60 ${
          mobileOpen ? "block" : "hidden"
        }`}
      >
        <div className="sticky top-[4.5rem] max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-border/80 bg-surface/40 px-3 py-2">
          <p className="label-mono px-2 pt-2 text-accent-cyan/90">Filters</p>
          {rail}
        </div>
      </aside>
    </>
  );
}
