# Discovery Engine Roadmap

Prospect Scout is becoming an **Organization Discovery Engine**. The organization is the primary object; signals, news, filings, and AI summaries enrich that object later.

## Current Connectors

| Connector | Status | Coverage | Role |
|-----------|--------|----------|------|
| **Master Directory** | Active | ~83 curated orgs (OH/PA/MI heavy) | Source of truth for who exists |
| **SEC EDGAR** | Active | Public companies (~10k via ticker lookup) | Enrichment: filings, leadership, M&A |
| **CMS** | Active | Major Medicare Advantage / Part D plans | Enrichment: contracts, enrollment |
| **FDA / openFDA** | Active | Food/pharma manufacturers with recalls | Enrichment: enforcement signals |
| **RSS / Press** | Active | ~10 enterprise orgs with curated feeds | Enrichment: leadership, M&A, expansion |
| **Public Web** | Active | Regional health plans + manufacturers | Enrichment: careers, expansion language |

All connectors normalize into the canonical `Organization` schema in `lib/discovery/organization.ts`.

## Architecture

```
Query → parseSearchIntent → Connector.discover() → normalize → merge → rank → Prospect
```

Structured ranking (industry, sector, org type, state) runs **before** signal scoring. Cross-sector mismatches are penalized.

## Internal Tools

- **`/diagnostics`** — catalog coverage, completeness, duplicate detection
- **`/benchmark`** — 10-query regression suite with relevance/confidence metrics
- **`npm run test:discovery`** — unit tests for intent, ranking, dedupe
- **`npm run test:benchmark`** — regression asserts on benchmark queries

## Next Candidates (Priority Order)

Priority is **organization coverage**, not API count.

### Tier 1 — High impact, public data

1. **State business registries** — Secretary of State corp databases (OH, PA, TX, CA first). Adds private/regional companies missing from SEC.
2. **IRS Exempt Organizations (990)** — nonprofit coverage nationwide. Fills "nonprofits in Pennsylvania" and similar queries.
3. **IPEDS / NCES** — public university directory. Fills "universities in California."
4. **SEC company_tickers bulk import** — seed ~10k public companies as directory stubs (name, CIK, ticker, state). Enrichment via existing SEC connector.

### Tier 2 — Sector-specific directories

5. **Government procurement / SAM.gov** — federal contractors. Fills "government contractors in Virginia."
6. **State licensing datasets** — restaurants, healthcare facilities, contractors by state/city.
7. **Trade association member directories** — manufacturing, logistics, aerospace (often public member lists).
8. **Chamber of Commerce directories** — regional business lists.

### Tier 3 — Enrichment depth

9. **Company websites (structured crawl)** — about/leadership/careers pages for orgs already in catalog.
10. **NAIC / state insurance dept** — health plan licensing by state.
11. **College Scorecard / state higher-ed registries** — deeper education coverage.
12. **BLS / Census business patterns** — industry counts by geography (for coverage gaps, not individual orgs).

## Success Criteria

Every search should:

1. Find the correct organizations
2. Rank them by structured intent (industry + geography + org type)
3. Deduplicate by domain then name
4. Normalize into a single Organization model
5. Prepare for future enrichment

## Known Gaps (as of v1)

- Catalog is ~83 orgs; most US geographies/industries have zero or near-zero coverage
- Benchmark queries like "banks in Texas" or "universities in California" expose these gaps by design
- Duplicate org entries exist (e.g. PNC in both employers and financial services pools)
- No bulk import pipeline yet — each org is hand-curated in TypeScript files

## Not In Scope (Yet)

- LinkedIn / gated social data
- Google / broad web crawling
- Paid data vendors (ZoomInfo, D&B, etc.)
- Real-time signal streaming
