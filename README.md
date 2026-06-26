# Prospect Scout

**Find the prospects worth calling.**

Prospect Scout is a zero-cost AI business-development tool. It answers one
question for professionals: **"Who should I call, and why?"**

It is **not** a CRM and **not** a generic lead database. It is an _opportunity
finder_: tell it what you sell and who buys it, and it identifies target
organizations, explains why they may be relevant, and suggests outreach angles.

## The core idea: organize around buyer ecosystems

The key design decision is that Prospect Scout is organized around **who buys**,
not around the seller's industry.

A user may sell PBM consulting, actuarial software, care management, or
analytics — but all of those target **Health Plans**. So "Health Plans" is a
**buyer pack**, and every one of those sellers searches within it.

### Initial buyer packs

1. **Health Plans**
2. **Manufacturers**
3. **Health Systems / Hospitals**
4. **Employers**
5. **Municipalities / Public Sector**

The app is structured around four abstractions:

1. **What the user sells** (e.g. "PBM consulting")
2. **Who buys it** (a buyer pack)
3. **Where they want to look** (region)
4. **What signals suggest opportunity** (per-pack signal catalog)

## Running locally

Requires Node 18.18+ (Node 20+ recommended).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```

The MVP uses **mock data only** — no API keys, no database, no authentication.
It is Vercel-ready: push the repo and deploy with zero configuration.

## How a search works

```
raw input
  → intentParser   (heuristic; maps text → buyer pack + region)
  → sourcePlanner  (decides which packs/providers to query)
  → provider       (mockProspects today; real free APIs later)
  → score          (explainable, rule-based 0–100 opportunity score)
  → synthesize     ("why it matters" + outreach angle)
  → sorted Prospect[] → ProspectCard list
```

Each prospect card shows: organization name, location, buyer type, opportunity
score, why it matters, relevant signals, a suggested outreach angle, suggested
contact roles, and a (placeholder) **Save prospect** button.

### Opportunity scoring

Scoring is rule-based and fully **explainable** — every card can reveal its
breakdown. The total (0–100) is the sum of six factors
([`lib/search/score.ts`](lib/search/score.ts)):

| Factor             | Max | Basis                                              |
| ------------------ | --- | -------------------------------------------------- |
| Buyer type match   | 20  | Org is in the selected buyer ecosystem             |
| Region match       | 15  | Org is in the selected geography                   |
| Signal relevance   | 30  | Strength/number of active opportunity signals      |
| Size relevance     | 10  | Organization size tier                             |
| Recent change      | 10  | A notable recent event creates timely urgency      |
| Seller fit         | 15  | Overlap between what you sell and the org's needs  |

Weights live alongside each signal in the buyer pack definitions, so a domain
expert can tune them without touching the scoring engine.

## Project structure

```
app/
  page.tsx                 # Landing + workflow page
  api/search/route.ts      # POST /api/search → runSearch pipeline
  components/
    SearchPanel.tsx         # Composes inputs, calls the API, renders results
    SellerInput.tsx         # "What do you sell?" + quick-fill chips
    BuyerPackSelector.tsx   # Choose the buyer ecosystem
    RegionSelector.tsx      # Choose geography
    ProspectCard.tsx        # Render one prospect (with score breakdown)
    EmptyState.tsx          # Pre-search prompt
    LoadingState.tsx        # Loading skeleton
lib/
  search/
    types.ts                # Core domain types + provider/parser contracts
    regions.ts              # Region buckets + normalization
    intentParser.ts         # Heuristic parser (IntentParser interface)
    sourcePlanner.ts        # Which packs/providers to query
    score.ts                # Explainable rule-based scoring
    synthesize.ts           # "Why it matters" + outreach angle
    runSearch.ts            # End-to-end pipeline orchestration
  packs/
    healthPlans.ts          # Buyer pack definitions...
    manufacturers.ts
    healthSystems.ts
    employers.ts
    publicSector.ts
    index.ts                # Pack registry
  providers/
    mockProspects.ts        # Mock data + ProspectProvider contract
