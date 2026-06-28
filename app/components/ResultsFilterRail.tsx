"use client";

import { useMemo, useState } from "react";
import type { Prospect } from "@/lib/search/types";
import type { SearchState } from "@/lib/search/searchState";
import {
  COMPANY_SIZES,
  FRESHNESS_FILTERS,
  LOCATIONS,
  OWNERSHIP_FILTERS,
  SECTORS,
  SIGNAL_FILTERS,
  SOURCE_FILTERS,
  US_STATE_FILTERS,
} from "@/lib/search/searchState";
import {
  CANONICAL_ORG_TYPES,
} from "@/lib/discovery/canonicalOrgType";
import { countProspectsForFilter } from "@/lib/search/resultsFilters";
import type { CatalogFacetCounts } from "@/lib/discovery/catalog/facetCounts";
import { formatStructuredSelectionDisplay } from "@/lib/search/prospectListBuilder";
import { industriesForSector } from "@/lib/taxonomy";
import { sourceTone } from "@/lib/intelligence/colors";

function FilterSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/10 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-2">
        <h3 className="label-mono text-white/75">{title}</h3>
        {action}
      </div>
      <div className="mt-2.5 space-y-1">{children}</div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; count?: number; dimmed?: boolean }[];
}) {
  return (
    <label className="block px-2 py-1">
      <span className="label-mono text-[0.625rem] text-white/50">{label}</span>
      <div className="relative mt-1.5">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 pr-8 font-mono text-xs text-white/90 outline-none transition focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/15"
        >
          {options.map((o) => (
            <option
              key={o.value}
              value={o.value}
              disabled={o.dimmed && o.count === 0 && o.value !== value}
            >
              {o.label}
              {o.count !== undefined ? ` (${o.count})` : ""}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </label>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
  accent,
  count,
  dimmed,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  accent?: string;
  count?: number;
  dimmed?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.06] ${dimmed ? "opacity-50" : ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-white/20 accent-cyan-300"
      />
      <span className={`flex-1 text-sm ${accent ?? "text-white/75"}`}>{label}</span>
      {count !== undefined ? (
        <span className="font-mono text-[0.625rem] tabular-nums text-white/45">
          {count}
        </span>
      ) : null}
    </label>
  );
}

function RadioRow({
  label,
  checked,
  onChange,
  count,
  dimmed,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  count?: number;
  dimmed?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.06] ${dimmed ? "opacity-50" : ""}`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 border-white/20 accent-cyan-300"
      />
      <span className="flex-1 text-sm text-white/75">{label}</span>
      {count !== undefined ? (
        <span className="font-mono text-[0.625rem] tabular-nums text-white/45">
          {count}
        </span>
      ) : null}
    </label>
  );
}

export function ResultsFilterRail({
  state,
  onChange,
  prospects = [],
  catalogFacets = null,
}: {
  state: SearchState;
  onChange: (partial: Partial<SearchState>) => void;
  prospects?: Prospect[];
  catalogFacets?: CatalogFacetCounts | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const structuredSelectionDisplay = formatStructuredSelectionDisplay(state);

  const industries = useMemo(
    () => industriesForSector(state.sector),
    [state.sector],
  );

  const orgTypes = CANONICAL_ORG_TYPES;

  function sumFacet(rec: Record<string, number>): number {
    return Object.values(rec).reduce((a, b) => a + b, 0);
  }

  /** Client-side counts for narrow-results filters only. */
  function refineCount(patch: Partial<SearchState>): number {
    return countProspectsForFilter(prospects, state, patch);
  }

  function sectorCount(sectorId: string | null): number {
    if (!catalogFacets) {
      return refineCount({ sector: sectorId, industry: null, organizationType: null });
    }
    if (!sectorId) return sumFacet(catalogFacets.sector);
    return catalogFacets.sector[sectorId] ?? 0;
  }

  function industryCount(industryId: string | null): number {
    if (!catalogFacets) {
      return refineCount({ industry: industryId, organizationType: null });
    }
    if (!industryId) return sumFacet(catalogFacets.industry);
    return catalogFacets.industry[industryId] ?? 0;
  }

  function orgTypeCount(orgId: string | null): number {
    if (!catalogFacets) {
      return refineCount({ organizationType: orgId });
    }
    if (!orgId) return sumFacet(catalogFacets.canonicalOrganizationType);
    return catalogFacets.canonicalOrganizationType[orgId] ?? 0;
  }

  function locationCount(locationId: string | null): number {
    if (!catalogFacets) return refineCount({ location: locationId });
    if (!locationId) return catalogFacets.scopeTotal;
    return catalogFacets.region[locationId] ?? refineCount({ location: locationId });
  }

  function stateCount(stateId: string | null): number {
    if (!catalogFacets) return refineCount({ state: stateId });
    // States are multi-valued per org, so summing per-state counts would
    // over-count. The in-scope org total is the correct "All states" figure.
    if (!stateId) return catalogFacets.scopeTotal;
    return catalogFacets.state[stateId] ?? 0;
  }

  function visible(countValue: number, selected: boolean): boolean {
    return showAllFilters || selected || countValue > 0;
  }

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

  const showAllToggle = (
    <button
      type="button"
      onClick={() => setShowAllFilters((v) => !v)}
      className="font-mono text-[0.625rem] text-white/50 transition hover:text-white/85"
    >
      {showAllFilters ? "Hide empty" : "Show all"}
    </button>
  );

  const rail = (
    <>
      <div className="border-b border-white/10 py-4">
        <p className="label-mono px-2 text-white/75">Search criteria</p>
        <p className="mt-1 px-2 text-[0.6875rem] leading-relaxed text-white/55">
          Updates the organization search · counts from full catalog
        </p>
        <div className="mt-3 space-y-1">
          <FilterSelect
            label="Sector"
            value={state.sector ?? ""}
            onChange={(value) =>
              onChange({
                sector: value || null,
                industry: null,
                organizationType: null,
              })
            }
            options={[
              {
                value: "",
                label: "All sectors",
                count: catalogFacets ? sumFacet(catalogFacets.sector) : prospects.length,
              },
              ...SECTORS.filter((sector) =>
                visible(sectorCount(sector.id), state.sector === sector.id),
              ).map((sector) => ({
                value: sector.id,
                label: sector.label,
                count: sectorCount(sector.id),
                dimmed: sectorCount(sector.id) === 0,
              })),
            ]}
          />

          <FilterSelect
            label="Industry"
            value={state.industry ?? ""}
            onChange={(value) =>
              onChange({ industry: value || null, organizationType: null })
            }
            options={[
              {
                value: "",
                label: "All industries",
                count: catalogFacets ? sumFacet(catalogFacets.industry) : prospects.length,
              },
              ...industries
                .filter((ind) =>
                  visible(industryCount(ind.id), state.industry === ind.id),
                )
                .map((ind) => ({
                  value: ind.id,
                  label: ind.label,
                  count: industryCount(ind.id),
                  dimmed: industryCount(ind.id) === 0,
                })),
            ]}
          />

          <FilterSelect
            label="Organization type"
            value={state.organizationType ?? ""}
            onChange={(value) => onChange({ organizationType: value || null })}
            options={[
              {
                value: "",
                label: "All types",
                count: catalogFacets
                  ? sumFacet(catalogFacets.canonicalOrganizationType)
                  : prospects.length,
              },
              ...orgTypes
                .filter((org) =>
                  visible(orgTypeCount(org.id), state.organizationType === org.id),
                )
                .map((org) => ({
                  value: org.id,
                  label: org.label,
                  count: orgTypeCount(org.id),
                  dimmed: orgTypeCount(org.id) === 0,
                })),
            ]}
          />

          <FilterSelect
            label="Region"
            value={state.location ?? ""}
            onChange={(value) => onChange({ location: value || null })}
            options={[
              {
                value: "",
                label: "All regions",
                count: catalogFacets?.scopeTotal ?? prospects.length,
              },
              ...LOCATIONS.filter((loc) =>
                visible(locationCount(loc.id), state.location === loc.id),
              ).map((loc) => ({
                value: loc.id,
                label: loc.label,
                count: locationCount(loc.id),
                dimmed: locationCount(loc.id) === 0,
              })),
            ]}
          />

          <FilterSelect
            label="State"
            value={state.state ?? ""}
            onChange={(value) => onChange({ state: value || null })}
            options={[
              {
                value: "",
                label: "All states",
                count: catalogFacets ? stateCount(null) : prospects.length,
              },
              ...US_STATE_FILTERS.filter((st) =>
                visible(stateCount(st.id), state.state === st.id),
              ).map((st) => ({
                value: st.id,
                label: st.label,
                count: stateCount(st.id),
                dimmed: stateCount(st.id) === 0,
              })),
            ]}
          />
        </div>
      </div>

      <div className="border-b border-white/10 py-4">
        <div className="flex items-center justify-between gap-2 px-2">
          <div>
            <p className="label-mono text-white/75">Narrow results</p>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-white/55">
              Instant filter on the list below
            </p>
          </div>
          {showAllToggle}
        </div>

      <FilterSection title="Signal type">
        {SIGNAL_FILTERS.filter((sig) =>
          visible(
            refineCount({ signals: [...state.signals, sig.id] }),
            state.signals.includes(sig.id),
          ),
        ).map((sig) => (
          <CheckboxRow
            key={sig.id}
            label={sig.label}
            checked={state.signals.includes(sig.id)}
            onChange={() => toggleSignal(sig.id)}
            count={refineCount({ signals: [sig.id] })}
            dimmed={refineCount({ signals: [sig.id] }) === 0}
          />
        ))}
      </FilterSection>

      <FilterSection title="Source">
        {SOURCE_FILTERS.filter((src) =>
          visible(
            refineCount({ sources: [src.id] }),
            state.sources.includes(src.id),
          ),
        ).map((src) => {
          const st = src.id === "Mock" ? null : sourceTone(src.id);
          return (
            <CheckboxRow
              key={src.id}
              label={src.label}
              checked={state.sources.includes(src.id)}
              onChange={() => toggleSource(src.id)}
              accent={st?.text}
              count={refineCount({ sources: [src.id] })}
              dimmed={refineCount({ sources: [src.id] }) === 0}
            />
          );
        })}
      </FilterSection>

      <FilterSection title="Ownership">
        <RadioRow
          label="Any ownership"
          checked={!state.ownership}
          onChange={() => onChange({ ownership: null })}
          count={prospects.length}
        />
        {OWNERSHIP_FILTERS.map((own) => (
          <RadioRow
            key={own.id}
            label={own.label}
            checked={state.ownership === own.id}
            onChange={() => onChange({ ownership: own.id })}
            count={refineCount({ ownership: own.id })}
            dimmed={refineCount({ ownership: own.id }) === 0}
          />
        ))}
      </FilterSection>

      <FilterSection title="Freshness">
        {FRESHNESS_FILTERS.map((f) => (
          <RadioRow
            key={f.id}
            label={f.label}
            checked={(state.freshness ?? "any") === f.id}
            onChange={() => onChange({ freshness: f.id === "any" ? null : f.id })}
            count={
              f.id === "any" ? prospects.length : refineCount({ freshness: f.id })
            }
          />
        ))}
      </FilterSection>

      <FilterSection title="Size">
        <RadioRow
          label="Any size"
          checked={!state.companySize}
          onChange={() => onChange({ companySize: null })}
          count={prospects.length}
        />
        {COMPANY_SIZES.map((size) => (
          <RadioRow
            key={size}
            label={size}
            checked={state.companySize === size}
            onChange={() => onChange({ companySize: size })}
            count={refineCount({ companySize: size })}
            dimmed={refineCount({ companySize: size }) === 0}
          />
        ))}
      </FilterSection>
      </div>

      <div className="border-b border-white/10 py-4">
        <button
          type="button"
          onClick={() => setShowPersonalization((v) => !v)}
          className="label-mono w-full px-2 text-left text-white/55 transition hover:text-white/85"
        >
          {showPersonalization ? "−" : "+"} Outreach personalization (optional)
        </button>
        {showPersonalization ? (
          <div className="mt-3 px-2">
            <p className="text-xs leading-relaxed text-white/55">
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
              className="mt-2 w-full rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/35 focus:border-cyan-300/45"
            />
          </div>
        ) : null}
      </div>

      {(state.sector ||
        state.industry ||
        state.organizationType ||
        state.location ||
        state.state ||
        state.ownership ||
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
              state: null,
              ownership: null,
              companySize: null,
              freshness: null,
              signals: [],
              sources: [],
            })
          }
          className="mt-3 w-full rounded-lg border border-white/12 py-2 font-mono text-[0.6875rem] text-white/60 transition hover:border-white/20 hover:text-white/85"
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
    (state.state ? 1 : 0) +
    (state.ownership ? 1 : 0) +
    (state.freshness ? 1 : 0) +
    (state.companySize ? 1 : 0) +
    state.signals.length +
    state.sources.length;

  return (
    <div className="w-full shrink-0 lg:w-56 xl:w-60">
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="mb-3 w-full rounded-lg border py-2.5 font-mono text-xs filters-panel-toggle lg:hidden"
      >
        {mobileOpen ? "Hide filters" : "Show filters"}
        {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
      </button>

      <aside className={`${mobileOpen ? "block" : "hidden"} lg:block`}>
        <div className="filters-panel max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl border px-3 py-2 backdrop-blur-xl lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-6rem)]">
          <p className="label-mono px-2 pt-2 text-accent-cyan/90">Filters</p>
          <p className="mt-1 px-2 text-[0.6875rem] leading-relaxed text-white/55">
            Selectors re-run search · catalog counts in selectors
          </p>
          {catalogFacets ? (
            <p className="mt-1 px-2 font-mono text-[0.625rem] text-white/50">
              {catalogFacets.catalogTotal.toLocaleString()} indexed ·{" "}
              {catalogFacets.scopeTotal.toLocaleString()} in scope
            </p>
          ) : null}
          {(state.sector || state.industry || state.organizationType) && (
            <p className="mt-1 px-2 text-[0.6875rem] leading-relaxed text-white/55">
              {structuredSelectionDisplay.primaryLabel}
              {structuredSelectionDisplay.secondaryLabel
                ? ` · ${structuredSelectionDisplay.secondaryLabel}`
                : ""}
            </p>
          )}
          {rail}
        </div>
      </aside>
    </div>
  );
}
