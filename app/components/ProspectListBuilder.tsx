"use client";

import { useMemo, useState } from "react";
import {
  BUILDER_OWNERSHIP_OPTIONS,
  BUILDER_SIGNAL_OPTIONS,
  BUILDER_SIZE_OPTIONS,
  BUILDER_SORT_OPTIONS,
  BUILDER_SOURCE_OPTIONS,
  buildSearchQueryFromBuilder,
  type ProspectListBuilderState,
  EMPTY_BUILDER_STATE,
} from "@/lib/search/prospectListBuilder";
import { LOCATIONS, US_STATE_FILTERS } from "@/lib/search/searchState";
import {
  TAXONOMY_INDUSTRIES,
  organizationTypesForFilters,
} from "@/lib/taxonomy";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-lg border border-border/70 bg-surface/40 p-3.5 sm:p-4">
      <legend className="label-mono px-1 text-foreground/85">{title}</legend>
      <div className="mt-2 space-y-3">{children}</div>
    </fieldset>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium text-muted">{children}</span>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Any",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border/80 bg-surface-2/80 px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-border-strong"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChipToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={`rounded-md border px-2.5 py-1.5 text-left text-xs transition-[background-color,border-color] duration-200 ${
        checked
          ? "border-accent-cyan/45 bg-accent-soft/25 text-foreground"
          : "border-border/70 bg-surface-2/60 text-muted hover:border-border-strong hover:bg-surface/80"
      }`}
    >
      {label}
    </button>
  );
}

export function ProspectListBuilder({
  open,
  onSubmit,
}: {
  open: boolean;
  onSubmit: (state: ProspectListBuilderState) => void;
}) {
  const [builder, setBuilder] = useState<ProspectListBuilderState>(
    EMPTY_BUILDER_STATE,
  );

  const orgTypes = useMemo(
    () =>
      organizationTypesForFilters(builder.sector, builder.industry).slice(0, 40),
    [builder.sector, builder.industry],
  );

  const generatedQuery = useMemo(
    () => buildSearchQueryFromBuilder(builder),
    [builder],
  );

  function patch(partial: Partial<ProspectListBuilderState>) {
    setBuilder((prev) => ({ ...prev, ...partial }));
  }

  function toggleBuilderSignal(id: string) {
    setBuilder((prev) => ({
      ...prev,
      builderSignals: prev.builderSignals.includes(id)
        ? prev.builderSignals.filter((s) => s !== id)
        : [...prev.builderSignals, id],
    }));
  }

  function toggleBuilderSource(id: string) {
    setBuilder((prev) => ({
      ...prev,
      builderSources: prev.builderSources.includes(id)
        ? prev.builderSources.filter((s) => s !== id)
        : [...prev.builderSources, id],
    }));
  }

  function toggleOperatingState(code: string) {
    setBuilder((prev) => ({
      ...prev,
      operatingStates: prev.operatingStates.includes(code)
        ? prev.operatingStates.filter((s) => s !== code)
        : [...prev.operatingStates, code],
    }));
  }

  if (!open) return null;

  return (
    <div className="mt-6 w-full text-left">
      <div className="rounded-xl border border-border/70 bg-surface/45 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.14)] sm:p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Build Prospect List
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Structured filters for organizations, locations, signals, and
              public data sources.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Section title="Organization">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Industry"
                value={builder.industry ?? ""}
                onChange={(v) => {
                  const ind = TAXONOMY_INDUSTRIES.find((i) => i.id === v);
                  patch({
                    industry: v || null,
                    organizationType: null,
                    sector: ind?.sectorId ?? null,
                  });
                }}
                options={TAXONOMY_INDUSTRIES.map((i) => ({
                  id: i.id,
                  label: i.label,
                }))}
              />
              <SelectField
                label="Organization type"
                value={builder.organizationType ?? ""}
                onChange={(v) => patch({ organizationType: v || null })}
                options={orgTypes.map((o) => ({ id: o.id, label: o.label }))}
              />
            </div>
            <div>
              <FieldLabel>Ownership</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {BUILDER_OWNERSHIP_OPTIONS.map((o) => (
                  <ChipToggle
                    key={o.id}
                    label={o.label}
                    checked={builder.ownership === o.id}
                    onChange={() =>
                      patch({
                        ownership: builder.ownership === o.id ? null : o.id,
                      })
                    }
                  />
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Size</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {BUILDER_SIZE_OPTIONS.map((s) => (
                  <ChipToggle
                    key={s.id}
                    label={s.label}
                    checked={builder.companySize === s.id}
                    onChange={() =>
                      patch({
                        companySize:
                          builder.companySize === s.id ? null : s.id,
                      })
                    }
                  />
                ))}
              </div>
            </div>
            <p className="text-[0.6875rem] leading-relaxed text-muted-2">
              Revenue range filtering is coming soon.
            </p>
          </Section>

          <Section title="Location">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Headquarters state"
                value={builder.state ?? ""}
                onChange={(v) => patch({ state: v || null })}
                options={[...US_STATE_FILTERS]}
              />
              <SelectField
                label="Region"
                value={builder.location ?? ""}
                onChange={(v) => patch({ location: v || null })}
                options={LOCATIONS.map((l) => ({ id: l.id, label: l.label }))}
              />
            </div>
            <label className="block">
              <FieldLabel>City / metro</FieldLabel>
              <input
                type="text"
                value={builder.metro ?? ""}
                onChange={(e) => patch({ metro: e.target.value || null })}
                placeholder="e.g. Austin, Dallas–Fort Worth"
                className="w-full rounded-md border border-border/80 bg-surface-2/80 px-3 py-2.5 text-sm outline-none transition-colors duration-200 focus:border-border-strong"
              />
            </label>
            <div>
              <FieldLabel>Operating states</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {US_STATE_FILTERS.map((st) => (
                  <ChipToggle
                    key={st.id}
                    label={st.id}
                    checked={builder.operatingStates.includes(st.id)}
                    onChange={() => toggleOperatingState(st.id)}
                  />
                ))}
              </div>
            </div>
          </Section>

          <Section title="Signals">
            <div className="flex flex-wrap gap-1.5">
              {BUILDER_SIGNAL_OPTIONS.map((sig) => (
                <ChipToggle
                  key={sig.id}
                  label={sig.label}
                  checked={builder.builderSignals.includes(sig.id)}
                  onChange={() => toggleBuilderSignal(sig.id)}
                />
              ))}
            </div>
          </Section>

          <Section title="Source types">
            <div className="flex flex-wrap gap-1.5">
              {BUILDER_SOURCE_OPTIONS.map((src) => (
                <ChipToggle
                  key={src.id}
                  label={src.label}
                  checked={builder.builderSources.includes(src.id)}
                  onChange={() => toggleBuilderSource(src.id)}
                />
              ))}
            </div>
          </Section>

          <Section title="Sort">
            <div className="flex flex-wrap gap-1.5">
              {BUILDER_SORT_OPTIONS.map((opt) => (
                <ChipToggle
                  key={opt.id}
                  label={opt.label}
                  checked={(builder.sort ?? "score") === opt.id}
                  onChange={() => patch({ sort: opt.id })}
                />
              ))}
            </div>
          </Section>

          <label className="block rounded-lg border border-border/60 bg-surface-2/50 p-3">
            <FieldLabel>Generated search query</FieldLabel>
            <input
              type="text"
              value={builder.query || generatedQuery}
              onChange={(e) => patch({ query: e.target.value })}
              className="mt-1 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-2"
              placeholder={generatedQuery}
            />
            <p className="mt-1.5 text-[0.6875rem] text-muted-2">
              Edit the query directly or adjust filters above.
            </p>
          </label>

          <button
            type="button"
            onClick={() =>
              onSubmit({
                ...builder,
                query: builder.query.trim() || generatedQuery,
              })
            }
            className="w-full rounded-lg border border-border-strong bg-surface/80 px-4 py-3 text-sm font-semibold text-foreground transition-[background-color,border-color] duration-200 hover:border-border-strong hover:bg-surface active:bg-surface/90 sm:w-auto sm:px-6"
          >
            Search prospects
          </button>
        </div>
      </div>
    </div>
  );
}
