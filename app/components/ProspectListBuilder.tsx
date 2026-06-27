"use client";

import { useMemo, useState } from "react";
import {
  BUILDER_OWNERSHIP_OPTIONS,
  BUILDER_ORG_TYPE_REFINEMENTS,
  BUILDER_PRIMARY_CATEGORIES,
  BUILDER_SECONDARY_CATEGORIES,
  BUILDER_SIGNAL_OPTIONS,
  BUILDER_SIZE_OPTIONS,
  BUILDER_SORT_OPTIONS,
  BUILDER_SOURCE_OPTIONS,
  buildNaturalLanguageSummary,
  buildSearchQueryFromBuilder,
  type ProspectListBuilderState,
  EMPTY_BUILDER_STATE,
} from "@/lib/search/prospectListBuilder";
import { LOCATIONS, US_STATE_FILTERS } from "@/lib/search/searchState";
import {
  getOrganizationType,
  industryLabel,
  organizationTypeLabel,
  sectorLabel,
  TAXONOMY_INDUSTRIES,
  organizationTypesForFilters,
} from "@/lib/taxonomy";
import {
  canonicalOrgTypeLabel,
  isCanonicalOrgTypeId,
} from "@/lib/discovery/canonicalOrgType";
import { useInteractionFeedback } from "./InteractionProvider";

type LocationMode = "anywhere" | "nationwide" | "state" | "city";

type OrgTypeChoice = {
  id: string;
  label: string;
  sectorId: string;
  industry?: string | null;
  industryId?: string | null;
};

function StepIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
      {children}
    </span>
  );
}

function StepCard({
  step,
  icon,
  question,
  children,
}: {
  step: number;
  icon: React.ReactNode;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-float rounded-[1.25rem] p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        {icon}
        <div className="min-w-0 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-2">
            Step {step}
          </p>
          <h3 className="mt-1 text-lg font-semibold leading-snug text-foreground">
            {question}
          </h3>
        </div>
      </div>
      {children}
    </section>
  );
}

function CategoryCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const { feedback } = useInteractionFeedback();

  return (
    <button
      type="button"
      onClick={() => {
        feedback(selected ? "tap" : "select");
        onClick();
      }}
      aria-pressed={selected}
      className={`interactive-press interactive-choice flex min-h-[3.75rem] w-full items-center rounded-2xl px-4 py-3.5 text-left text-sm font-semibold sm:min-h-[4.25rem] sm:text-[0.9375rem] ${
        selected ? "card-selected" : ""
      }`}
    >
      {label}
    </button>
  );
}

