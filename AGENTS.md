<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Organization Warehouse architecture

Prospect Scout is built around a **generic Organization Warehouse**, not a health-plan-specific catalog. Read `lib/import/warehouse/README.md` before changing import, search, or organization fields.

## Rules for all contributors

1. **Prospect Scout uses a generic Organization Warehouse.** One canonical `Organization` model serves every sector (health plans, manufacturers, hospitals, PBMs, employers, etc.).

2. **The warehouse is the source of truth for search.** When warehouse mode is active, search results come from the pre-built warehouse index.

3. **Search should query the warehouse/index, not assemble organizations on demand.** Do not add runtime multi-connector assembly paths when `shouldUseOrganizationWarehouse()` is true. Import merges happen at ingest time.

4. **Generic capabilities belong in the warehouse only when they apply across sectors.** Examples: geography, verified external IDs, merge, classifications (as storage + filter semantics), diagnostics, coverage, search indexing.

5. **Sector-specific semantics belong inside connectors.** CMS grain, MA vs QHP, CIK vs FDA establishment id, market segment labels — map these in connector `warehouseMapping.ts` modules, not in warehouse core logic.

6. **Health plans are the first production connector, not the architecture.** Do not frame warehouse work as “health plan import” unless you are inside the health-plans connector.

7. **Manufacturers prove the connector model is cross-sector.** New sectors should follow the manufacturers pattern: connector mapping → generic fields → registry registration.

8. **Do not add health-plan-specific fields to the warehouse core** unless modeled as generic `classifications` or `sectorAttributes`. Avoid names like `healthPlanType` in new code; use connector-scoped classifications instead. (`healthPlanType` is deprecated compatibility only.)

9. **Prefer verified IDs for merge logic. Never merge organizations on name similarity alone.** Use `externalIds` and `mergeByVerifiedIds.ts`.

10. **Keep connector failures isolated and visible in diagnostics.** Per-connector backup/restore on import failure; surface `failed` / `warning` status in import results and `/warehouse/coverage`.

## Promotion rule

Move a capability from a connector into the generic warehouse layer **only after at least two connectors need it**. Until then, keep the behavior inside the connector. See `lib/import/warehouse/README.md` for examples and file layout.

## Quick reference

| Topic | Location |
|-------|----------|
| Warehouse README | `lib/import/warehouse/README.md` |
| Generic model types | `lib/organization/model.ts` |
| Layer 1 search semantics | `lib/import/warehouse/organizationCapabilities.ts` |
| Warehouse search | `lib/import/warehouse/discover.ts` |
| Connector registry | `lib/import/warehouse/connectors/registry.ts` |
| Health-plans mapping | `lib/import/healthPlans/warehouseMapping.ts` |
| Manufacturers mapping | `lib/import/manufacturers/warehouseMapping.ts` |
| Import orchestration | `lib/import/warehouse/import.ts` |
| Feature flag | `ORG_WAREHOUSE` — see `lib/import/warehouse/featureFlag.ts` |

