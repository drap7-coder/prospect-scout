# Organization Warehouse

Prospect Scout uses a **generic Organization Warehouse** as the canonical catalog for organization discovery and search. The warehouse is sector-agnostic. Connectors import source-specific data and map it into one shared `Organization` model.

```
Organization Warehouse
        ↓
Connector Registry
        ↓
Health Plans · Manufacturers · Hospitals · PBMs · Employers · …
```

Search reads the warehouse index. It does **not** assemble organizations from connectors at query time.

---

## Two-layer architecture

### Layer 1 — Generic warehouse (applies everywhere)

Capabilities that belong here are **never sector-specific**:

| Capability | Location |
|------------|----------|
| Parent/child organization hierarchy | `Organization.parentId`, `parentDisplayName` |
| Canonical geography | `Organization.geography` |
| Verified external ID framework | `Organization.externalIds`, `mergeByVerifiedIds.ts` |
| Merge engine | `mergeByVerifiedIds.ts`, `organizationCapabilities.ts` |
| Organization classifications (storage + search semantics) | `lib/organization/model.ts`, `organizationCapabilities.ts` |
| Diagnostics & coverage | `connectorDiagnostics.ts`, `coverageReport.ts` |
| Search indexing & semantics | `discover.ts`, `organizationCapabilities.ts` |

The warehouse stores classifications and sector attributes **without interpreting their meaning**.

### Layer 2 — Connectors (sector-specific)

Each connector owns:

- Source fetch and parse (CMS, SEC, FDA, bootstrap seeds, etc.)
- Mapping source fields → generic warehouse fields
- Sector-specific classification ids and labels
- Connector-local diagnostics and regression checks

Connector mapping modules live next to the connector, not in the warehouse core:

- `lib/import/healthPlans/warehouseMapping.ts`
- `lib/import/manufacturers/warehouseMapping.ts`

---

## Promotion rule

> **A capability should move into the generic warehouse layer only after at least two connectors need it. Until then, keep the behavior inside the connector.**

Examples:

- **Geography + state search** — promoted (health plans and manufacturers both need it).
- **Medicare Advantage vs Part D** — stays in the health-plans connector as `classifications` under namespace `health-plans`.
- **CIK / FDA establishment IDs** — stored generically as `externalIds`; interpretation stays in the manufacturers connector.

Do not add health-plan-specific fields to the warehouse core unless they are modeled as generic `classifications` or `sectorAttributes`.

---

## Generic Organization model

Canonical types: `lib/organization/model.ts`  
Runtime type: `lib/discovery/organization.ts` (`Organization`)

```typescript
Organization {
  id
  legalName          // optional; defaults to canonicalName
  displayName        // optional; defaults to canonicalName
  canonicalName
  sectorId
  industries
  organizationType
  canonicalOrganizationType
  parentId           // optional cross-org link (when resolved)
  parentDisplayName  // human-readable parent; often from source metadata
  geography          // OrganizationGeography
  externalIds        // OrganizationExternalId[]
  classifications    // OrganizationClassification[]
  sectorAttributes   // SectorAttributes (opaque key/value)
  // legacy mirrors for compatibility: states, regions, healthPlanType (deprecated)
}
```

### `classifications`

Sector-scoped labels stored consistently; the warehouse does not interpret ids.

```typescript
interface OrganizationClassification {
  namespace: string;  // connector id, e.g. "health-plans", "manufacturers"
  id: string;         // stable id within namespace, e.g. "medicare_advantage"
  label?: string;     // display hint for UI/diagnostics
}
```

Search uses `SearchIntent.classificationFilter` (`namespace` + `ids[]`) via `classificationMatchesIntent()`.

### `sectorAttributes`

Opaque connector-specific metadata. The warehouse persists it; only the connector reads it.

```typescript
type SectorAttributes = Record<string, string | number | boolean | string[] | null | undefined>;
```

Examples: `linesOfBusiness`, `marketSegment`, `sourceTags`.

### `externalIds`

Verified registry identifiers used for merge and deduplication.

```typescript
interface OrganizationExternalId {
  idType: string;   // e.g. "cms_contract", "cik", "fda_establishment"
  idValue: string;
  source?: string;  // connector that supplied the id
}
```

**Merge policy:** prefer verified IDs. **Never merge organizations on name similarity alone.** See `mergeByVerifiedIds.ts`.

### `geography`

```typescript
interface OrganizationGeography {
  states: string[];       // US state/territory codes
  regions: string[];      // region bucket ids
  headquarters: string | null;
  national: boolean;      // national scope for this indexed record
}
```

