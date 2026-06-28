/**
 * Alphabet browse row grouping checks.
 * Run: npm run test:alphabet-rows
 */
import assert from "node:assert/strict";
import {
  alphabetBucket,
  buildAlphabetRows,
} from "../lib/discovery/alphabetRows.ts";
import type { Prospect } from "../lib/search/types.ts";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

let seq = 0;
function prospect(name: string): Prospect {
  seq += 1;
  return {
    id: `p-${seq}`,
    name,
    location: "Columbus, OH",
    region: "midwest",
    buyerType: "Organization",
    buyerPack: "health-plans",
    score: 100 - seq,
    scoreBreakdown: { total: 100 - seq, factors: [] },
    whyItMatters: [],
    signals: [],
    whyNow: "",
    sourceTrail: [],
    outreachAngle: "",
    contactRoles: [],
    matchReasons: [],
    sourceRecords: [],
  };
}

console.log("Alphabet rows checks:\n");

check("alphabetBucket handles letters and symbols", () => {
  assert.equal(alphabetBucket("Acme Health"), "A");
  assert.equal(alphabetBucket(" united"), "U");
  assert.equal(alphabetBucket("3M"), "#");
  assert.equal(alphabetBucket(""), "#");
});

check("buildAlphabetRows creates one row per letter in order", () => {
  const rows = buildAlphabetRows([
    prospect("Beta Plan"),
    prospect("Alpha Plan"),
    prospect("Acme Plan"),
  ]);
  assert.deepEqual(
    rows.map((r) => r.title),
    ["A", "B"],
  );
  assert.equal(rows[0]!.prospects.length, 2);
  assert.deepEqual(rows[0]!.prospects.map((p) => p.name), [
    "Alpha Plan",
    "Acme Plan",
  ]);
  assert.equal(rows[1]!.prospects.length, 1);
});

check("preserves input order within a letter bucket", () => {
  const input = [prospect("Alpha One"), prospect("Alpha Two"), prospect("Beta One")];
  const rows = buildAlphabetRows(input);
  assert.deepEqual(
    rows[0]!.prospects.map((p) => p.name),
    ["Alpha One", "Alpha Two"],
  );
});

check("includes all prospects across letter rows", () => {
  const input = [
    prospect("Alpha"),
    prospect("Beta"),
    prospect("Gamma"),
    prospect("Zeta"),
  ];
  const rows = buildAlphabetRows(input);
  const total = rows.reduce((sum, row) => sum + row.prospects.length, 0);
  assert.equal(total, input.length);
});

console.log(`\n${passed} alphabet rows checks passed.`);
