/**
 * Industry catalog registry, routing, and warehouse regression checks.
 * Run: npm run test:catalog
 * Warehouse routing: ORG_WAREHOUSE=1 npm run test:catalog
 */
import assert from "node:assert/strict";
import {
  INDUSTRY_CATALOG,
  getCatalogNode,
  topLevelCatalogNodes,
} from "../lib/catalog/registry.ts";
import {
  aggregateSectorCoverage,
  intentUsesWarehouse,
  resolveCatalogNodeForIntent,
} from "../lib/catalog/routing.ts";
import {
  catalogNodeIsSearchable,
  catalogNodeToSearchState,
} from "../lib/catalog/launch.ts";
import {
  resolveDiscoveryRouteMode,
  searchIsExecutable,
  shouldUseWarehouseForCatalogNode,
} from "../lib/catalog/normalize.ts";
import {
  resolveSearchState,
  searchStateToRawInput,
} from "../lib/search/searchState.ts";
import { parseSearchIntent } from "../lib/discovery/intent.ts";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Industry catalog checks:\n");

check("top-level catalog has 18 industries", () => {
  assert.equal(topLevelCatalogNodes().length, 18);
});

check("healthcare drill-down includes health plans", () => {
  const hp = getCatalogNode("health-plans");
  assert.ok(hp);
  assert.equal(hp!.coverage, "warehouse");
  assert.equal(hp!.organizationTypeId, "health-plan");
});

check("manufacturing sector aggregates warehouse coverage", () => {
  const mfg = getCatalogNode("manufacturing");
  assert.ok(mfg);
  assert.equal(aggregateSectorCoverage(mfg!), "warehouse");
});

check("higher education uses live discovery", () => {
  const he = getCatalogNode("higher-education");
  assert.ok(he);
  assert.equal(he!.coverage, "live-discovery");
});

check("shouldUseWarehouseForCatalogNode for health plans", () => {
  assert.equal(shouldUseWarehouseForCatalogNode("health-plans"), true);
  assert.equal(shouldUseWarehouseForCatalogNode("universities"), false);
});

check("intentUsesWarehouse for health plans via catalog id", () => {
  assert.equal(
    intentUsesWarehouse(
      {
        sectorId: null,
        industryId: null,
        organizationTypeId: null,
        classificationFilter: null,
      },
      "health-plans",
    ),
    true,
  );
});

check("intentUsesWarehouse for health plans via taxonomy", () => {
  assert.equal(
    intentUsesWarehouse({
      sectorId: "healthcare",
      industryId: "payers",
      organizationTypeId: "health-plan",
      classificationFilter: null,
    }),
    true,
  );
});

check("intentUsesWarehouse false for universities", () => {
  assert.equal(
    intentUsesWarehouse({
      sectorId: "education",
      industryId: "universities",
      organizationTypeId: "university",
      classificationFilter: null,
    }),
    false,
  );
});

check("resolveDiscoveryRouteMode routes health plans to warehouse", () => {
  assert.equal(
    resolveDiscoveryRouteMode({
      catalogNodeId: "health-plans",
      intent: {
        sectorId: "healthcare",
        industryId: "payers",
        organizationTypeId: "health-plan",
        classificationFilter: null,
      },
    }),
    "warehouse",
  );
});

check("resolveDiscoveryRouteMode routes manufacturers to warehouse", () => {
  assert.equal(
    resolveDiscoveryRouteMode({
      catalogNodeId: "manufacturing",
      intent: {
        sectorId: "manufacturing",
        industryId: null,
        organizationTypeId: null,
        classificationFilter: null,
      },
    }),
    "warehouse",
  );
});

check("resolveDiscoveryRouteMode routes universities to live discovery", () => {
  assert.equal(
    resolveDiscoveryRouteMode({
      catalogNodeId: "universities",
      intent: {
        sectorId: "education",
        industryId: "universities",
        organizationTypeId: "university",
        classificationFilter: null,
      },
    }),
    "live-discovery",
  );
});

check("catalogNodeToSearchState hydrates warehouse intent fields", () => {
  const state = catalogNodeToSearchState(getCatalogNode("health-plans")!);
  assert.equal(state.catalogNodeId, "health-plans");
  assert.equal(state.sector, "healthcare");
  assert.equal(state.industry, "payers");
  assert.equal(state.organizationType, "health-plan");
});

check("catalog launch works with empty query when catalog id is set", () => {
  const state = resolveSearchState({
    query: "",
    sector: null,
    industry: null,
    organizationType: null,
    location: null,
    companySize: null,
    signals: [],
    sources: [],
    freshness: null,
    sellerContext: null,
    ownership: null,
    state: null,
    classificationNamespace: null,
    classificationId: null,
    metro: null,
    operatingStates: [],
    sort: null,
    catalogNodeId: "health-plans",
  });
  assert.equal(state.organizationType, "health-plan");
  assert.equal(state.sector, "healthcare");
  assert.ok(searchIsExecutable(state));
  assert.ok(state.query.length > 0 || state.organizationType === "health-plan");
});

