/**
 * Domain intelligence v1 checks — normalization, high-confidence lookup, coverage.
 * Run: npm run test:domain
 */
import assert from "node:assert/strict";
import type { Organization } from "../lib/discovery/organization.ts";
import {
  normalizeOrganizationName,
  normalizePrimaryDomain,
  normalizeWebsiteUrl,
  websiteFromDomain,
  confidenceLabelFromScore,
  buildDomainRegistry,
  resetDomainRegistryCache,
  resolveHighConfidenceDomain,
  enrichOrganizationDomain,
  enrichCatalogDomains,
  computeDomainCoverageReport,
  resolveParentOrganizationDomain,
  resetParentDomainRulesCache,
  DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD,
} from "../lib/domainIntelligence/index.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Domain intelligence checks:\n");

check("normalizes website URLs to origin", () => {
  assert.equal(normalizeWebsiteUrl("https://www.uhc.com/plans"), "https://www.uhc.com");
  assert.equal(normalizeWebsiteUrl("uhc.com"), "https://uhc.com");
  assert.equal(normalizeWebsiteUrl(""), null);
});

check("derives primary domain from website", () => {
  assert.equal(
    normalizePrimaryDomain({ website: "https://www.aetna.com" }),
    "aetna.com",
  );
  assert.equal(normalizePrimaryDomain({ domain: "WWW.HUMANA.COM" }), "humana.com");
});

check("normalizes organization names for directory matching", () => {
  assert.equal(
    normalizeOrganizationName("UnitedHealthcare Insurance Inc."),
    normalizeOrganizationName("UnitedHealthcare"),
  );
});

check("builds domain registry from curated directories", () => {
  resetDomainRegistryCache();
  const registry = buildDomainRegistry();
  assert.ok(registry.records.length >= 20, "expected curated directory records");
  assert.ok(registry.byCmsContract.has("H0028"), "UHC cms contract indexed");
});

check("resolves domain by cms_contract with high confidence", () => {
  resetDomainRegistryCache();
  const org: Organization = {
    id: "test-uhc",
    canonicalName: "Some Regional UHC Plan",
    displayName: "Some Regional UHC Plan",
    legalName: "Some Regional UHC Plan",
    aliases: [],
    buyerPack: "health-plans",
    sectorId: "health-plans",
    organizationType: "health-plan",
    states: ["FL"],
    regions: [],
    website: null,
    domain: null,
    headquarters: "Tampa, FL",
    description: null,
    parentId: null,
    parentDisplayName: null,
    geography: { states: ["FL"], regions: [], national: false, headquarters: "Tampa, FL" },
    classifications: [],
    externalIds: [{ idType: "cms_contract", idValue: "H0028" }],
    sectorAttributes: {},
    healthPlanType: null,
    sourceConnectors: ["cms-cpsc"],
    memberEstimate: null,
    confidence: 0.9,
    lastUpdated: new Date().toISOString(),
  };
  const result = resolveHighConfidenceDomain({
    organization: org,
    externalIds: org.externalIds,
  });
  assert.ok(result, "expected cms_contract match");
  assert.equal(result!.domain, "uhc.com");
  assert.ok(result!.confidence >= DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD);
  assert.equal(result!.confidenceLabel, "high");
});

check("does not guess domain for ambiguous name without external ids", () => {
  resetDomainRegistryCache();
  const org: Organization = {
    id: "test-unknown",
    canonicalName: "Random Regional Health Plan LLC",
    displayName: "Random Regional Health Plan LLC",
    legalName: "Random Regional Health Plan LLC",
    aliases: [],
    buyerPack: "health-plans",
    sectorId: "health-plans",
    organizationType: "health-plan",
    states: ["PA"],
    regions: [],
    website: null,
    domain: null,
    headquarters: "Harrisburg, PA",
    description: null,
    parentId: null,
    parentDisplayName: null,
    geography: { states: ["PA"], regions: [], national: false, headquarters: "Harrisburg, PA" },
    classifications: [],
    externalIds: [],
    sectorAttributes: {},
    healthPlanType: null,
    sourceConnectors: ["cms-cpsc"],
    memberEstimate: null,
    confidence: 0.5,
    lastUpdated: new Date().toISOString(),
  };
  const result = resolveHighConfidenceDomain({ organization: org });
  assert.equal(result, null);
});

check("enriches catalog entries in batch", () => {
  resetDomainRegistryCache();
  const entry = {
    organization: {
      id: "test-aetna",
      canonicalName: "Aetna Medicare Plan",
      displayName: "Aetna Medicare Plan",
      legalName: "Aetna Medicare Plan",
      aliases: [],
      buyerPack: "health-plans",
      sectorId: "health-plans",
      organizationType: "health-plan",
      states: ["CT"],
      regions: [],
      website: null,
      domain: null,
      headquarters: "Hartford, CT",
      description: null,
      parentId: null,
      parentDisplayName: "CVS Health",
      geography: { states: ["CT"], regions: [], national: false, headquarters: "Hartford, CT" },
      classifications: [],
      externalIds: [{ idType: "cms_contract", idValue: "H5521" }],
      sectorAttributes: {},
      healthPlanType: null,
      sourceConnectors: ["cms-cpsc"],
      memberEstimate: null,
      confidence: 0.9,
      lastUpdated: new Date().toISOString(),
    } as Organization,
    externalIds: [{ idType: "cms_contract", idValue: "H5521" }],
  };
  const { entries, enrichmentsApplied } = enrichCatalogDomains([entry]);
  assert.ok(enrichmentsApplied >= 1);
  assert.equal(entries[0]!.organization.domain, "aetna.com");
  assert.ok(entries[0]!.organization.website?.includes("aetna.com"));
});

