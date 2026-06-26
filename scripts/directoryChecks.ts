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
  resolveOrganization,
  searchDirectory,
} from "../lib/directories/search.ts";
import { runSearch } from "../lib/search/runSearch.ts";

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

check("Capital Blue Cross resolves correctly", () => {
  const record = resolveOrganization("Capital Blue Cross", "health-plans");
  assert.ok(record);
  assert.equal(record!.name, "Capital Blue Cross");
  assert.equal(record!.id, "dir-hp-capital-bc");
});

check("Highmark resolves correctly", () => {
  const record = resolveOrganization("Highmark", "health-plans");
  assert.ok(record);
  assert.equal(record!.name, "Highmark");
  assert.ok(record!.aliases.some((a) => a.includes("bcbs")));
});

check("runSearch uses directory for Pennsylvania health plans query", () => {
  const response = runSearch({
    targets: "Pennsylvania health plans",
    sells: "PBM consulting",
  });
  const names = response.prospects.map((p) => p.name);
  for (const expected of PA_CURATED) {
    assert.ok(names.includes(expected), `runSearch missing: ${expected}`);
  }
});

check("directory-only prospects appear with lower confidence than signal-rich mock fallback", () => {
  const response = runSearch({
    targets: "Pennsylvania health plans",
    sells: "PBM consulting",
  });
  const directoryOnly = response.prospects.filter((p) => p.signals.length === 0);
  assert.ok(directoryOnly.length > 0, "expected directory-only prospects");
  for (const p of directoryOnly) {
    assert.ok(p.score <= 55, `${p.name} score ${p.score} should reflect lower confidence`);
    assert.ok(
      p.sourceTrail.some((t) => t.evidenceText.includes("Master directory")),
      `${p.name} should show directory provenance`,
    );
  }
});

check("alias resolution: ibx -> Independence Blue Cross", () => {
  const record = getHealthPlanByNameOrAlias("ibx");
  assert.ok(record);
  assert.equal(record!.name, "Independence Blue Cross");
});

console.log(`\n${passed} checks passed.`);
