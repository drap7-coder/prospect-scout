# Discovery Regression Plan

This plan guards the discovery layer against source leakage while the connector catalog grows.

## Source Eligibility Scenarios

- **Universities in California**
  - Expected: education-sector organizations only, with university classification and California coverage.
  - Preferred sources: NCES/IPEDS education directory records.
  - Regression risk: generic public records, nonprofits, or employer records outranking credible education records.

- **Banks in Texas**
  - Expected: financial-services organizations classified as banks.
  - Preferred sources: SEC-backed public-company records and banking-classified directory records.
  - Regression risk: manufacturers, generic employers, retailers, or unrelated Texas organizations leaking into the top results.

- **Manufacturers in Ohio**
  - Expected: manufacturing-sector organizations with Ohio coverage.
  - Preferred sources: manufacturing directory, SEC where available, and FDA only when product/regulatory context is relevant.
  - Regression risk: nonprofits, retail, banks, public-sector entities, or generic public records appearing in top results.

- **Health plans and PBMs**
  - Expected: health-plan/PBM entities with CMS and SEC coverage where applicable.
  - Preferred sources: CMS, SEC, contextual FDA, and public-web enrichment.
  - Regression risk: FDA overmatching every health query, CMS leaking into non-health manufacturing queries, or public-web evidence appearing without stronger structured coverage.

## Required Regression Coverage

- Source eligibility by parsed intent and planned provider set.
- Industry, sector, category, and state exclusion rules.
- Confidence and coverage metadata on search responses.
- Benchmark output including coverage percentage and confidence values.
- Diagnostics resilience for empty connector sets, failed connectors, and duplicate connector records.

## Validation Commands

```bash
npm run typecheck
npm run lint
npm run build
npm run test:directory
npm run test:discovery
npm run test:benchmark
npm run test:cms
npm run test:fda
npm run test:sec
```

Run `npm run test:phase` as an additional provider-planning guard when source eligibility rules change.
