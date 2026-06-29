#!/usr/bin/env node
/**
 * Raw domain backfill coverage report — warehouse analysis for registry expansion.
 * Run: ORG_WAREHOUSE=1 npm run report:domain-backfill
 * Options: RUN_BACKFILL=1 to run backfill before analysis
 */
import { importNationalHealthPlanCatalog } from "../lib/import/healthPlans/cms/importCms.ts";
import { importNationalManufacturerCatalog } from "../lib/import/manufacturers/importManufacturers.ts";
import { resetCatalogIndex } from "../lib/discovery/catalog/catalogIndex.ts";
import { getWarehouseOrganizations } from "../lib/import/warehouse/organizations.ts";
import { readDomainIntelligence } from "../lib/domainIntelligence/enrichOrganization.ts";
import { applyDomainIntelligenceToWarehouseOrgs } from "../lib/domainIntelligence/pipeline.ts";
import { resolveHighConfidenceDomain } from "../lib/domainIntelligence/resolveDomain.ts";
import { resolveParentOrganizationDomain } from "../lib/domainIntelligence/parentPropagation.ts";
import { resolveRegionalPlanDomain } from "../lib/domainIntelligence/regionalPlanRegistry.ts";
import { resolveImportTimeDomain } from "../lib/domainIntelligence/importPropagation.ts";
import { promoteEnterpriseDomain } from "../lib/enterprise/promoteDomain.ts";
import { enterpriseDomainIsAmbiguous } from "../lib/enterprise/promoteDomain.ts";
import { resolveEnterpriseKey } from "../lib/enterprise/resolveKey.ts";
import { computeEnterpriseRollupDiagnostics } from "../lib/enterprise/diagnostics.ts";
import { rollupAllHealthPlanOrganizations } from "../lib/enterprise/rollup.ts";
import type { Organization } from "../lib/discovery/organization.ts";
import type { EnterpriseProfile } from "../lib/enterprise/types.ts";
import { DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD } from "../lib/domainIntelligence/types.ts";

process.env.ORG_WAREHOUSE = "1";

await importNationalHealthPlanCatalog();
importNationalManufacturerCatalog();
resetCatalogIndex();

let orgs = getWarehouseOrganizations();

if (process.env.RUN_BACKFILL === "1") {
  console.log(`Running domain backfill on ${orgs.length} organizations...\n`);
  const result = await applyDomainIntelligenceToWarehouseOrgs(orgs, {
    force: process.env.FORCE === "1",
    persist: process.env.PERSIST !== "0",
  });
  orgs = result.organizations;
  console.log(
    `Backfill enriched ${result.enriched} orgs → ${result.coverage.withDomain}/${result.coverage.total} with domain (${result.coverage.pctDomain}%)\n`,
  );
}

const hpOrgs = orgs.filter((o) => o.buyerPack === "health-plans");
const rollup = rollupAllHealthPlanOrganizations(hpOrgs);
const diagnostics = computeEnterpriseRollupDiagnostics(orgs);

function orgHasAnyDomainSignal(org: Organization): boolean {
  const intel = readDomainIntelligence(org.sectorAttributes);
  return Boolean(
    org.website?.trim() ||
      org.domain?.trim() ||
      (intel?.domain && intel.confidence >= DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD),
  );
}

function childFieldSummary(children: Organization[]): {
  withWebsite: number;
  withDomain: number;
  withHighConfIntel: number;
} {
  let withWebsite = 0;
  let withDomain = 0;
  let withHighConfIntel = 0;
  for (const c of children) {
    if (c.website?.trim()) withWebsite += 1;
    if (c.domain?.trim()) withDomain += 1;
    const intel = readDomainIntelligence(c.sectorAttributes);
    if (intel?.domain && intel.confidence >= DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD) withHighConfIntel += 1;
  }
  return { withWebsite, withDomain, withHighConfIntel };
}

