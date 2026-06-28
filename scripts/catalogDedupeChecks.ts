/**
 * Catalog deduplication checks — ensures unique organization ids in CatalogIndex.
 * Run: npm run test:catalog-dedupe
 */
import assert from "node:assert/strict";
import {
  dedupeByOrganizationId,
  dedupeOrganizationsCanonical,
  finalizeOrganization,
  type Organization,
} from "../lib/discovery/organization.ts";
import { resetCatalogIndex, getCatalogOrganizations } from "../lib/discovery/catalog/catalogIndex.ts";
import { sourceStamp } from "../lib/discovery/connector.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function stubOrg(id: string, name: string, extras: Partial<Organization> = {}): Organization {
  return finalizeOrganization({
    id,
    canonicalName: name,
    aliases: extras.aliases ?? [],
    website: extras.website ?? null,
    domain: extras.domain ?? null,
    organizationType: extras.organizationType ?? "health-plan",
    industries: extras.industries ?? ["payers"],
    sectorId: extras.sectorId ?? "healthcare",
    headquarters: extras.headquarters ?? null,
    locations: extras.locations ?? [],
    states: extras.states ?? ["PA"],
    regions: extras.regions ?? [],
    ownership: extras.ownership ?? "private",
    employeeRange: null,
    memberEstimate: null,
    revenueRange: null,
    description: null,
    sources: extras.sources ?? [sourceStamp("directory", id, ["test"])],
    buyerPack: "health-plans",
    canonicalOrganizationType: "health-plan",
    tags: extras.tags ?? [],
  });
}

console.log("Catalog dedupe checks:\n");

check("dedupeByOrganizationId collapses duplicate ids", () => {
  const a = stubOrg("dir-hp-uhc", "UnitedHealthcare");
  const b = stubOrg("dir-hp-uhc", "UnitedHealthcare", {
    sources: [sourceStamp("cms", "cms-uhc", ["cms"])],
  });
  const deduped = dedupeByOrganizationId([a, b]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]!.id, "dir-hp-uhc");
  assert.ok(deduped[0]!.sources.some((s) => s.connector === "cms"));
});

check("dedupeOrganizationsCanonical never returns duplicate ids", () => {
  const orgs = [
    stubOrg("dir-hp-uhc", "UnitedHealthcare"),
    stubOrg("dir-hp-uhc", "UnitedHealthcare", {
      aliases: ["UHC"],
      sources: [sourceStamp("sec", "sec-uhc", ["sec"])],
    }),
    stubOrg("dir-hp-cigna", "Cigna Healthcare"),
  ];
  const deduped = dedupeOrganizationsCanonical(orgs);
  const ids = deduped.map((org) => org.id);
  assert.equal(new Set(ids).size, ids.length);
});

check("CatalogIndex has zero duplicate organization ids", () => {
  resetCatalogIndex();
  const orgs = getCatalogOrganizations();
  const ids = orgs.map((org) => org.id);
  const duplicateCount = ids.length - new Set(ids).size;
  assert.equal(duplicateCount, 0, `found ${duplicateCount} duplicate ids in catalog index`);
});

console.log(`\nAll ${passed} catalog dedupe checks passed.`);