check("searchStateToRawInput preserves catalog warehouse fields", () => {
  const raw = searchStateToRawInput(catalogNodeToSearchState(getCatalogNode("health-plans")!));
  assert.equal(raw.organizationTypeId, "health-plan");
  assert.equal(raw.sectorId, "healthcare");
  assert.equal(raw.industryId, "payers");
  assert.equal(raw.catalogNodeId, "health-plans");
  assert.equal(raw.buyerPack, "health-plans");
});

check("planned nodes without taxonomy are not searchable", () => {
  const streaming = getCatalogNode("streaming");
  assert.ok(streaming);
  assert.equal(catalogNodeIsSearchable(streaming!), false);
  assert.equal(
    resolveDiscoveryRouteMode({
      catalogNodeId: "streaming",
      intent: {
        sectorId: null,
        industryId: null,
        organizationTypeId: null,
        classificationFilter: null,
      },
    }),
    "planned",
  );
});

check("every top-level node has description and label", () => {
  for (const node of INDUSTRY_CATALOG) {
    assert.ok(node.description.length > 0, node.id);
    assert.ok(node.label.length > 0, node.id);
  }
});

check("resolveCatalogNodeForIntent prefers org type", () => {
  const node = resolveCatalogNodeForIntent({
    sectorId: "healthcare",
    industryId: "payers",
    organizationTypeId: "health-plan",
  });
  assert.ok(node);
  assert.equal(node!.organizationTypeId, "health-plan");
});

if (process.env.ORG_WAREHOUSE === "1") {
  console.log("\nWarehouse catalog routing checks:\n");
  const { importNationalHealthPlanCatalog } = await import(
    "../lib/import/healthPlans/cms/importCms.ts"
  );
  const { importNationalManufacturerCatalog } = await import(
    "../lib/import/manufacturers/importManufacturers.ts"
  );
  const { resetCatalogIndex } = await import(
    "../lib/discovery/catalog/catalogIndex.ts"
  );
  const { discoverOrganizationsStaged } = await import(
    "../lib/discovery/discoveryEngine.ts"
  );
  const { runSearch } = await import("../lib/search/runSearch.ts");
  const { getHealthPlanIndexSize } = await import(
    "../lib/import/healthPlans/memoryIndex.ts"
  );

  await importNationalHealthPlanCatalog();
  importNationalManufacturerCatalog();
  resetCatalogIndex();

  const hpState = catalogNodeToSearchState(getCatalogNode("health-plans")!);
  const hpRaw = searchStateToRawInput(hpState);
  const hpIntent = parseSearchIntent(hpRaw.query ?? "", {
    sectorId: hpRaw.sectorId,
    industryId: hpRaw.industryId,
    organizationTypeId: hpRaw.organizationTypeId,
  });

  check("catalog health plans staged discovery uses warehouse", () => {
    const staged = discoverOrganizationsStaged(hpRaw.query ?? "", {
      sectorId: hpRaw.sectorId,
      industryId: hpRaw.industryId,
      organizationTypeId: hpRaw.organizationTypeId,
      catalogNodeId: "health-plans",
      maxResults: 5000,
    });
    assert.equal(staged.metadata.stagesRun[0], "organization-warehouse");
    assert.ok(staged.totalReturned > 0);
    const warehouseHp = getHealthPlanIndexSize();
    assert.ok(
      staged.totalReturned >= warehouseHp * 0.95,
      `expected ~${warehouseHp} health plans, got ${staged.totalReturned}`,
    );
  });

  check("catalog health plans runSearch returns warehouse results", () => {
    const search = runSearch(hpRaw);
    assert.ok(search.prospects.length > 0);
    assert.ok(
      search.discovery?.metadata?.stagesRun?.includes("organization-warehouse"),
    );
  });

  check("catalog-only health plans (no query text) still searches warehouse", () => {
    const catalogOnly = searchStateToRawInput(
      resolveSearchState({
        ...hpState,
        query: "",
      }),
    );
    assert.equal(catalogOnly.catalogNodeId, "health-plans");
    const search = runSearch(catalogOnly);
    assert.ok(search.prospects.length > 0);
    assert.ok(
      search.discovery?.metadata?.stagesRun?.includes("organization-warehouse"),
    );
  });

  check("universities catalog routes to live discovery not warehouse", () => {
    const uniRaw = searchStateToRawInput(
      catalogNodeToSearchState(getCatalogNode("universities")!),
    );
    const uniIntent = parseSearchIntent(uniRaw.query ?? "", {
      sectorId: uniRaw.sectorId,
      industryId: uniRaw.industryId,
      organizationTypeId: uniRaw.organizationTypeId,
    });
    const staged = discoverOrganizationsStaged(uniRaw.query ?? "", {
      sectorId: uniRaw.sectorId,
      industryId: uniRaw.industryId,
      organizationTypeId: uniRaw.organizationTypeId,
      catalogNodeId: "universities",
      maxResults: 500,
    });
    assert.ok(!staged.metadata.stagesRun.includes("organization-warehouse"));
    assert.equal(
      resolveDiscoveryRouteMode({
        catalogNodeId: "universities",
        intent: uniIntent,
      }),
      "live-discovery",
    );
  });
}

console.log(`\n${passed} industry catalog checks passed.`);