function ChoiceChip({
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
  const { feedback } = useInteractionFeedback();

  return (
    <button
      type="button"
      onClick={() => {
        feedback(selected ? "tap" : "select");
        onClick();
      }}
      aria-pressed={selected}
      className={`interactive-press interactive-choice min-h-[3.25rem] rounded-2xl px-4 py-3 text-left ${
        selected ? "card-selected" : ""
      }`}
    >
      <span
        className={`block text-sm font-semibold ${
          selected ? "text-white" : "text-foreground"
        }`}
      >
        {label}
      </span>
      {hint ? (
        <span
          className={`mt-0.5 block text-xs ${
            selected ? "text-white/80" : "text-muted"
          }`}
        >
          {hint}
        </span>
      ) : null}
    </button>
  );
}

function HierarchyStack({ builder }: { builder: ProspectListBuilderState }) {
  const levels: string[] = [];
  if (builder.sector) levels.push(sectorLabel(builder.sector));
  if (builder.industry) levels.push(industryLabel(builder.industry));
  if (builder.organizationType) {
    levels.push(
      isCanonicalOrgTypeId(builder.organizationType)
        ? canonicalOrgTypeLabel(builder.organizationType)
        : organizationTypeLabel(builder.organizationType),
    );
  }
  if (levels.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface-2/80 px-4 py-3 text-left">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-2">
        Your selection
      </p>
      <div className="mt-2 flex flex-col gap-1">
        {levels.map((level, i) => (
          <div key={`${level}-${i}`} className="flex items-center gap-2">
            {i > 0 ? (
              <span className="text-muted-2" aria-hidden>
                ↓
              </span>
            ) : null}
            <span
              className={`text-sm font-semibold ${
                i === levels.length - 1 ? "text-accent-cyan" : "text-foreground"
              }`}
            >
              {level}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function orgTypeMatchesSelection(
  orgTypeId: string | null,
  sectorId: string | null,
  industryId: string | null,
): boolean {
  if (!orgTypeId) return true;
  if (isCanonicalOrgTypeId(orgTypeId)) return true;
  const org = getOrganizationType(orgTypeId);
  if (!org) return false;
  if (industryId) return org.industryId === industryId;
  if (sectorId) return org.sectorId === sectorId;
  return true;
}

function orgChoiceIndustry(choice: OrgTypeChoice): string | null {
  return choice.industry ?? choice.industryId ?? null;
}

export function ProspectListBuilder({
  open,
  onSubmit,
  initialState,
  initialCategoryId = null,
}: {
  open: boolean;
  onSubmit: (state: ProspectListBuilderState) => void;
  /** Preloads the builder (e.g. from the homepage industry selector). */
  initialState?: ProspectListBuilderState;
  initialCategoryId?: string | null;
}) {
  const [builder, setBuilder] = useState<ProspectListBuilderState>(
    initialState ?? EMPTY_BUILDER_STATE,
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(
    initialCategoryId,
  );
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const [showAllOrgTypes, setShowAllOrgTypes] = useState(false);
  const [locationMode, setLocationMode] = useState<LocationMode>("anywhere");
  const [showLocationAdvanced, setShowLocationAdvanced] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [editQuery, setEditQuery] = useState(false);
  const { feedback } = useInteractionFeedback();

  const orgTypes = useMemo(
    () => organizationTypesForFilters(builder.sector, builder.industry),
    [builder.sector, builder.industry],
  );

  const featuredOrgTypes = useMemo(() => {
    if (!builder.sector) return [];
    return BUILDER_ORG_TYPE_REFINEMENTS[builder.sector] ?? [];
  }, [builder.sector]);

  const industriesForSector = useMemo(() => {
    if (!builder.sector) return [];
    return TAXONOMY_INDUSTRIES.filter((i) => i.sectorId === builder.sector);
  }, [builder.sector]);

  const visibleIndustries = showAllIndustries
    ? industriesForSector
    : industriesForSector.slice(0, 6);
  const visibleOrgTypes = showAllOrgTypes ? orgTypes : orgTypes.slice(0, 8);
  const visibleOrgTypeChoices: OrgTypeChoice[] =
    featuredOrgTypes.length > 0 ? featuredOrgTypes : visibleOrgTypes;

  const generatedQuery = useMemo(
    () => buildSearchQueryFromBuilder(builder),
    [builder],
  );
  const summary = useMemo(
    () => buildNaturalLanguageSummary(builder),
    [builder],
  );

  function patch(partial: Partial<ProspectListBuilderState>) {
    setBuilder((prev) => ({ ...prev, ...partial }));
  }

  function pickCategory(category: {
    cardId: string;
    sectorId: string;
    industry?: string | null;
    organizationType?: string | null;
    ownership?: string | null;
    builderSources?: string[];
    builderSignals?: string[];
  }) {
    const { cardId } = category;
    if (activeCategory === cardId && !builder.industry && !builder.organizationType) {
      setActiveCategory(null);
      patch({
        sector: null,
        industry: null,
        organizationType: null,
        ownership: null,
        builderSources: [],
        builderSignals: [],
      });
      return;
    }
    setActiveCategory(cardId);
    patch({
      sector: category.sectorId,
      industry: category.industry ?? null,
      organizationType: category.organizationType ?? null,
      ownership: category.ownership ?? builder.ownership,
      builderSources: category.builderSources ?? builder.builderSources,
      builderSignals: category.builderSignals ?? builder.builderSignals,
    });
    setShowAllIndustries(false);
    setShowAllOrgTypes(false);
  }

  function pickIndustry(industryId: string) {
    const ind = TAXONOMY_INDUSTRIES.find((i) => i.id === industryId);
    const deselect = builder.industry === industryId;
    const nextIndustry = deselect ? null : industryId;
    patch({
      industry: nextIndustry,
      sector: ind?.sectorId ?? builder.sector,
      organizationType: orgTypeMatchesSelection(
        builder.organizationType,
        ind?.sectorId ?? builder.sector,
        nextIndustry,
      )
        ? builder.organizationType
        : null,
    });
  }

  function pickOrganizationType(
    orgId: string,
    sectorId?: string | null,
    industryId?: string | null,
  ) {
    const org = getOrganizationType(orgId);
    if (!org && !isCanonicalOrgTypeId(orgId)) return;
    if (builder.organizationType === orgId) {
      patch({ organizationType: null });
      return;
    }
    patch({
      organizationType: orgId,
      sector: sectorId ?? org?.sectorId ?? builder.sector,
      industry: industryId ?? org?.industryId ?? builder.industry,
    });
  }

  function setMode(mode: LocationMode) {
    setLocationMode(mode);
    if (mode === "anywhere") {
      patch({ location: null, state: null, metro: null });
    } else if (mode === "nationwide") {
      patch({ location: "nationwide", state: null, metro: null });
    } else if (mode === "state") {
      patch({ location: null, metro: null });
    } else if (mode === "city") {
      patch({ location: null, state: null });
    }
  }

  function toggleSignal(id: string) {
    setBuilder((prev) => ({
      ...prev,
      builderSignals: prev.builderSignals.includes(id)
        ? prev.builderSignals.filter((s) => s !== id)
        : [...prev.builderSignals, id],
    }));
  }

  function toggleSource(id: string) {
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
    feedback("confirm");
    onSubmit({ ...builder, query: builder.query.trim() || generatedQuery });
  }

  if (!open) return null;

  return (
    <div className="mt-8 space-y-5 text-left sm:mt-10">
      <StepCard
        step={1}
        icon={
          <StepIcon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 20V9l8-5 8 5v11H4Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          </StepIcon>
        }
        question="Search criteria: who should we find?"
      >
        <fieldset>
          <legend className="mb-2.5 text-sm font-medium text-muted">
            Prospect list starters
          </legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {BUILDER_PRIMARY_CATEGORIES.map((cat) => (
              <CategoryCard
                key={cat.cardId}
                label={cat.label}
                selected={activeCategory === cat.cardId}
                onClick={() => pickCategory(cat)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="mb-2.5 text-sm font-medium text-muted">
            Broader sectors{" "}
            <span className="font-normal text-muted-2">(optional)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {BUILDER_SECONDARY_CATEGORIES.map((cat) => (
              <button
                key={cat.cardId}
                type="button"
                aria-pressed={activeCategory === cat.cardId}
                onClick={() => pickCategory(cat)}
                className={`interactive-press rounded-full border px-4 py-2.5 text-sm font-medium ${
                  activeCategory === cat.cardId
                    ? "card-selected"
                    : "interactive-choice border-border text-muted"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </fieldset>

        {builder.sector ? (
          <div className="mt-5 space-y-4">
            <HierarchyStack builder={builder} />

            {visibleOrgTypeChoices.length > 0 ? (
              <fieldset>
                <legend className="mb-2.5 text-sm font-medium text-muted">
                  Organization type{" "}
                  <span className="font-normal text-muted-2">(recommended)</span>
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {visibleOrgTypeChoices.map((org) => (
                    <CategoryCard
                      key={`${org.id}-${orgChoiceIndustry(org) ?? "any"}`}
                      label={org.label}
                      selected={
                        builder.organizationType === org.id &&
                        (!orgChoiceIndustry(org) ||
                          builder.industry === orgChoiceIndustry(org))
                      }
                      onClick={() =>
                        pickOrganizationType(
                          org.id,
                          org.sectorId,
                          orgChoiceIndustry(org),
                        )
                      }
                    />
                  ))}
                </div>
                {featuredOrgTypes.length === 0 && orgTypes.length > 8 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllOrgTypes((v) => !v)}
                    className="mt-2 text-sm font-semibold text-accent-cyan"
                  >
                    {showAllOrgTypes ? "Show fewer" : "Show all types"}
                  </button>
                ) : null}
              </fieldset>
            ) : null}

            {industriesForSector.length > 0 ? (
              <fieldset>
                <p className="mb-2.5 text-sm font-medium text-muted">
                  Industry{" "}
                  <span className="font-normal text-muted-2">
                    (advanced refinement)
                  </span>
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {visibleIndustries.map((ind) => (
                    <CategoryCard
                      key={ind.id}
                      label={ind.label}
                      selected={builder.industry === ind.id}
                      onClick={() => pickIndustry(ind.id)}
                    />
                  ))}
                </div>
                {industriesForSector.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllIndustries((v) => !v)}
                    className="mt-2 text-sm font-semibold text-accent-cyan"
                  >
                    {showAllIndustries ? "Show fewer" : "Show all industries"}
                  </button>
                ) : null}
              </fieldset>
            ) : null}
          </div>
        ) : null}
      </StepCard>

      <StepCard
        step={2}
        icon={
          <StepIcon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 21s7-4.5 7-10a7 7 0 1 0-14 0c0 5.5 7 10 7 10Z"
                stroke="currentColor"
                strokeWidth="1.75"
              />
              <circle cx="12" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.75" />
            </svg>
          </StepIcon>
        }
        question="Search criteria: where should we look?"
      >
        <fieldset>
          <legend className="sr-only">Location mode</legend>
          <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              ["anywhere", "Any location"],
              ["nationwide", "Nationwide"],
              ["state", "Headquartered in state"],
              ["city", "Near city/metro"],
            ] as const
          ).map(([mode, label]) => (
            <ChoiceChip
              key={mode}
              label={label}
              selected={locationMode === mode}
              onClick={() => setMode(mode)}
            />
          ))}
          </div>
        </fieldset>

        {locationMode === "state" ? (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-muted">
              Select state
            </span>
            <select
              value={builder.state ?? ""}
              onChange={(e) => patch({ state: e.target.value || null })}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-sm outline-none focus:border-accent-cyan/40 focus:ring-2 focus:ring-accent-cyan/15"
            >
              <option value="">Choose a state…</option>
              {US_STATE_FILTERS.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {locationMode === "city" ? (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-muted">
              City or metro area
            </span>
            <input
              type="text"
              value={builder.metro ?? ""}
              onChange={(e) => patch({ metro: e.target.value || null })}
              placeholder="e.g. Columbus, Austin, Dallas"
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-sm outline-none focus:border-accent-cyan/40 focus:ring-2 focus:ring-accent-cyan/15"
            />
          </label>
        ) : null}

        {!showLocationAdvanced ? (
          <button
            type="button"
            onClick={() => setShowLocationAdvanced(true)}
            className="mt-3 text-sm font-semibold text-muted hover:text-foreground"
          >
            Advanced location options
          </button>
        ) : (
          <div className="mt-4 space-y-4 rounded-xl border border-border bg-surface-2/60 p-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">
                Region
              </span>
              <select
                value={builder.location ?? ""}
                onChange={(e) => patch({ location: e.target.value || null })}
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none"
              >
                <option value="">Any region</option>
                {LOCATIONS.filter((l) => l.id !== "nationwide").map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="mb-2 text-sm font-medium text-muted">
                Operates in states
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
                        ? "card-selected"
                        : "border-border text-muted hover:border-border-strong"
                    }`}
                  >
                    {st.id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </StepCard>

      <StepCard
        step={3}
        icon={
          <StepIcon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 18V6l8 4 8-4v12l-8 4-8-4Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          </StepIcon>
        }
        question="Narrow results: which signals matter?"
      >
        <fieldset>
          <legend className="sr-only">Signal filters</legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {BUILDER_SIGNAL_OPTIONS.map((sig) => (
              <ChoiceChip
                key={sig.id}
                label={sig.label}
                hint={sig.hint}
                selected={builder.builderSignals.includes(sig.id)}
                onClick={() => toggleSignal(sig.id)}
              />
            ))}
          </div>
        </fieldset>
      </StepCard>

      <StepCard
        step={4}
        icon={
          <StepIcon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect
                x="4"
                y="8"
                width="16"
                height="12"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.75"
              />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.75" />
            </svg>
          </StepIcon>
        }
        question="Narrow results: size and ownership"
      >
        <fieldset>
          <legend className="mb-2.5 text-sm font-medium text-muted">
            Company size
          </legend>
          <div className="grid grid-cols-2 gap-2.5">
            {BUILDER_SIZE_OPTIONS.map((size) => (
              <ChoiceChip
                key={size.id}
                label={size.label}
                hint={size.hint}
                selected={builder.companySize === size.id}
                onClick={() =>
                  patch({
                    companySize:
                      builder.companySize === size.id ? null : size.id,
                  })
                }
              />
            ))}
          </div>
        </fieldset>
        <div className="mt-5">
          <fieldset>
          <legend className="mb-2.5 text-sm font-medium text-muted">
            Ownership{" "}
            <span className="font-normal text-muted-2">(optional)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {BUILDER_OWNERSHIP_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={builder.ownership === o.id}
                onClick={() => {
                  const next = builder.ownership === o.id ? null : o.id;
                  feedback(next ? "select" : "tap");
                  patch({ ownership: next });
                }}
                className={`interactive-press rounded-full border px-4 py-2.5 text-sm font-medium ${
                  builder.ownership === o.id
                    ? "card-selected"
                    : "interactive-choice border-border text-muted"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          </fieldset>
        </div>
      </StepCard>

      {!showMoreFilters ? (
        <button
          type="button"
          onClick={() => setShowMoreFilters(true)}
          className="text-sm font-semibold text-muted hover:text-foreground"
        >
          More filters
        </button>
      ) : (
        <StepCard
          step={5}
          icon={
            <StepIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 6h16M7 12h10M10 18h4"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </StepIcon>
          }
          question="Source/evidence and sort"
        >
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2.5 text-sm font-medium text-muted">
                Source/evidence
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BUILDER_SOURCE_OPTIONS.map((src) => (
                  <ChoiceChip
                    key={src.id}
                    label={src.label}
                    selected={builder.builderSources.includes(src.id)}
                    onClick={() => toggleSource(src.id)}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2.5 text-sm font-medium text-muted">
                Sort results by
              </legend>
              <div className="flex flex-wrap gap-2">
                {BUILDER_SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={(builder.sort ?? "score") === opt.id}
                    onClick={() => patch({ sort: opt.id })}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      (builder.sort ?? "score") === opt.id
                        ? "card-selected"
                        : "border-border text-muted hover:border-border-strong"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
            {!editQuery ? (
              <button
                type="button"
                onClick={() => setEditQuery(true)}
                className="text-sm font-semibold text-muted hover:text-foreground"
              >
                Edit search phrase
              </button>
            ) : (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-muted">
                  Search phrase
                </span>
                <input
                  type="text"
                  value={builder.query || generatedQuery}
                  onChange={(e) => patch({ query: e.target.value })}
                  className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none"
                />
              </label>
            )}
          </div>
        </StepCard>
      )}

      <div className="card-float rounded-[1.25rem] p-5 sm:p-6">
        <p className="text-base leading-relaxed text-foreground">{summary}</p>
        <button
          type="button"
          onClick={handleSubmit}
          className="interactive-press interactive-primary mt-5 inline-flex min-h-[3rem] w-full items-center justify-center rounded-2xl bg-accent-cyan px-6 py-3.5 text-sm font-semibold text-white sm:w-auto sm:min-w-[15rem]"
        >
          Find Matching Prospects
        </button>
      </div>
    </div>
  );
}
