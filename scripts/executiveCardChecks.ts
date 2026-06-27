/**
 * Executive Intelligence Card synthesis checks.
 * Run: npm run test:exec
 *
 * Focus: adaptive rendering by organization kind and the strict rule that
 * employees and covered lives are never confused.
 */
import assert from "node:assert/strict";
import {
  resolveOrgKind,
  synthesizeExecutiveCard,
} from "../lib/intelligence/executiveCard.ts";
import type { Prospect } from "../lib/search/types.ts";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function baseProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: "exec-1",
    name: "Acme Org",
    buyerType: "Organization",
    location: "Columbus, OH",
    region: "midwest",
    buyerPack: "employers",
    stateCode: "OH",
    score: 80,
    scoreBreakdown: { total: 80, factors: [] },
    signals: [],
    whyItMatters: [],
    whyNow: "",
    sourceTrail: [],
    outreachAngle: "",
    contactRoles: [],
    matchReasons: [],
    description: "",
    sourceRecords: [],
    ...overrides,
  };
}

console.log("Executive Intelligence Card checks:\n");

check("resolveOrgKind classifies by canonical type", () => {
  assert.equal(
    resolveOrgKind(baseProspect({ canonicalOrganizationTypeId: "health-plan" })),
    "health-plan",
  );
  assert.equal(
    resolveOrgKind(baseProspect({ canonicalOrganizationTypeId: "manufacturer" })),
    "manufacturer",
  );
  assert.equal(
    resolveOrgKind(baseProspect({ canonicalOrganizationTypeId: "hospital-health-system" })),
    "hospital",
  );
  assert.equal(
    resolveOrgKind(baseProspect({ canonicalOrganizationTypeId: "nonprofit" })),
    "nonprofit",
  );
});

check("health plan reports Covered Lives, never Employees", () => {
  const card = synthesizeExecutiveCard(
    baseProspect({
      name: "Aetna",
      canonicalOrganizationTypeId: "health-plan",
      industryId: "health-plans",
      sectorId: "healthcare",
      buyerType: "Health Plan",
      stateCodes: ["PA", "CT", "FL", "TX", "OH", "CA", "NY", "NJ"],
      coveredLives: 22_000_000,
    }),
  );

  const lives = card.metrics.find((m) => m.label === "Covered Lives");
  assert.ok(lives, "expected a Covered Lives metric");
  assert.equal(lives!.value, "22M");

  // The defining rule: a payer must never surface an "Employees" chip.
  assert.ok(
    !card.metrics.some((m) => m.label === "Employees"),
    "health plan must not show an Employees metric",
  );
  // ...nor an employee headcount bullet.
  assert.ok(
    !card.whyThisMatters.some((b) => /employs approximately/i.test(b)),
    "health plan must not show an employee-count insight",
  );
  // Thesis weaves in covered lives.
  assert.match(card.thesis ?? "", /covering ~22M lives/i);
});

check("a >3M employee count is suppressed as implausible (membership conflation)", () => {
  const card = synthesizeExecutiveCard(
    baseProspect({
      name: "Mislabeled Carrier",
      canonicalOrganizationTypeId: "manufacturer",
      employeeEstimate: 22_000_000,
    }),
  );
  assert.ok(
    !card.metrics.some((m) => m.label === "Employees"),
    "implausible employee counts must be hidden",
  );
});

check("manufacturer reports a plausible Employees metric", () => {
  const card = synthesizeExecutiveCard(
    baseProspect({
      name: "Eaton Corporation",
      canonicalOrganizationTypeId: "manufacturer",
      industryId: "industrial-products",
      sectorId: "manufacturing",
      employeeEstimate: 92_000,
      publicCompany: true,
    }),
  );
  const emp = card.metrics.find((m) => m.label === "Employees");
  assert.ok(emp, "expected an Employees metric for a manufacturer");
  assert.equal(emp!.value, "92k");
  assert.equal(card.orgKind, "manufacturer");
});

check("confidence is hidden when high, shown when low", () => {
  const high = synthesizeExecutiveCard(
    baseProspect({ discoveryConfidence: 0.92 }),
  );
  assert.equal(high.confidencePercent, null);

  const low = synthesizeExecutiveCard(
    baseProspect({ discoveryConfidence: 0.55 }),
  );
  assert.equal(low.confidencePercent, 55);
});

check("generic, non-actionable insights are filtered from Why This Matters", () => {
  const card = synthesizeExecutiveCard(
    baseProspect({
      canonicalOrganizationTypeId: "manufacturer",
      publicCompany: true,
      whyItMatters: [
        "Public company",
        "Enterprise organization",
        "Sector match",
      ],
    }),
  );
  for (const bullet of card.whyThisMatters) {
    assert.ok(
      !/^public company$/i.test(bullet) &&
        !/^enterprise organization$/i.test(bullet) &&
        !/\bsector match$/i.test(bullet),
      `generic insight leaked through: "${bullet}"`,
    );
  }
});

console.log(`\n${passed} executive card checks passed.`);
