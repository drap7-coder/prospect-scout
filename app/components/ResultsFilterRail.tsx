"use client";

import { useMemo, useState } from "react";
import type { SearchState } from "@/lib/search/searchState";
import {
  COMPANY_SIZES,
  FRESHNESS_FILTERS,
  LOCATIONS,
  SECTORS,
  SIGNAL_FILTERS,
  SOURCE_FILTERS,
} from "@/lib/search/searchState";
import {
  industriesForSector,
  industryLabel,
  organizationTypesForFilters,
  sectorLabel,
} from "@/lib/taxonomy";
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
  const [showPersonalization, setShowPersonalization] = useState(false);

  const industries = useMemo(
    () => industriesForSector(state.sector),
    [state.sector],
  );

  const orgTypes = useMemo(
    () => organizationTypesForFilters(state.sector, state.industry),
    [state.sector, state.industry],
  );

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
      <FilterSection title="Sector">
        <RadioRow
          label="All sectors"
          checked={!state.sector}
          onChange={() =>
            onChange({ sector: null, industry: null, organizationType: null })
          }
        />
        {SECTORS.map((sector) => (
          <RadioRow
            key={sector.id}
            label={sector.label}
            checked={state.sector === sector.id}
            onChange={() =>
              onChange({
                sector: sector.id,
                industry: null,
                organizationType: null,
              })
            }
          />
        ))}
      </FilterSection>

      <FilterSection title="Industry">
        <RadioRow
          label="All industries"
          checked={!state.industry}
          onChange={() => onChange({ industry: null, organizationType: null })}
        />
        {industries.map((ind) => (
          <RadioRow
            key={ind.id}
            label={ind.label}
            checked={state.industry === ind.id}
            onChange={() =>
              onChange({ industry: ind.id, organizationType: null })
            }
          />
        ))}
      </FilterSection>

      <FilterSection title="Organization type">
        <RadioRow
          label="All types"
          checked={!state.organizationType}
          onChange={() => onChange({ organizationType: null })}
        />
        {orgTypes.map((org) => (
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

      <FilterSection title="Signal type">
        {SIGNAL_FILTERS.map((sig) => (
          <CheckboxRow
            key={sig.id}
            label={sig.label}
            checked={state.signals.includes(sig.id)}
            onChange={() => toggleSignal(sig.id)}
          />
        ))}
      </FilterSection>

      <FilterSection title="Source">
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

      <FilterSection title="Freshness">
        {FRESHNESS_FILTERS.map((f) => (
          <RadioRow
            key={f.id}
            label={f.label}
            checked={(state.freshness ?? "any") === f.id}
            onChange={() => onChange({ freshness: f.id === "any" ? null : f.id })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Size">
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

      <div className="border-b border-border/60 py-4">
        <button
          type="button"
          onClick={() => setShowPersonalization((v) => !v)}
          className="label-mono w-full px-2 text-left text-muted-2 transition hover:text-foreground"
        >
          {showPersonalization ? "−" : "+"} Outreach personalization (optional)
        </button>
        {showPersonalization ? (
          <div className="mt-3 px-2">
            <p className="text-xs leading-relaxed text-muted-2">
              Optional context for outreach angles — does not affect which
              organizations appear.
            </p>
            <input
              type="text"
              value={state.sellerContext ?? ""}
              onChange={(e) =>
                onChange({ sellerContext: e.target.value || null })
              }
              placeholder="e.g. consulting, automation, analytics"
              className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        ) : null}
      </div>

      {(state.sector ||
        state.industry ||
        state.organizationType ||
        state.location ||
        state.companySize ||
        state.freshness ||
        state.signals.length ||
        state.sources.length) && (
        <button
          type="button"
          onClick={() =>
            onChange({
              sector: null,
              industry: null,
              organizationType: null,
              location: null,
              companySize: null,
              freshness: null,
              signals: [],
              sources: [],
            })
          }
          className="mt-3 w-full rounded-lg border border-border py-2 font-mono text-[0.6875rem] text-muted transition hover:text-foreground"
        >
          Clear all filters
        </button>
      )}
    </>
  );

  const activeFilterCount =
    (state.sector ? 1 : 0) +
    (state.industry ? 1 : 0) +
    (state.organizationType ? 1 : 0) +
    (state.location ? 1 : 0) +
    (state.freshness ? 1 : 0) +
    (state.companySize ? 1 : 0) +
    state.signals.length +
    state.sources.length;

  return (
    <div className="w-full shrink-0 lg:w-56 xl:w-60">
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="mb-3 w-full rounded-lg border border-border bg-surface/60 py-2.5 font-mono text-xs text-foreground lg:hidden"
      >
        {mobileOpen ? "Hide filters" : "Show filters"}
        {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
      </button>

      <aside className={`${mobileOpen ? "block" : "hidden"} lg:block`}>
        <div className="max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl border border-border/80 bg-surface/40 px-3 py-2 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-6rem)]">
          <p className="label-mono px-2 pt-2 text-accent-cyan/90">Filters</p>
          {(state.sector || state.industry || state.organizationType) && (
            <p className="mt-1 px-2 text-[0.6875rem] leading-relaxed text-muted-2">
              {[
                state.sector ? sectorLabel(state.sector) : null,
                state.industry ? industryLabel(state.industry) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {rail}
        </div>
      </aside>
    </div>
  );
}