check("computes domain coverage report by buyer pack", () => {
  const orgs: Organization[] = [
    {
      id: "1",
      canonicalName: "With Domain",
      displayName: "With Domain",
      legalName: "With Domain",
      aliases: [],
      buyerPack: "health-plans",
      sectorId: "health-plans",
      organizationType: "health-plan",
      states: [],
      regions: [],
      website: "https://example.com",
      domain: "example.com",
      headquarters: null,
      description: null,
      parentId: null,
      parentDisplayName: null,
      geography: { states: [], regions: [], national: false, headquarters: null },
      classifications: [],
      externalIds: [],
      sectorAttributes: {},
      healthPlanType: null,
      sourceConnectors: [],
      memberEstimate: null,
      confidence: 1,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "2",
      canonicalName: "No Domain",
      displayName: "No Domain",
      legalName: "No Domain",
      aliases: [],
      buyerPack: "health-plans",
      sectorId: "health-plans",
      organizationType: "health-plan",
      states: [],
      regions: [],
      website: null,
      domain: null,
      headquarters: null,
      description: null,
      parentId: null,
      parentDisplayName: null,
      geography: { states: [], regions: [], national: false, headquarters: null },
      classifications: [],
      externalIds: [],
      sectorAttributes: {},
      healthPlanType: null,
      sourceConnectors: [],
      memberEstimate: null,
      confidence: 1,
      lastUpdated: new Date().toISOString(),
    },
  ];
  const report = computeDomainCoverageReport(orgs);
  assert.equal(report.total, 2);
  assert.equal(report.withDomain, 1);
  assert.equal(report.pctDomain, 50);
  assert.equal(report.byBuyerPack[0]!.label, "health-plans");
});

check("confidence labels respect threshold", () => {
  assert.equal(confidenceLabelFromScore(0.9), "high");
  assert.equal(confidenceLabelFromScore(0.7), "medium");
  assert.equal(confidenceLabelFromScore(0.3), "low");
});

check("websiteFromDomain builds https URL", () => {
  assert.equal(websiteFromDomain("acme.com"), "https://acme.com");
});

check("enrichOrganizationDomain stores provenance in sectorAttributes", () => {
  resetDomainRegistryCache();
  const org: Organization = {
    id: "test-prov",
    canonicalName: "Humana Inc",
    displayName: "Humana Inc",
    legalName: "Humana Inc",
    aliases: ["humana"],
    buyerPack: "health-plans",
    sectorId: "health-plans",
    organizationType: "health-plan",
    states: ["KY"],
    regions: [],
    website: null,
    domain: null,
    headquarters: "Louisville, KY",
    description: null,
    parentId: null,
    parentDisplayName: null,
    geography: { states: ["KY"], regions: [], national: false, headquarters: "Louisville, KY" },
    classifications: [],
    externalIds: [],
    sectorAttributes: {},
    healthPlanType: null,
    sourceConnectors: [],
    memberEstimate: null,
    confidence: 0.9,
    lastUpdated: new Date().toISOString(),
  };
  const { organization, applied } = enrichOrganizationDomain(org);
  assert.ok(applied);
  assert.equal(organization.domain, "humana.com");
  const intel = organization.sectorAttributes?.domainIntelligence as { source?: string } | undefined;
  assert.ok(intel?.source);
});

