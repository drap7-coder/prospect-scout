/**
 * Homepage search entry — URL routing and hero UI contract.
 *
 * Run with: npm run test:homepage
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { homeQueryToResultsUrl } from "../lib/search/homeSearchEntry.ts";
import {
  parseSearchStateFromParams,
  resolveSearchState,
} from "../lib/search/searchState.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Homepage search entry checks\n");

check("homeQueryToResultsUrl preserves query in /results URL", () => {
  const url = homeQueryToResultsUrl("Centene health plan");
  assert.ok(url.startsWith("/results?"));
  const params = new URLSearchParams(url.split("?")[1] ?? "");
  const state = resolveSearchState(parseSearchStateFromParams(params));
  assert.equal(state.query, "Centene health plan");
});

check("homeQueryToResultsUrl rejects empty query navigation", () => {
  assert.equal(homeQueryToResultsUrl(""), "/results");
  assert.equal(homeQueryToResultsUrl("   "), "/results");
});

check("HomeHeroSearchBar renders search input and submit control", () => {
  const source = readFileSync(
    path.join(root, "app/components/HomeHeroSearchBar.tsx"),
    "utf8",
  );
  assert.ok(source.includes('type="search"'));
  assert.ok(source.includes("Search"));
  assert.ok(source.includes("homeQueryToResultsUrl"));
  assert.ok(source.includes("router.push"));
});

check("HomeSearchHero no longer shows Build a custom list", () => {
  const source = readFileSync(
    path.join(root, "app/components/HomeSearchHero.tsx"),
    "utf8",
  );
  assert.ok(!source.includes("Build a custom list"));
  assert.ok(!source.includes("ProspectListBuilder"));
  assert.ok(source.includes("HomeHeroSearchBar"));
  assert.ok(source.includes("IndustryCatalog"));
});

check("ProspectListBuilder component remains available for future use", () => {
  const source = readFileSync(
    path.join(root, "app/components/ProspectListBuilder.tsx"),
    "utf8",
  );
  assert.ok(source.includes("export function ProspectListBuilder"));
});

console.log(`\nAll ${passed} homepage search entry checks passed.`);
