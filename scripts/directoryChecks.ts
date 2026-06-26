/**
 * Master Organization Directory checks — no test framework required.
 *
 * Run with:  npm run test:directory
 */
import assert from "node:assert/strict";
import {
  HEALTH_PLANS_DIRECTORY,
  getHealthPlanByNameOrAlias,
} from "../lib/directories/healthPlans.ts";
import {
  MANUFACTURERS_DIRECTORY,
  OHIO_MANUFACTURERS,
} from "../lib/directories/manufacturers.ts";
import {
  resolveOrganization,
  searchDirectory,
} from "../lib/directories/search.ts";
import { runSearch } from "../lib/search/runSearch.ts";
import { TAXONOMY_SECTORS } from "../lib/taxonomy/sectors.ts";
import { TAXONOMY_INDUSTRIES } from "../lib/taxonomy/industries.ts";
import { countProspectsForFilter } from "../lib/search/resultsFilters.ts";
import { EMPTY_SEARCH_STATE } from "../lib/search/searchState.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const PA_CURATED = [
  "Independence Blue Cross",
  "Highmark",
  "Capital Blue Cross",
  "Geisinger Health Plan",
  "UPMC Health Plan",
  "AmeriHealth Caritas Pennsylvania",
  "Health Partners Plans",
  "Keystone First",
  "Pennsylvania Health & Wellness",
  "UPMC for Life",
  "Geisinger Gold",
];

const MIDWEST_BLUES = [
  "Blue Cross Blue Shield of Michigan",
  "Blue Cross Blue Shield of Illinois",
  "Blue Cross Blue Shield of Minnesota",
  "Anthem Blue Cross Blue Shield Wisconsin",
  "Anthem Blue Cross Blue Shield Ohio",
];

console.log("Master Organization Directory checks\n");

check("Ohio manufacturers directory has at least 25 curated records", () => {
  assert.ok(
    OHIO_MANUFACTURERS.length >= 25,
    `expected >= 25 Ohio manufacturers, got ${OHIO_MANUFACTURERS.length}`,
  );
});

check("manufacturers in Ohio returns at least 20 curated directory matches", () => {
  const matches = searchDirectory({
    query: "manufacturers in Ohio",
    buyerPack: "manufacturers",
  });
  const ohioMatches = matches.filter((m) => m.record.statesServed.includes("OH"));
  assert.ok(
    ohioMatches.length >= 20,
    `expected >= 20 Ohio manufacturer matches, got ${ohioMatches.length}`,
  );
});

check("food manufacturers in Ohio returns food/beverage subset", () => {
  const matches = searchDirectory({
    query: "food manufacturers in Ohio",
    buyerPack: "manufacturers",
  });
  assert.ok(matches.length >= 4, `expected food subset, got ${matches.length}`);
  for (const m of matches) {
    assert.equal(
      m.record.industryId,
      "food-beverage",
      `${m.record.name} should be food-beverage`,
    );
  }
});

check("packaging manufacturers in Ohio returns packaging subset", () => {
  const matches = searchDirectory({
    query: "packaging manufacturers in Ohio",
    buyerPack: "manufacturers",
  });
  assert.ok(matches.length >= 2, `expected packaging subset, got ${matches.length}`);
  for (const m of matches) {
    assert.equal(m.record.industryId, "packaging", `${m.record.name} should be packaging`);
  }
});

check("medical device manufacturers in Ohio returns device subset", () => {
  const matches = searchDirectory({
    query: "medical device manufacturers in Ohio",
    buyerPack: "manufacturers",
  });
  assert.ok(matches.length >= 3, `expected device subset, got ${matches.length}`);
  for (const m of matches) {
    assert.ok(
      m.record.organizationTypeId === "medical-device" ||
        m.record.industryId === "medical-device-manufacturing",
      `${m.record.name} should be medical device`,
    );
  }
});

