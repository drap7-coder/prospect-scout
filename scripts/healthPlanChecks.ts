/**
 * Health plan bootstrap seed import checks.
 * Run: npm run test:health-plans
 */
import assert from "node:assert/strict";
import { HEALTH_PLANS_DIRECTORY } from "../lib/directories/healthPlans.ts";
import {
  clearHealthPlanIndex,
  externalIdsForSeedRow,
  getHealthPlanIndexSize,
  getHealthPlanOrganizations,
  importHealthPlanSeed,
  parseHealthPlanSeed,
  shouldUsePersistentHealthPlanCatalog,
} from "../lib/import/healthPlans/index.ts";
import { organizationsFromDirectory } from "../lib/discovery/organization.ts";
import { resetCatalogIndex, getCatalogOrganizations } from "../lib/discovery/catalog/catalogIndex.ts";
import { initDiscoveryEngine } from "../lib/discovery/discoveryEngine.ts";
import { isDatabaseConfigured } from "../lib/db/index.ts";
import {
  HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID,
  HEALTH_PLAN_BOOTSTRAP_SOURCE_NAME,
} from "../lib/import/healthPlans/types.ts";
import {
  CMS_CPSC_CONNECTOR_ID,
  CMS_MEDICAID_MCO_CONNECTOR_ID,
  CMS_QHP_CONNECTOR_ID,
  findDuplicateContractAssignments,
  getMergedHealthPlanCatalogEntries,
  importHealthPlanFullCatalog,
} from "../lib/import/healthPlans/cms/index.ts";

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result instanceof Promise) {
    await result;
  }
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Health plan bootstrap seed checks:\n");

await check("parseHealthPlanSeed returns 24 curated records", () => {
  clearHealthPlanIndex();
  const rows = parseHealthPlanSeed();
  assert.equal(rows.length, 24);
  assert.equal(rows.length, HEALTH_PLANS_DIRECTORY.length);
});

await check("CMS contract IDs are mapped to external id candidates", () => {
  const rows = parseHealthPlanSeed();
  const withContracts = rows.filter((row) => row.cmsContracts.length > 0);
  assert.ok(withContracts.length >= 13, "expected CMS contracts on seed rows");
  for (const row of withContracts) {
    const ids = externalIdsForSeedRow(row);
    assert.ok(
      ids.some((id) => id.idType === "cms_contract"),
      `expected cms_contract ids for ${row.name}`,
    );
  }
});

await check("seed import populates memory index with 24 organizations", async () => {
  clearHealthPlanIndex();
  const stats = await importHealthPlanSeed();
  assert.equal(stats.rowsParsed, 24);
  assert.equal(getHealthPlanIndexSize(), 24);
});

await check("re-running seed import remains idempotent in memory index", async () => {
  const before = getHealthPlanIndexSize();
  const stats = await importHealthPlanSeed();
  assert.equal(stats.rowsParsed, 24);
  assert.equal(getHealthPlanIndexSize(), before);
  assert.equal(getHealthPlanIndexSize(), 24);
});

await check("all 24 curated health plan names are present in index", () => {
  const indexed = getHealthPlanOrganizations();
  const names = new Set(indexed.map((org) => org.canonicalName));
  for (const record of HEALTH_PLANS_DIRECTORY) {
    assert.ok(names.has(record.name), `missing ${record.name}`);
  }
});

await check("each imported org has bootstrap-seed source provenance", () => {
  const indexed = getHealthPlanOrganizations();
  assert.equal(indexed.length, 24);
  for (const org of indexed) {
    assert.equal(org.buyerPack, "health-plans");
    assert.equal(org.canonicalOrganizationType, "health-plan");
    const source = org.sources.find(
      (s) => s.connector === HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID,
    );
    assert.ok(source, `missing bootstrap source for ${org.canonicalName}`);
    assert.equal(source.sourceName, HEALTH_PLAN_BOOTSTRAP_SOURCE_NAME);
  }
});

await check("seed metadata tags include line-of-business flags", () => {
  const uhc = getHealthPlanOrganizations().find((org) =>
    /UnitedHealthcare/i.test(org.canonicalName),
  );
  assert.ok(uhc);
  assert.ok(uhc.tags?.includes("commercial"));
  assert.ok(uhc.tags?.includes("medicare"));
});

await check("import uses memory index without live CMS fetch", () => {
  assert.equal(getHealthPlanIndexSize(), 24);
  if (isDatabaseConfigured()) {
    console.log("    (Neon configured — seed import also persisted to DATABASE_URL)");
  } else {
    console.log("    (No DATABASE_URL — memory index only, no Neon persistence)");
  }
});