State-scoped queries match orgs that **list that state**. National-only records (empty `states`, `national: true`) are excluded from state queries unless they also list the state.

---

## Connector registry

Registry: `lib/import/warehouse/connectors/registry.ts`

| Connector id | Definition | Mapping module |
|--------------|------------|----------------|
| `health-plans` | `connectors/healthPlans.ts` | `lib/import/healthPlans/warehouseMapping.ts` |
| `manufacturers` | `connectors/manufacturers.ts` | `lib/import/manufacturers/warehouseMapping.ts` |

Each connector implements `WarehouseConnectorDefinition`: import, index access, summarize, optional hydration, and per-connector backup/restore on failure.

### Health plans (first production connector)

Sources:

- CMS CPSC contract summaries
- QHP issuers (HIOS)
- Medicaid MCO and enrollment plans
- Curated bootstrap seed (`lib/directories/healthPlans.ts`)

Classifications (namespace `health-plans`):

| id | Meaning |
|----|---------|
| `medicare_advantage` | Medicare Advantage |
| `part_d` | Part D |
| `medicaid_managed_care` | Medicaid MCO |
| `aca_marketplace` | ACA / QHP marketplace |
| `commercial` | Commercial / other |

External id types: `cms_contract`, `hios`, `naic`, `npi`, `domain`, etc.

Health plans prove production import at scale; they are **not** the architecture.

### Manufacturers (cross-sector proof)

Sources:

- SEC EDGAR (CIK, ticker)
- FDA establishments
- Curated bootstrap seed (`lib/directories/manufacturers.ts`)

Classifications (namespace `manufacturers`):

| id | Meaning |
|----|---------|
| `pharma` | Pharmaceutical |
| `device` | Medical device |
| `biotech` | Biotech |
| `generic` | Generic manufacturing |
| `food_beverage` | Food & beverage |

External id types: `cik`, `ticker`, `fda_establishment`, `domain`.

Manufacturers demonstrate that the same warehouse model and search path work outside healthcare payers.

---

## Search integration

When `shouldUseOrganizationWarehouse()` is true (see feature flags below), discovery routes to the warehouse index:

```
SearchIntent
    → discoverFromOrganizationWarehouse()   [lib/import/warehouse/discover.ts]
    → warehouseOrganizationsForIntent()       (scope by buyer pack / org type)
    → orgMatchesWarehouseQuery()              (geography, classification, intent, text)
    → rankOrganizations() / filterIncompatibleOrganizations()
```

Warehouse search semantics (`organizationCapabilities.ts`):

- **Geography** — `geographyMatchesIntent()`
- **Classification** — `classificationMatchesIntent()`
- **Structured intent** — `orgMatchesIntent()` from catalog index
- **Free text** — `organizationMatchesSignificantQueryText()` when non-filler terms remain

Do **not** re-assemble organizations from multiple runtime connectors when the warehouse index is loaded. The catalog index delegates to warehouse orgs when warehouse mode is active.

Pipeline trace: `traceWarehouseSearchPipeline()` — used by diagnostics and `npm run test:warehouse-search`.

---