function diagnoseOrg(org: Organization): string[] {
  const reasons: string[] = [];
  if (orgHasAnyDomainSignal(org)) return ["already_has_domain"];

  const regional = resolveRegionalPlanDomain(org);
  const parent = resolveParentOrganizationDomain(org);
  const general = resolveHighConfidenceDomain({ organization: org });

  if (regional && parent && regional.domain !== parent.domain) {
    reasons.push("ambiguous_regional_vs_parent");
  } else if (!regional && !parent && !general) {
    if (org.parentDisplayName?.trim()) {
      const parentAttempt = resolveParentOrganizationDomain(org);
      if (!parentAttempt) reasons.push("parent_display_unmatched_or_ambiguous");
      else reasons.push("parent_below_threshold");
    } else {
      reasons.push("no_parent_display_name");
    }
    if (!resolveRegionalPlanDomain(org)) reasons.push("no_regional_registry_match");
    if (!resolveHighConfidenceDomain({ organization: org })) reasons.push("no_directory_or_id_match");
  } else if (!regional && !parent && !general) {
    reasons.push("no_high_confidence_match");
  }

  if (reasons.length === 0) reasons.push("resolver_returned_null_unknown");
  return [...new Set(reasons)];
}

function diagnoseMissingProfile(
  profile: EnterpriseProfile,
  children: Organization[],
): string {
  const promoted = promoteEnterpriseDomain({
    key: resolveEnterpriseKey(children[0]!),
    children,
    registry: resolveEnterpriseKey(children[0]!).registryEntry,
  });
  if (promoted) return "unexpected_promotion_available";

  if (enterpriseDomainIsAmbiguous(children)) {
    return "ambiguous_child_domains";
  }

  const fields = childFieldSummary(children);
  if (fields.withHighConfIntel > 0) {
    return "promotion_failure_investigate";
  }

  const childReasons = new Map<string, number>();
  for (const child of children) {
    for (const r of diagnoseOrg(child)) {
      childReasons.set(r, (childReasons.get(r) ?? 0) + 1);
    }
  }

  const top = [...childReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length === 0) return "no_child_domain_signals";
  return top.map(([r, n]) => `${r}(${n}/${children.length})`).join("; ");
}

function collectAmbiguousCases(orgs: Organization[]): Organization[] {
  return orgs.filter((org) => {
    if (orgHasAnyDomainSignal(org)) return false;
    const regional = resolveRegionalPlanDomain(org);
    const parent = resolveParentOrganizationDomain(org);
    if (regional && parent && regional.domain !== parent.domain) return true;
    return false;
  });
}

const missingProfiles = rollup.profiles
  .filter((p) => !p.canonicalDomain?.trim())
  .sort((a, b) => b.childCount - a.childCount)
  .slice(0, 50);

const orphanOrgs = rollup.organizations.filter((o) => !o.id.startsWith("enterprise:"));
const missingOrphans = orphanOrgs
  .filter((o) => !orgHasAnyDomainSignal(o))
  .slice(0, 50);

const ambiguousCases = collectAmbiguousCases(hpOrgs);

// Aggregate parent display names and canonical names for candidate registry suggestions
const parentDisplayCounts = new Map<string, number>();
const unresolvedNames = new Map<string, number>();
for (const profile of rollup.profiles.filter((p) => !p.canonicalDomain)) {
  unresolvedNames.set(profile.name, (unresolvedNames.get(profile.name) ?? 0) + profile.childCount);
  const children = profile.sourceOrganizationIds
    .map((id) => hpOrgs.find((o) => o.id === id))
    .filter(Boolean) as Organization[];
  for (const c of children) {
    if (c.parentDisplayName?.trim()) {
      parentDisplayCounts.set(
        c.parentDisplayName,
        (parentDisplayCounts.get(c.parentDisplayName) ?? 0) + 1,
      );
    }
    if (!orgHasAnyDomainSignal(c)) {
      unresolvedNames.set(c.canonicalName, (unresolvedNames.get(c.canonicalName) ?? 0) + 1);
    }
  }
}