function healthPlanOrg(overrides: Partial<Organization> & Pick<Organization, "id" | "canonicalName">): Organization {
  return {
    displayName: overrides.canonicalName,
    legalName: overrides.canonicalName,
    aliases: [],
    website: null,
    domain: null,
    organizationType: "health-plan",
    industries: ["payers"],
    sectorId: "healthcare",
    headquarters: null,
    locations: [],
    states: [],
    regions: [],
    ownership: "private",
    employeeRange: null,
    revenueRange: null,
    description: null,
    sources: [],
    buyerPack: "health-plans",
    canonicalOrganizationType: "health-plan",
    parentId: null,
    parentDisplayName: null,
    geography: { states: [], regions: [], national: false, headquarters: null },
    classifications: [],
    externalIds: [],
    sectorAttributes: {},
    healthPlanType: null,
    memberEstimate: null,
    confidence: 0.9,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

check("propagates domain from known parent display name", () => {
  resetDomainRegistryCache();
  resetParentDomainRulesCache();
  const org = healthPlanOrg({
    id: "parent-uhc-child",
    canonicalName: "UnitedHealthcare of the Mid-Atlantic",
    parentDisplayName: "UnitedHealth Group",
    states: ["MD"],
    geography: { states: ["MD"], regions: [], national: false, headquarters: null },
    externalIds: [{ idType: "cms_contract", idValue: "H9999" }],
  });
  const result = resolveParentOrganizationDomain(org);
  assert.ok(result, "expected parent propagation");
  assert.equal(result!.domain, "uhc.com");
  assert.equal(result!.source, "parent_propagation");
  assert.equal(result!.parentOrg, "UnitedHealth Group");
  assert.ok(result!.confidence >= DOMAIN_LOOKUP_CONFIDENCE_THRESHOLD);
});

check("propagates Aetna domain from legal entity token under CVS parent", () => {
  resetParentDomainRulesCache();
  const org = healthPlanOrg({
    id: "parent-aetna-child",
    canonicalName: "Aetna Health of California Inc.",
    legalName: "Aetna Health of California Inc.",
    parentDisplayName: "CVS Health",
    states: ["CA"],
    geography: { states: ["CA"], regions: [], national: false, headquarters: null },
  });
  const result = resolveParentOrganizationDomain(org);
  assert.ok(result);
  assert.equal(result!.domain, "aetna.com");
});

check("propagates Aetna domain from legal entity token without parent display name", () => {
  resetParentDomainRulesCache();
  const org = healthPlanOrg({
    id: "parent-aetna-token",
    canonicalName: "Aetna Health of California Inc.",
    legalName: "Aetna Health of California Inc.",
    states: ["CA"],
    geography: { states: ["CA"], regions: [], national: false, headquarters: null },
  });
  const result = resolveParentOrganizationDomain(org);
  assert.ok(result);
  assert.equal(result!.domain, "aetna.com");
  assert.equal(result!.matchedRule, "legal_entity_token:aetna");
});

check("state-disambiguates BCBS Michigan entities", () => {
  resetParentDomainRulesCache();
  const org = healthPlanOrg({
    id: "bcbs-mi-child",
    canonicalName: "Blue Cross Blue Shield of Michigan",
    states: ["MI"],
    geography: { states: ["MI"], regions: [], national: false, headquarters: "Detroit, MI" },
  });
  const result = resolveParentOrganizationDomain(org);
  assert.ok(result);
  assert.equal(result!.domain, "bcbsm.com");
});

check("does not propagate when BCBS parent is ambiguous without state", () => {
  resetParentDomainRulesCache();
  const org = healthPlanOrg({
    id: "bcbs-ambiguous",
    canonicalName: "Blue Cross Blue Shield",
    aliases: ["bcbs"],
  });
  const result = resolveParentOrganizationDomain(org);
  assert.equal(result, null);
});

check("does not fuzzy-match unknown regional health plan names", () => {
  resetParentDomainRulesCache();
  const org = healthPlanOrg({
    id: "unknown-plan",
    canonicalName: "Random Regional Health Plan LLC",
    parentDisplayName: "Regional Health Holdings",
    states: ["PA"],
    geography: { states: ["PA"], regions: [], national: false, headquarters: "Harrisburg, PA" },
  });
  assert.equal(resolveParentOrganizationDomain(org), null);
  assert.equal(
    resolveHighConfidenceDomain({ organization: org, externalIds: org.externalIds }),
    null,
  );
});

check("parent propagation stores provenance with parentOrg and matchedRule", () => {
  resetParentDomainRulesCache();
  const org = healthPlanOrg({
    id: "parent-prov",
    canonicalName: "UnitedHealthcare Insurance Company of Florida",
    parentDisplayName: "UnitedHealth Group",
    states: ["FL"],
    geography: { states: ["FL"], regions: [], national: false, headquarters: null },
    externalIds: [{ idType: "cms_contract", idValue: "H9998" }],
  });
  const lookup = resolveParentOrganizationDomain(org);
  assert.ok(lookup);
  assert.equal(lookup!.source, "parent_propagation");
  assert.equal(lookup!.parentOrg, "UnitedHealth Group");
  assert.ok(lookup!.matchedRule?.startsWith("parent_display_name:"));

  const { organization, applied } = enrichOrganizationDomain(org);
  assert.ok(applied);
  assert.equal(organization.domain, "uhc.com");
  const intel = organization.sectorAttributes?.domainIntelligence as {
    parentOrg?: string;
    matchedRule?: string;
    domain?: string;
  };
  assert.equal(intel?.domain, "uhc.com");
  assert.ok(intel?.parentOrg || intel?.matchedRule);
});

check("does not false-positive United Mine Workers as UnitedHealth", () => {
  resetParentDomainRulesCache();
  const org = healthPlanOrg({
    id: "umwa",
    canonicalName: "United Mine Workers of America Health & Retirement",
    parentDisplayName: "UMWA Health and Retirement Funds",
    aliases: ["UMWA Health and Retirement Funds"],
  });
  assert.equal(resolveParentOrganizationDomain(org), null);
});

console.log(`\n${passed} checks passed.`);