check("runSearch manufacturers in Ohio uses directory not mock fallback", () => {
  const response = runSearch({
    targets: "manufacturers in Ohio",
    sells: "",
  });
  const directoryNames = response.prospects
    .filter((p) => p.directoryMatch)
    .map((p) => p.name);
  assert.ok(
    directoryNames.length >= 20,
    `runSearch should return >= 20 directory matches, got ${directoryNames.length}`,
  );
  assert.ok(
    !response.prospects.some((p) => p.name.includes("Mock")),
    "should not fall back to mock when directory has matches",
  );
});

check("health plans directory has minimum national coverage", () => {
  const names = new Set(HEALTH_PLANS_DIRECTORY.map((r) => r.name));
  for (const name of [
    "UnitedHealthcare",
    "Aetna",
    "Cigna Healthcare",
    "Humana",
    "Elevance Health",
    "Kaiser Permanente",
    "Centene",
    "Molina Healthcare",
  ]) {
    assert.ok(names.has(name), `missing national plan: ${name}`);
  }
});

check("Pennsylvania health plans returns complete curated list", () => {
  const matches = searchDirectory({
    query: "Pennsylvania health plans",
    buyerPack: "health-plans",
  });
  const names = matches.map((m) => m.record.name);

  for (const expected of PA_CURATED) {
    assert.ok(
      names.includes(expected),
      `missing PA plan: ${expected} (got ${names.length} total)`,
    );
  }

  assert.ok(
    names.length >= PA_CURATED.length,
    `expected at least ${PA_CURATED.length} PA plans, got ${names.length}`,
  );
});

check("Midwest Blues returns expected organizations", () => {
  const matches = searchDirectory({
    query: "Midwest Blues",
    buyerPack: "health-plans",
  });
  const names = matches.map((m) => m.record.name);

  for (const expected of MIDWEST_BLUES) {
    assert.ok(names.includes(expected), `missing midwest blues plan: ${expected}`);
  }
});

check("UPMC resolves correctly", () => {
  const record = resolveOrganization("UPMC", "health-plans");
  assert.ok(record, "UPMC should resolve");
  assert.match(record!.name, /UPMC/i);
  assert.equal(record!.organizationType, "health-plan");
});

check("directory-only prospects appear with lower confidence and Directory provenance", () => {
  const response = runSearch({
    targets: "manufacturers in Ohio",
    sells: "",
  });
  const directoryOnly = response.prospects.filter(
    (p) => p.signals.length === 0 && p.directoryMatch,
  );
  assert.ok(directoryOnly.length > 0, "expected directory-only prospects");
  for (const p of directoryOnly.slice(0, 5)) {
    assert.ok(p.score <= 55, `${p.name} score ${p.score} should reflect lower confidence`);
    assert.ok(
      p.sourceTrail.some(
        (t) => t.source === "Directory" || /master directory/i.test(t.evidenceText),
      ),
      `${p.name} should show directory provenance`,
    );
  }
});

check("filters render from taxonomy even when result set is small", () => {
  const response = runSearch({
    targets: "food manufacturers in Ohio",
    sells: "",
  });
  assert.ok(response.prospects.length > 0 && response.prospects.length < 15);
  assert.ok(TAXONOMY_SECTORS.length >= 10);
  assert.ok(TAXONOMY_INDUSTRIES.length >= 30);
  const manufacturingCount = countProspectsForFilter(
    response.prospects,
    EMPTY_SEARCH_STATE,
    { sector: "manufacturing", industry: null, organizationType: null },
  );
  assert.ok(manufacturingCount >= 0);
});

check("alias resolution: ibx -> Independence Blue Cross", () => {
  const record = getHealthPlanByNameOrAlias("ibx");
  assert.ok(record);
  assert.equal(record!.name, "Independence Blue Cross");
});

check("total manufacturers directory includes Ohio coverage", () => {
  assert.ok(
    MANUFACTURERS_DIRECTORY.length >= OHIO_MANUFACTURERS.length + 3,
    "manufacturers directory should include national seeds plus Ohio",
  );
});

console.log(`\n${passed} checks passed.`);