console.log("=".repeat(72));
console.log("RAW DOMAIN BACKFILL REPORT");
console.log("=".repeat(72));
console.log();
console.log("Summary");
console.log("-------");
console.log(`Raw org domain coverage:     ${diagnostics.rawOrgDomainCoverage.withDomain}/${diagnostics.rawOrgDomainCoverage.total} (${diagnostics.rawOrgDomainCoverage.pctDomain}%)`);
console.log(`Enterprise profiles w/domain: ${diagnostics.enterpriseProfilesWithDomain}/${diagnostics.rollupProfileCount} (${diagnostics.enterpriseDomainCoverage.pctDomain}%)`);
console.log(`Promotion failures:          ${diagnostics.promotionFailures}`);
console.log(`Passthrough orphans:         ${diagnostics.passthroughOrphans}`);
console.log(`Ambiguous unresolved orgs:   ${ambiguousCases.length}`);
console.log();

console.log("=".repeat(72));
console.log("1. TOP 50 UNRESOLVED ROLLUP PROFILES (missing canonicalDomain)");
console.log("=".repeat(72));
for (const profile of missingProfiles) {
  const children = profile.sourceOrganizationIds
    .map((id) => hpOrgs.find((o) => o.id === id))
    .filter(Boolean) as Organization[];
  const fields = childFieldSummary(children);
  const childNames = children.slice(0, 6).map((c) => c.canonicalName);
  const reason = diagnoseMissingProfile(profile, children);
  console.log();
  console.log(`• ${profile.name} (${profile.childCount} children, id=${profile.id})`);
  console.log(`  States: ${profile.statesServed.join(", ") || "—"}`);
  console.log(`  Child orgs: ${childNames.join(" | ")}${children.length > 6 ? ` (+${children.length - 6} more)` : ""}`);
  console.log(
    `  Child domain signals: website=${fields.withWebsite}, domain=${fields.withDomain}, highConfIntel=${fields.withHighConfIntel}`,
  );
  console.log(`  Reason: ${reason}`);
}

console.log();
console.log("=".repeat(72));
console.log("2. TOP 50 PASSTHROUGH ORPHANS MISSING DOMAIN");
console.log("=".repeat(72));
for (const org of missingOrphans) {
  const reason = diagnoseOrg(org).join(", ");
  const states = org.geography?.states ?? org.states ?? [];
  console.log();
  console.log(`• ${org.canonicalName}`);
  console.log(`  id=${org.id}`);
  console.log(`  parent=${org.parentDisplayName ?? "—"}`);
  console.log(`  states=${states.join(", ") || "—"}`);
  console.log(`  reason=${reason}`);
}

console.log();
console.log("=".repeat(72));
console.log("3. CANDIDATE REGIONAL_PLAN_DOMAIN_ENTRIES (by unresolved child name frequency)");
console.log("=".repeat(72));
const regionalCandidates = [...unresolvedNames.entries()]
  .filter(([name]) => !name.toLowerCase().includes("n/a"))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40);
for (const [name, count] of regionalCandidates) {
  console.log(`  ${count}x  ${name}`);
}

console.log();
console.log("=".repeat(72));
console.log("4. CANDIDATE CURATED PARENT MAPPINGS (by parentDisplayName frequency, unresolved)");
console.log("=".repeat(72));
const parentCandidates = [...parentDisplayCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30);
for (const [parent, count] of parentCandidates) {
  console.log(`  ${count} children  parentDisplayName="${parent}"`);
}

console.log();
console.log("=".repeat(72));
console.log("5. AMBIGUOUS CASES — SHOULD STAY UNRESOLVED");
console.log("=".repeat(72));
for (const org of ambiguousCases.slice(0, 20)) {
  const regional = resolveRegionalPlanDomain(org)!;
  const parent = resolveParentOrganizationDomain(org)!;
  console.log();
  console.log(`• ${org.canonicalName}`);
  console.log(`  regional=${regional.domain} vs parent=${parent.domain}`);
  console.log(`  parentDisplayName=${org.parentDisplayName ?? "—"}`);
}

if (ambiguousCases.length === 0) {
  console.log("  (none detected in current warehouse)");
}

console.log();
console.log("=".repeat(72));
console.log("END REPORT");
console.log("=".repeat(72));
