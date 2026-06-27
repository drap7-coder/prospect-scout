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
  .then(() => {
    console.log("\nAll provider phase checks passed.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
