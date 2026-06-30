/**
 * Progressive search pipeline checks — merge, timeout, provider planning.
 */
import assert from "node:assert/strict";
import type { Prospect } from "../lib/search/types";
import { mergeProspectLists } from "../lib/search/mergeProspects";
import { withTimeout } from "../lib/search/withTimeout";
import { plannedPrimaryProviders, plannedSecondaryProviders } from "../lib/search/providerPlan";
import { planSources } from "../lib/search/sourcePlanner";
import { parseIntent } from "../lib/search/intentParser";

function prospect(id: string, score: number, signals = 1): Prospect {
  return {
    id,
    name: id,
    location: "Test",
    region: "midwest",
    buyerType: "Health Plans",
    buyerPack: "health-plans",
    score,
    scoreBreakdown: { total: score, factors: [] },
    whyItMatters: [],
    signals: Array.from({ length: signals }, (_, i) => ({
      id: `sig-${i}`,
      label: "Signal",
      type: "growth" as const,
      strength: "moderate" as const,
      strengthScore: 0.6,
      source: "CMS" as const,
      evidenceText: "evidence",
      whyNow: "now",
      suggestedAction: "act",
      freshnessDays: 5,
      urgency: 0.5,
    })),
    whyNow: "why",
    sourceTrail: [],
    outreachAngle: "outreach",
    contactRoles: [],
    matchReasons: [],
    sourceRecords: [],
  };
}

console.log("Running provider phase checks…\n");

// mergeProspectLists
{
  const a = [prospect("org-a", 60, 1)];
  const b = [prospect("org-a", 85, 3)];
  const merged = mergeProspectLists(a, b);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].score, 85);
  assert.equal(merged[0].signals.length, 3);
  console.log("  ok mergeProspectLists keeps higher-scoring duplicate id");
}

{
  const merged = mergeProspectLists(
    [prospect("low", 40), prospect("mid", 70)],
    [prospect("high", 90), prospect("mid", 55)],
  );
  assert.deepEqual(
    merged.map((p) => p.id),
    ["high", "mid", "low"],
  );
  assert.equal(merged.find((p) => p.id === "mid")!.score, 70);
  console.log("  ok mergeProspectLists unions distinct ids and sorts by score");
}

{
  const sameNameA = prospect("cms-qhp-1", 60);
  sameNameA.name = "Ambetter Health";
  const sameNameB = prospect("cms-qhp-2", 55);
  sameNameB.name = "Ambetter Health";
  const merged = mergeProspectLists([sameNameA], [sameNameB]);
  assert.equal(merged.length, 2, "distinct warehouse ids with same display name must not collapse");
  console.log("  ok mergeProspectLists preserves distinct ids for same display name");
}

// provider planning
{
  const query = parseIntent({
    sells: "",
    query: "regional health plans in Pennsylvania",
    targets: "regional health plans in Pennsylvania",
  });
  const plan = planSources(query);
  const primary = plannedPrimaryProviders(plan);
  assert.ok(primary.includes("cms"));
  assert.ok(primary.includes("sec"));
  assert.ok(primary.includes("rss"));
  assert.ok(plannedSecondaryProviders(plan).includes("public-web"));
  console.log("  ok plannedPrimaryProviders includes CMS for health-plans");
}

{
  const query = parseIntent({
    sells: "pharmacy supply chain risk analytics",
    query: "regional PBMs and health plans with drug supply recall exposure",
    targets: "regional PBMs and health plans with drug supply recall exposure",
  });
  const plan = planSources(query);
  const primary = plannedPrimaryProviders(plan);
  const secondary = plannedSecondaryProviders(plan);
  assert.ok(primary.includes("cms"));
  assert.ok(primary.includes("sec"));
  assert.ok(primary.includes("fda"));
  assert.ok(secondary.includes("public-web"));
  console.log("  ok health-plan/PBM intent routes CMS, SEC, contextual FDA, and Public Web");
}

{
  const query = parseIntent({
    sells: "",
    query: "manufacturers in Ohio",
    targets: "manufacturers in Ohio",
  });
  const plan = planSources(query);
  const primary = plannedPrimaryProviders(plan);
  assert.ok(primary.includes("sec"));
  assert.ok(primary.includes("fda"));
  assert.ok(!primary.includes("cms"));
  console.log("  ok manufacturing intent excludes CMS and includes SEC/FDA");
}

{
  const query = parseIntent({
    sells: "",
    query: "municipal employers",
    targets: "municipal employers",
    buyerPack: "public-sector",
  });
  const plan = planSources(query);
  const primary = plannedPrimaryProviders(plan);
  assert.ok(!primary.includes("cms"));
  assert.ok(!primary.includes("sec"));
  console.log("  ok plannedPrimaryProviders excludes CMS/SEC for public-sector");
}

async function warehouseCatalogBrowseChecks() {
  if (process.env.ORG_WAREHOUSE !== "1") return;

  const { importNationalHealthPlanCatalog } = await import(
    "../lib/import/healthPlans/cms/importCms.ts"
  );
  const { importNationalManufacturerCatalog } = await import(
    "../lib/import/manufacturers/importManufacturers.ts"
  );
  const { resetCatalogIndex } = await import(
    "../lib/discovery/catalog/catalogIndex.ts"
  );
  const { getCatalogNode, catalogNodeToSearchState } = await import(
    "../lib/catalog/index.ts"
  );
  const { searchStateToRawInput } = await import(
    "../lib/search/searchState.ts"
  );
  const { runSearchAsync } = await import("../lib/search/runSearch.ts");
  const { enrichWithLiveProviders } = await import(
    "../lib/search/providerPhase.ts"
  );
  const { planSources } = await import("../lib/search/sourcePlanner.ts");

  await importNationalHealthPlanCatalog();
  importNationalManufacturerCatalog();
  resetCatalogIndex();

  const raw = searchStateToRawInput(
    catalogNodeToSearchState(getCatalogNode("aca-marketplace-plans")!),
  );
  const base = await runSearchAsync(raw);
  const enriched = await enrichWithLiveProviders(base, planSources(base.query));

  assert.equal(
    enriched.prospects.length,
    base.prospects.length,
    `catalog-only ACA browse must not drop warehouse rows (${base.prospects.length} → ${enriched.prospects.length})`,
  );
  assert.equal(
    enriched.discovery?.totalReturned,
    enriched.prospects.length,
    "discovery.totalReturned must match rendered prospect count after provider phase",
  );
  assert.ok(
    base.prospects.length >= 100,
    `expected full ACA warehouse population, got ${base.prospects.length}`,
  );
  console.log(
    `  ok catalog-only ACA browse preserves ${enriched.prospects.length} warehouse rows through provider phase`,
  );
}

async function timeoutChecks() {
  await assert.rejects(
    () =>
      withTimeout(
        new Promise<string>((resolve) => {
          setTimeout(() => resolve("late"), 200);
        }),
        50,
        "test-provider",
      ),
    /test-provider timed out/,
  );
  console.log("  ok withTimeout rejects when promise exceeds limit");

  const value = await withTimeout(Promise.resolve(42), 500, "fast");
  assert.equal(value, 42);
  console.log("  ok withTimeout resolves fast promises");
}

timeoutChecks()
  .then(() => warehouseCatalogBrowseChecks())
  .then(() => {
    console.log("\nAll provider phase checks passed.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
