"use client";

import { useMemo, useState } from "react";
import {
  BUILDER_FEATURED_SECTOR_IDS,
  BUILDER_OWNERSHIP_OPTIONS,
  BUILDER_SECTOR_HINTS,
  BUILDER_SIGNAL_OPTIONS,
  BUILDER_SIZE_OPTIONS,
  BUILDER_SORT_OPTIONS,
  BUILDER_SOURCE_OPTIONS,
  buildSearchQueryFromBuilder,
  hasBuilderFilters,
  type ProspectListBuilderState,
  EMPTY_BUILDER_STATE,
} from "@/lib/search/prospectListBuilder";
import { LOCATIONS, US_STATE_FILTERS } from "@/lib/search/searchState";
import {
  industryLabel,
  organizationTypeLabel,
  sectorLabel,
  TAXONOMY_INDUSTRIES,
  TAXONOMY_SECTORS,
  organizationTypesForFilters,
} from "@/lib/taxonomy";

function QuestionBlock({
  step,
  question,
  hint,
  children,
}: {
  step?: string;
  question: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 sm:gap-5">
      <div className="grid gap-1.5 text-left">
        {step ? (
          <p className="label-mono text-accent-cyan/80">{step}</p>
        ) : null}
        <h3 className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.02em] text-foreground sm:text-lg">
          {question}
        </h3>
        {hint ? (
          <p className="max-w-xl text-sm leading-relaxed text-muted">{hint}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function PickCard({
  title,
  subtitle,
  selected,
  onClick,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group flex w-full min-w-0 items-center gap-3 rounded-2xl border-2 px-3.5 py-3.5 text-left transition-[border-color,background-color,box-shadow] duration-200 sm:px-4 sm:py-4 ${
        compact ? "min-h-[3.75rem]" : "min-h-[4.5rem] sm:min-h-[5rem]"
      } ${
        selected
          ? "border-accent-cyan/50 bg-accent-soft/20 shadow-[0_0_0_4px_rgba(56,224,216,0.08),0_8px_24px_rgba(0,0,0,0.18)]"
          : "border-border/80 bg-surface/50 hover:border-border-strong hover:bg-surface/70"
      }`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold uppercase tracking-wide transition-colors duration-200 sm:h-10 sm:w-10 ${
          selected
            ? "bg-accent-cyan/20 text-accent-cyan"
            : "bg-surface-2 text-muted group-hover:text-foreground"
        }`}
        aria-hidden
      >
        {title.slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug text-foreground sm:text-[0.9375rem]">
          {title}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            {subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function PickChip({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border-2 px-3.5 py-3 text-left transition-[border-color,background-color] duration-200 sm:min-w-[8.5rem] ${
        selected
          ? "border-accent-cyan/45 bg-accent-soft/20"
          : "border-border/70 bg-surface-2/50 hover:border-border-strong hover:bg-surface/70"
      }`}
    >
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-muted">
          {hint}
        </span>
      ) : null}
    </button>
  );
}

function SelectionPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/70 px-3 py-1.5 text-xs font-medium text-foreground">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        ×
      </button>
    </span>
  );
}

function buildSelectionPills(builder: ProspectListBuilderState) {
  const pills: { id: string; label: string; clear: () => Partial<ProspectListBuilderState> }[] =
    [];

  if (builder.industry) {
    pills.push({
      id: "industry",
      label: industryLabel(builder.industry),
      clear: () => ({ industry: null, organizationType: null, sector: null }),
    });
  } else if (builder.sector) {
    pills.push({
      id: "sector",
      label: sectorLabel(builder.sector),
      clear: () => ({ sector: null, industry: null, organizationType: null }),
    });
  }

  if (builder.organizationType) {
    pills.push({
      id: "org",
      label: organizationTypeLabel(builder.organizationType),
      clear: () => ({ organizationType: null }),
    });
  }

  if (builder.ownership) {
    const opt = BUILDER_OWNERSHIP_OPTIONS.find((o) => o.id === builder.ownership);
    pills.push({
      id: "ownership",
      label: opt?.label ?? builder.ownership,
      clear: () => ({ ownership: null }),
    });
  }

  if (builder.companySize) {
    pills.push({
      id: "size",
      label: builder.companySize,
      clear: () => ({ companySize: null }),
    });
  }

  if (builder.location && builder.location !== "nationwide") {
    const loc = LOCATIONS.find((l) => l.id === builder.location);
    pills.push({
      id: "location",
      label: loc?.label ?? builder.location,
      clear: () => ({ location: null }),
    });
  }

  if (builder.state) {
    const st = US_STATE_FILTERS.find((s) => s.id === builder.state);
    pills.push({
      id: "state",
      label: st?.label ?? builder.state,
      clear: () => ({ state: null }),
    });
  }

  if (builder.metro?.trim()) {
    pills.push({
      id: "metro",
      label: builder.metro.trim(),
      clear: () => ({ metro: null }),
    });
  }

  for (const code of builder.operatingStates) {
    pills.push({
      id: `op-${code}`,
      label: `Operates in ${code}`,
      clear: () => ({
        operatingStates: builder.operatingStates.filter((s) => s !== code),
      }),
    });
  }

  for (const sigId of builder.builderSignals) {
    const sig = BUILDER_SIGNAL_OPTIONS.find((s) => s.id === sigId);
    if (sig) {
      pills.push({
        id: `sig-${sigId}`,
        label: sig.label,
        clear: () => ({
          builderSignals: builder.builderSignals.filter((s) => s !== sigId),
        }),
      });
    }
  }

  for (const srcId of builder.builderSources) {
    const src = BUILDER_SOURCE_OPTIONS.find((s) => s.id === srcId);
    if (src) {
      pills.push({
        id: `src-${srcId}`,
        label: src.label,
        clear: () => ({
          builderSources: builder.builderSources.filter((s) => s !== srcId),
        }),
      });
    }
  }

  if (builder.sort && builder.sort !== "score") {
    const sort = BUILDER_SORT_OPTIONS.find((s) => s.id === builder.sort);
    pills.push({
      id: "sort",
      label: sort?.label ?? builder.sort,
      clear: () => ({ sort: "score" }),
    });
  }

  return pills;
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
  const [showAllSectors, setShowAllSectors] = useState(false);
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const [showLocationDetails, setShowLocationDetails] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editQuery, setEditQuery] = useState(false);

  const orgTypes = useMemo(
    () =>
      organizationTypesForFilters(builder.sector, builder.industry).slice(0, 48),
    [builder.sector, builder.industry],
  );

  const generatedQuery = useMemo(
    () => buildSearchQueryFromBuilder(builder),
    [builder],
  );

  const selectionPills = useMemo(() => buildSelectionPills(builder), [builder]);

  const featuredSectors = useMemo(
    () =>
      TAXONOMY_SECTORS.filter((s) =>
        (BUILDER_FEATURED_SECTOR_IDS as readonly string[]).includes(s.id),
      ),
    [],
  );

  const otherSectors = useMemo(
    () =>
      TAXONOMY_SECTORS.filter(
        (s) => !(BUILDER_FEATURED_SECTOR_IDS as readonly string[]).includes(s.id),
      ),
    [],
  );

  const industriesForSector = useMemo(() => {
    if (!builder.sector) return [];
    return TAXONOMY_INDUSTRIES.filter((i) => i.sectorId === builder.sector);
  }, [builder.sector]);

  const visibleIndustries = showAllIndustries
    ? industriesForSector
    : industriesForSector.slice(0, 6);

  function patch(partial: Partial<ProspectListBuilderState>) {
    setBuilder((prev) => ({ ...prev, ...partial }));
  }

  function pickSector(sectorId: string) {
    const selected = builder.sector === sectorId && !builder.industry;
    patch({
      sector: selected ? null : sectorId,
      industry: null,
      organizationType: null,
    });
    setShowAllIndustries(false);
  }

  function pickIndustry(industryId: string) {
    const ind = TAXONOMY_INDUSTRIES.find((i) => i.id === industryId);
    patch({
      industry: builder.industry === industryId ? null : industryId,
      sector: ind?.sectorId ?? builder.sector,
      organizationType: null,
    });
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

  function handleSubmit() {
    onSubmit({
      ...builder,
      query: builder.query.trim() || generatedQuery,
    });
  }

  function clearAll() {
    setBuilder(EMPTY_BUILDER_STATE);
    setShowAllSectors(false);
    setShowAllIndustries(false);
    setShowLocationDetails(false);
    setShowAdvanced(false);
    setEditQuery(false);
  }

  if (!open) return null;

  const effectiveQuery = builder.query.trim() || generatedQuery;

  return (
    <div className="mt-8 w-full text-left">
      <div className="rounded-2xl border border-border/70 bg-surface/40 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.14)] sm:p-7">
        <header className="mb-8 grid gap-2 text-center sm:mb-10">
          <p className="label-mono text-accent-cyan/75">Guided builder</p>
          <h2 className="font-display text-balance text-[1.375rem] font-normal leading-tight tracking-[-0.03em] text-foreground sm:text-[1.625rem]">
            Let&apos;s build your prospect list
          </h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
            Answer a few quick questions. You can skip anything — we&apos;ll
            search with whatever you pick.
          </p>
        </header>

        <div className="grid gap-10 sm:gap-12">
          <QuestionBlock
            step="Step 1"
            question="What kind of organizations?"
            hint="Pick a broad category, then narrow to a specific industry if you want."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {featuredSectors.map((sector) => (
                <PickCard
                  key={sector.id}
                  title={sector.label}
                  subtitle={BUILDER_SECTOR_HINTS[sector.id]}
                  selected={
                    builder.sector === sector.id && !builder.industry
                  }
                  onClick={() => pickSector(sector.id)}
                />
              ))}
            </div>

            {showAllSectors ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {otherSectors.map((sector) => (
                  <PickCard
                    key={sector.id}
                    title={sector.label}
                    subtitle={BUILDER_SECTOR_HINTS[sector.id]}
                    selected={
                      builder.sector === sector.id && !builder.industry
                    }
                    onClick={() => pickSector(sector.id)}
                    compact
                  />
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAllSectors(true)}
                className="text-sm font-semibold text-accent-cyan transition hover:text-accent-cyan/80"
              >
                Browse all categories
              </button>
            )}

            {builder.sector && industriesForSector.length > 0 ? (
              <div className="grid gap-3 rounded-2xl border border-border/60 bg-surface-2/30 p-4 sm:p-5">
                <p className="text-sm font-semibold text-foreground">
                  Narrow to a specific industry{" "}
                  <span className="font-normal text-muted">(optional)</span>
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {visibleIndustries.map((ind) => (
                    <PickCard
                      key={ind.id}
                      title={ind.label}
                      selected={builder.industry === ind.id}
                      onClick={() => pickIndustry(ind.id)}
                      compact
                    />
                  ))}
                </div>
                {industriesForSector.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllIndustries((v) => !v)}
                    className="text-sm font-semibold text-muted transition hover:text-foreground"
                  >
                    {showAllIndustries
                      ? "Show fewer industries"
                      : `Show all ${industriesForSector.length} industries`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </QuestionBlock>

          <QuestionBlock
            step="Step 2"
            question="Who are you looking for?"
            hint="Optional — leave blank to include every ownership type and size."
          >
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                {BUILDER_OWNERSHIP_OPTIONS.map((o) => (
                  <PickChip
                    key={o.id}
                    label={o.label}
                    hint={o.hint}
                    selected={builder.ownership === o.id}
                    onClick={() =>
                      patch({
                        ownership: builder.ownership === o.id ? null : o.id,
                      })
                    }
                  />
                ))}
              </div>
              <div>
                <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-2">
                  Company size
                </p>
                <div className="flex flex-wrap gap-2">
                  {BUILDER_SIZE_OPTIONS.map((s) => (
                    <PickChip
                      key={s.id}
                      label={s.label}
                      hint={s.hint}
                      selected={builder.companySize === s.id}
                      onClick={() =>
                        patch({
                          companySize:
                            builder.companySize === s.id ? null : s.id,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </QuestionBlock>

          <QuestionBlock
            step="Step 3"
            question="Where should they be based?"
            hint="Start broad — add city or state details only if you need them."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <PickCard
                title="Anywhere"
                subtitle="No location filter"
                selected={!builder.location && !builder.state && !builder.metro}
                onClick={() =>
                  patch({ location: null, state: null, metro: null })
                }
                compact
              />
              {LOCATIONS.filter((l) => l.id !== "nationwide").map((loc) => (
                <PickCard
                  key={loc.id}
                  title={loc.label}
                  selected={builder.location === loc.id}
                  onClick={() =>
                    patch({
                      location: builder.location === loc.id ? null : loc.id,
                    })
                  }
                  compact
                />
              ))}
            </div>

            {!showLocationDetails ? (
              <button
                type="button"
                onClick={() => setShowLocationDetails(true)}
                className="text-sm font-semibold text-muted transition hover:text-foreground"
              >
                Add a city, state, or operating area
              </button>
            ) : (
              <div className="grid gap-4 rounded-2xl border border-border/60 bg-surface-2/30 p-4 sm:p-5">
                <p className="text-sm font-semibold text-foreground">
                  Location details
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-muted">
                      Headquarters state
                    </span>
                    <select
                      value={builder.state ?? ""}
                      onChange={(e) =>
                        patch({ state: e.target.value || null })
                      }
                      className="w-full rounded-xl border border-border/80 bg-surface/80 px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-border-strong"
                    >
                      <option value="">Any state</option>
                      {US_STATE_FILTERS.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-muted">
                      City or metro area
                    </span>
                    <input
                      type="text"
                      value={builder.metro ?? ""}
                      onChange={(e) =>
                        patch({ metro: e.target.value || null })
                      }
                      placeholder="e.g. Columbus, Austin, Dallas–Fort Worth"
                      className="w-full rounded-xl border border-border/80 bg-surface/80 px-3.5 py-3 text-sm outline-none transition-colors focus:border-border-strong"
                    />
                  </label>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted">
                    Also operating in these states
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {US_STATE_FILTERS.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        aria-pressed={builder.operatingStates.includes(st.id)}
                        onClick={() => toggleOperatingState(st.id)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                          builder.operatingStates.includes(st.id)
                            ? "border-accent-cyan/45 bg-accent-soft/20 text-foreground"
                            : "border-border/70 text-muted hover:border-border-strong"
                        }`}
                      >
                        {st.id}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </QuestionBlock>

          <QuestionBlock
            step="Step 4"
            question="What should they be doing right now?"
            hint="Pick any signals you care about — we'll prioritize organizations showing that activity."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BUILDER_SIGNAL_OPTIONS.map((sig) => (
                <PickChip
                  key={sig.id}
                  label={sig.label}
                  hint={sig.hint}
                  selected={builder.builderSignals.includes(sig.id)}
                  onClick={() => toggleBuilderSignal(sig.id)}
                />
              ))}
            </div>
          </QuestionBlock>

          {!showAdvanced ? (
            <button
              type="button"
              onClick={() => setShowAdvanced(true)}
              className="justify-self-start text-sm font-semibold text-muted transition hover:text-foreground"
            >
              Fine-tune data sources, sort order, and organization type →
            </button>
          ) : (
            <div className="grid gap-8 rounded-2xl border border-border/60 bg-surface-2/20 p-5 sm:p-6">
              <QuestionBlock
                question="Which public data sources?"
                hint="Optional — we'll search broadly unless you limit sources."
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BUILDER_SOURCE_OPTIONS.map((src) => (
                    <PickChip
                      key={src.id}
                      label={src.label}
                      hint={src.hint}
                      selected={builder.builderSources.includes(src.id)}
                      onClick={() => toggleBuilderSource(src.id)}
                    />
                  ))}
                </div>
              </QuestionBlock>

              {orgTypes.length > 0 ? (
                <QuestionBlock
                  question="Specific organization type?"
                  hint="For power users — most searches work without this."
                >
                  <div className="flex flex-wrap gap-2">
                    {orgTypes.slice(0, 12).map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        aria-pressed={builder.organizationType === org.id}
                        onClick={() =>
                          patch({
                            organizationType:
                              builder.organizationType === org.id
                                ? null
                                : org.id,
                          })
                        }
                        className={`rounded-full border px-3.5 py-2 text-xs font-medium transition ${
                          builder.organizationType === org.id
                            ? "border-accent-cyan/45 bg-accent-soft/20 text-foreground"
                            : "border-border/70 text-muted hover:border-border-strong"
                        }`}
                      >
                        {org.label}
                      </button>
                    ))}
                  </div>
                </QuestionBlock>
              ) : null}

              <QuestionBlock
                question="How should results be ordered?"
                hint="Default is best overall match."
              >
                <div className="flex flex-wrap gap-2">
                  {BUILDER_SORT_OPTIONS.map((opt) => (
                    <PickChip
                      key={opt.id}
                      label={opt.label}
                      hint={opt.hint}
                      selected={(builder.sort ?? "score") === opt.id}
                      onClick={() => patch({ sort: opt.id })}
                    />
                  ))}
                </div>
              </QuestionBlock>

              {!editQuery ? (
                <button
                  type="button"
                  onClick={() => setEditQuery(true)}
                  className="text-sm font-semibold text-muted transition hover:text-foreground"
                >
                  Edit the search phrase directly
                </button>
              ) : (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    Search phrase
                  </span>
                  <input
                    type="text"
                    value={builder.query || generatedQuery}
                    onChange={(e) => patch({ query: e.target.value })}
                    className="w-full rounded-xl border border-border/80 bg-surface/80 px-4 py-3 text-sm outline-none focus:border-border-strong"
                  />
                  <span className="text-xs text-muted-2">
                    We generate this from your picks — edit if you want different
                    wording.
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        <footer className="mt-10 grid gap-5 border-t border-border/60 pt-8">
          {selectionPills.length > 0 ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
                  Your picks
                </p>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs font-semibold text-muted transition hover:text-foreground"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectionPills.map((pill) => (
                  <SelectionPill
                    key={pill.id}
                    label={pill.label}
                    onRemove={() => patch(pill.clear())}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/60 bg-surface-2/40 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
              Preview
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Searching for{" "}
              <span className="font-semibold text-foreground">
                &ldquo;{effectiveQuery}&rdquo;
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-accent-cyan/35 bg-accent-soft/25 px-6 text-sm font-semibold text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition hover:border-accent-cyan/50 hover:bg-accent-soft/35 sm:w-auto sm:min-w-[14rem]"
          >
            {hasBuilderFilters(builder)
              ? "Find matching prospects"
              : "Search all organizations"}
          </button>
        </footer>
      </div>
    </div>
  );
}