await check("feature flag off keeps healthPlans.ts directory sources", () => {
  delete process.env.HEALTH_PLAN_PERSISTENT_SOURCE;
  clearHealthPlanIndex();
  resetCatalogIndex();
  assert.equal(shouldUsePersistentHealthPlanCatalog(), false);

  const healthPlans = organizationsFromDirectory().filter(
    (org) => org.buyerPack === "health-plans",
  );
  assert.equal(healthPlans.length, 24);
  assert.ok(
    healthPlans.every((org) =>
      org.sources.some((source) => source.connector === "directory"),
    ),
  );
});

await check("feature flag on serves 24 health plans from persistent index", async () => {
  process.env.HEALTH_PLAN_PERSISTENT_SOURCE = "1";
  clearHealthPlanIndex();
  resetCatalogIndex();
  await importHealthPlanSeed();
  assert.equal(shouldUsePersistentHealthPlanCatalog(), true);

  initDiscoveryEngine();
  resetCatalogIndex();
  const healthPlans = organizationsFromDirectory().filter(
    (org) => org.buyerPack === "health-plans",
  );
  assert.equal(healthPlans.length, 24);
  assert.ok(
    healthPlans.every((org) =>
      org.sources.some((source) => source.connector === "bootstrap-seed"),
    ),
  );

  const catalog = getCatalogOrganizations();
  const bootstrapSourceIds = new Set<string>();
  for (const org of catalog) {
    for (const source of org.sources) {
      if (source.connector === HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID) {
        bootstrapSourceIds.add(source.sourceId);
      }
    }
  }
  assert.equal(bootstrapSourceIds.size, 24);
  for (const row of parseHealthPlanSeed()) {
    assert.ok(
      catalog.some(
        (org) =>
          org.canonicalName === row.name || org.aliases.includes(row.name),
      ),
      `catalog missing health plan ${row.name}`,
    );
  }

  delete process.env.HEALTH_PLAN_PERSISTENT_SOURCE;
  clearHealthPlanIndex();
  resetCatalogIndex();
});

console.log("\nHealth plan CMS catalog expansion checks:\n");

await check("default seed path still returns 24 curated plans", () => {
  assert.equal(parseHealthPlanSeed().length, 24);
  assert.equal(HEALTH_PLANS_DIRECTORY.length, 24);
});

await check("full CMS import expands catalog beyond 24 organizations", async () => {
  clearHealthPlanIndex();
  const stats = await importHealthPlanFullCatalog();
  assert.equal(stats.seed.rowsParsed, 24);
  assert.ok(stats.totalIndexSize > 24, "expected expanded catalog");
  assert.ok(stats.cms.organizationsMerged > 0, "expected CMS merges into seed");
  assert.equal(getHealthPlanIndexSize(), stats.totalIndexSize);
});

await check("expanded catalog includes non-PA regional health plans", async () => {
  const orgs = getHealthPlanOrganizations();
  const nonPaRegional = orgs.filter(
    (org) =>
      org.buyerPack === "health-plans" &&
      org.states.some((state) => state !== "PA") &&
      org.sources.some((source) => source.connector.startsWith("cms-")),
  );
  assert.ok(
    nonPaRegional.length >= 5,
    `expected several non-PA CMS-backed plans, got ${nonPaRegional.length}`,
  );
  const stateCoverage = new Set(orgs.flatMap((org) => org.states));
  assert.ok(stateCoverage.has("TX"));
  assert.ok(stateCoverage.has("CA"));
  assert.ok(stateCoverage.has("FL"));
  assert.ok(!Array.from(stateCoverage).every((state) => state === "PA"));
});

await check("imported CMS records retain source provenance", () => {
  const orgs = getHealthPlanOrganizations();
  const cmsBacked = orgs.filter((org) =>
    org.sources.some((source) => source.connector.startsWith("cms-")),
  );
  assert.ok(cmsBacked.length > 0);
  for (const org of cmsBacked) {
    const cmsSource = org.sources.find((source) =>
      [CMS_CPSC_CONNECTOR_ID, CMS_QHP_CONNECTOR_ID, CMS_MEDICAID_MCO_CONNECTOR_ID].includes(
        source.connector,
      ),
    );
    assert.ok(cmsSource, `missing CMS provenance on ${org.canonicalName}`);
    assert.ok(cmsSource.sourceName);
    assert.ok(cmsSource.sourceUrl);
  }
});

await check("bootstrap seed provenance survives CMS catalog merge", () => {
  const seeded = getHealthPlanOrganizations().filter((org) =>
    org.sources.some((source) => source.connector === HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID),
  );
  assert.equal(seeded.length, 24);
  for (const org of seeded) {
    assert.equal(org.buyerPack, "health-plans");
  }
});

await check("duplicate CMS contract ids are not assigned to separate orgs", () => {
  const entries = getMergedHealthPlanCatalogEntries();
  const duplicates = findDuplicateContractAssignments(entries);
  assert.equal(duplicates.length, 0, duplicates.join("; "));
});

console.log(`\nAll ${passed} health plan checks passed.`);