```

## Adding a new buyer pack

Buyer packs are designed to be added in minutes:

1. **Create the pack file** `lib/packs/<yourPack>.ts` exporting a `BuyerPack`
   with its `signals` (each with a tuning `weight`) and `contactRoles`.
2. **Add its id** to the `BuyerPackId` union in
   [`lib/search/types.ts`](lib/search/types.ts).
3. **Register it** in [`lib/packs/index.ts`](lib/packs/index.ts) (add to the
   `buyerPacks` record and `buyerPackList`).
4. **(Optional)** add mock organizations for it in
   [`lib/providers/mockProspects.ts`](lib/providers/mockProspects.ts) and
   "why it matters" / outreach phrasing for any new signals in
   [`lib/search/synthesize.ts`](lib/search/synthesize.ts).
5. **(Optional)** teach the heuristic parser new keyword cues in
   [`lib/search/intentParser.ts`](lib/search/intentParser.ts).

The UI selector, scoring, and pipeline pick up the new pack automatically.

## Providers

### SEC EDGAR (first real provider)

[`lib/providers/secEdgar.ts`](lib/providers/secEdgar.ts) is the first real
public-data source. When a search references a public company or ticker and the
buyer pack can contain public filers (manufacturers, employers, and
health-plans / health-systems when a public match exists — never public-sector),
the pipeline looks the company up in SEC's `company_tickers.json`, fetches its
recent submissions by CIK, and extracts normalized `ProspectSignal`s:

- `8-K` recent event, `10-K` annual, `10-Q` quarterly
- acquisition / merger (8-K item 2.01 / 1.01)
- executive / leadership change (8-K item 5.02)
- risk factor language (from 10-K), capital investment & cost-pressure language

These appear as real source-trail rows (e.g. `SEC · EDGAR · Recent 8-K`).

SEC requires a descriptive **User-Agent** with contact info on every request.
Configure it via an env var (see [.env.example](.env.example)):

```bash
SEC_USER_AGENT="Prospect Scout your-email@example.com"
```

If it is unset, the app logs a warning and uses a safe development fallback.

**Graceful fallback:** SEC is best-effort. Any SEC error is caught and the search
returns the normal mock results with a single `SEC · EDGAR unavailable` note on
the source trail — the UI never breaks, and mock data is always the fallback.

Run the provider checks (ticker lookup, CIK padding, submissions URL, signal
extraction) with:

```bash
npm run test:sec
```

## How future free APIs plug in

Everything is structured so **real, free public data sources** can replace or
augment the mock provider without changing the pipeline.

- A provider implements the `ProspectProvider` contract in
  [`lib/providers/mockProspects.ts`](lib/providers/mockProspects.ts):
  `fetch(plan: SourcePlan) => RawProspect[]`.
- [`lib/search/sourcePlanner.ts`](lib/search/sourcePlanner.ts) decides which
  providers to call for a given buyer pack and fans out accordingly.
- An LLM-backed parser can implement the same `IntentParser` interface in
  [`lib/search/intentParser.ts`](lib/search/intentParser.ts) — no downstream
  changes required.

Planned free sources (all no-cost public APIs/feeds):

| Source              | Useful for                                            |
| ------------------- | ----------------------------------------------------- |
| **CMS**             | Medicare/Medicaid plan & enrollment data              |
| **SEC EDGAR**       | Public-company filings, M&A, material events          |
| **Census**         | County Business Patterns, employer/firm size          |
| **FDA**             | Recalls, enforcement, device events                   |
| **NPPES**           | Provider / organization registry                      |
| **Wikipedia**       | Organization descriptions & disambiguation            |
| **RSS / news**      | Leadership changes, expansions, acquisitions          |
| **Company websites**| Careers pages, press releases                         |

## Status

This is an MVP intended to prove the concept and the architecture. Results are
illustrative mock data. No paid APIs, authentication, or database are used.