## Import workflow

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run fetch:warehouse` | Fetch upstream source files for all connectors |
| `npm run import:warehouse` | Run full warehouse import |
| `npm run import:manufacturers` | Manufacturers connector only |
| `npm run test:warehouse-search` | Verify warehouse-primary search |
| `npm run test:organization-model` | Geography, classification, and query semantics |

### Strict import

`WAREHOUSE_STRICT_IMPORT=1` (production default): fail the import if a required connector fails.

`WAREHOUSE_STRICT_IMPORT=0` (development): continue with successful connectors; failed connectors restore their previous index snapshot.

Per-connector backup/restore prevents one connector failure from wiping another connector's index.

### Feature flags

| Variable | Effect |
|----------|--------|
| `ORG_WAREHOUSE=1` | Force warehouse mode in development |
| `ORG_WAREHOUSE=0` | Force bootstrap seed directories |
| (unset) | Production defaults to warehouse; dev defaults to seed unless index populated |
| `HEALTH_PLAN_IMPORT_STRICT=0` | Skip CMS regression gate in dev |
| `USE_CMS_FIXTURES=1` | Use fixture CMS paths in tests |

---

## Diagnostics

| Surface | Location |
|---------|----------|
| Deployment & runtime snapshot | `/diagnostics` · `/warehouse` |
| JSON runtime API | `GET /api/diagnostics/runtime` |
| Warehouse manifest & summary | `getOrganizationWarehouseManifest()`, `/warehouse` |
| Connector coverage detail | `computeWarehouseConnectorCoverageDetails()`, `/warehouse/coverage` |
| Connector import status | `importOrganizationWarehouse()` outcomes per connector |
| Duplicate org ids | `countDuplicateOrganizationIds()` — must stay **0** |
| Search pipeline trace | `traceWarehouseSearchPipeline()` |

The runtime API returns git commit, deployment environment, `ORG_WAREHOUSE` status, per-connector org counts, and warnings when the live site may be on bootstrap seed or misconfigured.

Compare local vs production:

```bash
curl -s http://localhost:3000/api/diagnostics/runtime | jq '.deployment.gitCommitShort, .warehouse'
curl -s https://your-app.vercel.app/api/diagnostics/runtime | jq '.deployment.gitCommitShort, .warehouse'
```

On Vercel, `VERCEL_GIT_COMMIT_SHA` is set automatically. Non-Vercel builds stamp `GIT_COMMIT_SHA` during `npm run build`.

### Production hydration (Neon)

Serverless production **does not** run CMS/SEC import on every cold start. Instead:

1. Set `DATABASE_URL` in Vercel production to your Neon pooled connection string.
2. Seed Neon once from your machine (safe path):

```bash
npm run fetch:warehouse
DATABASE_URL="postgresql://..." npm run import:warehouse:neon
```

3. Vercel hydrates the in-memory warehouse index from Neon on the first request (`ensureOrganizationWarehouseHydrated`).

Import manifests (`cmsImportMode`, `importedAt`, LOB counts, connector metadata) are persisted in the `warehouse_connector_manifests` table so `/api/diagnostics/runtime` reports honest `catalogMode` and `lastImport` after cold start — not a misleading `fixture` label from filesystem-only checks.

#### Verify production

```bash
curl -s https://your-app.vercel.app/api/diagnostics/runtime | jq '.warehouse.catalogMode, .warehouse.lastImport, .warehouse.healthPlanOrganizations'
```

Smoke-test ACA catalog browse (should match warehouse ACA count, e.g. ~143 issuers):

```bash
curl -s -X POST https://your-app.vercel.app/api/search \
  -H 'Content-Type: application/json' \
  -d '{"catalog":"aca-marketplace-plans","phase":"full"}' \
  | jq '.discovery.totalReturned, (.prospects | length)'
```

`discovery.totalReturned` and `prospects.length` should match for catalog-only browse.

#### Unsafe: POST /api/warehouse/import on Vercel

**Do not** use `POST /api/warehouse/import` on Vercel production. The deployment bundle does not include production CMS CSV snapshots; a remote import can overwrite Neon with fixture-scale data or fail unpredictably. Always import from your machine with `npm run fetch:warehouse` + `DATABASE_URL=... npm run import:warehouse:neon`.

If `/api/diagnostics/runtime` shows `databaseConfigured: false` or `organizationsInDb: 0`, hydration cannot succeed until Neon is configured and seeded locally.

Connector failures must remain **isolated** (per-connector restore) and **visible** (status `failed` / `warning` with error message in import result and diagnostics UI).

---

## Adding a new connector

1. Implement import + index under `lib/import/<sector>/`.
2. Add `warehouseMapping.ts` to map source rows → `geography`, `classifications`, `sectorAttributes`, `externalIds`.
3. Register in `lib/import/warehouse/connectors/<name>.ts` and `registry.ts`.
4. Add to `PRODUCTION_WAREHOUSE_CONNECTOR_IDS` in `organizations.ts`.
5. Extend `importOrganizationWarehouse()` with per-connector backup/restore.
6. Add connector checks script and coverage diagnostics.
7. **Do not** change search architecture — warehouse discover path stays the same.
8. Promote shared behavior to Layer 1 only when a **second** connector needs it.

---

## Key files

```
lib/import/warehouse/
  README.md                    ← this document
  index.ts                     ← public exports
  organizations.ts             ← merged warehouse index
  discover.ts                  ← warehouse-primary search
  organizationCapabilities.ts  ← Layer 1 normalization & semantics
  classificationIntent.ts      ← generic classification filter types
  mergeByVerifiedIds.ts        ← verified-id merge
  import.ts                    ← orchestrated multi-connector import
  connectorDiagnostics.ts      ← per-connector coverage
  connectors/
    registry.ts
    healthPlans.ts
    manufacturers.ts

lib/organization/model.ts      ← generic type definitions
lib/discovery/organization.ts  ← runtime Organization + finalize/merge
```
