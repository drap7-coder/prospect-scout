/**
 * Multi-dimensional browse row checks.
 * Run: npm run test:browse-rows
 */
import assert from "node:assert/strict";
import { buildBrowseRows } from "../lib/browse/buildBrowseRows.ts";
import { buildBrowseContext, resolveBrowseLenses } from "../lib/browse/connectors/registry.ts";
import type { Prospect } from "../lib/search/types.ts";
import { resolveSearchState } from "../lib/search/searchState.ts";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

let seq = 0;
function healthPlan(
  name: string,
  opts: Partial<Prospect> = {},
): Prospect {
  seq += 1;
  return {
    id: `p-${seq}`,
    name,
    location: "Columbus, OH",
    stateCode: "OH",
    stateCodes: ["OH"],
    region: "midwest",
    buyerType: "Health Plan",
    buyerPack: "health-plans",
    score: 80 - seq,
    scoreBreakdown: { total: 80 - seq, factors: [] },
    whyItMatters: ["Strong MA footprint in Ohio"],
    signals: [],
    whyNow: "",
    sourceTrail: [],
    outreachAngle: "",
    contactRoles: [],
    matchReasons: [],
    sourceRecords: [],
    classifications: opts.classifications,
    geographyNational: opts.geographyNational,
    coveredLives: opts.coveredLives,
    ...opts,
  };
}

const searchState = resolveSearchState({ query: "health plans" });

console.log("Browse rows checks:\n");

check("resolveBrowseLenses exposes category as default for health plans", () => {
  const prospects = [
    healthPlan("Alpha MA", {
      classifications: [{ namespace: "health-plans", id: "medicare_advantage", label: "Medicare Advantage" }],
    }),
  ];
  const ctx = buildBrowseContext(prospects, searchState);
  const lenses = resolveBrowseLenses(ctx, prospects);
  assert.ok(lenses.some((l) => l.id === "category"));
  assert.ok(lenses.some((l) => l.id === "alphabet"));
});

check("buildBrowseRows category groups by LOB classification", () => {
  const prospects = [
    healthPlan("Alpha MA", {
      classifications: [{ namespace: "health-plans", id: "medicare_advantage", label: "Medicare Advantage" }],
    }),
    healthPlan("Beta MA", {
      classifications: [{ namespace: "health-plans", id: "medicare_advantage", label: "Medicare Advantage" }],
    }),
    healthPlan("Gamma Medicaid", {
      classifications: [{ namespace: "health-plans", id: "medicaid_mco", label: "Medicaid Managed Care" }],
    }),
  ];
  const ctx = buildBrowseContext(prospects, searchState);
  const rows = buildBrowseRows("category", prospects, ctx);
  const ma = rows.find((r) => r.id === "hp-medicare_advantage");
  assert.ok(ma, "expected Medicare Advantage row");
  assert.equal(ma!.totalCount, 2);
  assert.ok(ma!.summaryMetrics?.some((m) => m.label === "Organizations"));
});

check("buildBrowseRows geography includes state rows", () => {
  const prospects = [
    healthPlan("Ohio Plan", { stateCodes: ["OH"] }),
    healthPlan("Ohio Two", { stateCodes: ["OH"] }),
    healthPlan("Texas Plan", { stateCodes: ["TX"] }),
  ];
  const ctx = buildBrowseContext(prospects, searchState);
  const rows = buildBrowseRows("geography", prospects, ctx);
  const ohio = rows.find((r) => r.id === "geo-state-OH");
  assert.ok(ohio, "expected Ohio geography row");
  assert.equal(ohio!.totalCount, 2);
});

check("buildBrowseRows opportunity surfaces high-scoring orgs", () => {
  const prospects = [
    healthPlan("High Score", { score: 95 }),
    healthPlan("Low Score", { score: 40 }),
  ];
  const ctx = buildBrowseContext(prospects, searchState);
  const rows = buildBrowseRows("opportunity", prospects, ctx);
  const high = rows.find((r) => r.id === "opp-high");
  assert.ok(high, "expected high opportunity row");
  assert.ok(high!.prospects.some((p) => p.name === "High Score"));
});

check("buildBrowseRows alphabet preserves all prospects", () => {
  const prospects = [
    healthPlan("Alpha"),
    healthPlan("Beta"),
    healthPlan("Zeta"),
  ];
  const ctx = buildBrowseContext(prospects, searchState);
  const rows = buildBrowseRows("alphabet", prospects, ctx);
  const total = rows.reduce((sum, row) => sum + row.prospects.length, 0);
  assert.equal(total, prospects.length);
});

console.log(`\n${passed} browse rows checks passed.`);
