# Discovery Quality Audit

Production-readiness audit for Discovery Engine v2. No new connectors or datasets were added in this milestone.

**Audit date:** 2026-06-27  
**Catalog size:** ~20,600 canonical organizations (deduped from ~25k ingested records)

## Test Queries Evaluated

| Query | Results | Top connector | Quality notes |
|-------|---------|-------------|---------------|
| manufacturers in Ohio | ~250 | FDA + directory | Strong; manufacturing sector, OH state. No banks/nonprofits in top 10. |
| banks in Texas | ~348 | SEC (FDIC) | Strong; all banks, TX state, authoritative source. |
| universities in California | ~400+ | NCES | Good coverage; adult/beauty schools filtered from top ranks. |
| nonprofits in Pennsylvania | ~188 | IRS | Strong nonprofit sector match. |
| health plans | ~59 | CMS | Curated CMS registry; keyword + sector match. |
| PBMs | ~26 | CMS | All major PBMs present with `pbm` org type. |
| pharmaceutical manufacturers | ~500+ | FDA + directory | Cross-sector intent pulls FDA pharma-manufacturing + directory life-sciences. |
| medical device companies | ~200+ | FDA + directory | FDA device establishments + directory med-device orgs. |
| hospitals near Philadelphia | ~66 | IRS | Nonprofit hospitals in PA; health plans/PBMs excluded. |

## Known False Positives (Mitigated)

| Issue | Mitigation |
|-------|------------|
| Healthcare orgs ranking for manufacturer queries | Sector incompatibility penalty + strict relevance floor (52+) |
| Health plans appearing for hospital queries | `NON_HOSPITAL_TYPES` filter on `hospital` intent |
| Adult/beauty schools in university results | `UNIVERSITY_EXCLUSION_RE` name filter |
| RSS/public-web outranking directory | Authoritative source +15 / enrichment-only −30 |
| Directory fallback returning unrelated orgs | Removed full-catalog fallback when structured filters exist |

## Known False Negatives (Catalog gaps — not fixed in this milestone)

| Query type | Reason |
|------------|--------|
| Credit unions | Not in FDIC bank feed classification |
| Fintech / asset managers | SEC classification heuristic misses niche titles |
| Retailers / restaurants | Limited SEC title keyword coverage |
| Logistics / aerospace (national) | No structured state filter; SEC title classification sparse |
| Manufacturers in low-coverage states (TN, WI, NC) | FDA ingest samples OH/PA/MI/TX/CA/IN/IL/NY/FL/GA only |

## Duplicate Organizations

- **Domain duplicate rate:** ~1–2% (mostly SEC company + directory overlap)
- **Canonical dedupe:** domain → stripped name → alias map (O(n) pass)
- **Directory priority:** Curated directory names win merges over bulk ingest

## Ranking Priority (v2)

1. Organization type match (+28 / −22 mismatch)
2. Industry match (+32 / −28 mismatch) with crosswalk (life-sciences ↔ pharma/device)
3. State (+26) and city (+22) location
4. Sector match (+18) with explicit cross-sector alternates only
5. Authoritative source (+15)
6. Keyword overlap (+2–8, capped below structured signals)

Minimum relevance **52** for structured queries; incompatible sectors filtered entirely.

## Performance

| Metric | Target | Actual (warm) |
|--------|--------|---------------|
| Catalog load | Once per process | ~180ms initial, then cached |
| Search p50 | < 100ms | ~15ms |
| Search p95 | < 100ms | ~50–80ms (warm) |
| Search p95 (cold first query) | — | ~120ms (includes index init) |

Optimizations: indexed catalog by state/sector/industry/org-type/connector; single canonical build; result cap 500.

## Regression Coverage

- **100 benchmark queries** in `lib/discovery/benchmarkQueries.ts`
- **≥92% pass rate** required (zero results, incompatible sector, latency ≤120ms warm)
- Spot checks for all 6 listing connectors: directory, NCES, SEC, CMS, FDA, IRS

## Diagnostics (`/diagnostics`)

Expanded with: connector health, duplicate rate, search latency (p50/p95), benchmark summary, catalog freshness / last ingest timestamp.
