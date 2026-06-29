/**
 * Email intelligence v1 checks — pattern inference, evidence, candidate utility.
 * Run: npm run test:email
 */
import assert from "node:assert/strict";
import {
  classifyLocalPartWithNames,
  buildLocalPart,
} from "../lib/emailIntelligence/patterns.ts";
import { isGenericInboxLocalPart } from "../lib/emailIntelligence/genericInboxes.ts";
import {
  extractEmailsFromHtml,
} from "../lib/emailIntelligence/extractEmails.ts";
import {
  observationsToEvidence,
  inferOrganizationEmailPattern,
} from "../lib/emailIntelligence/inferPattern.ts";
import { generateEmailCandidate } from "../lib/emailIntelligence/generateCandidate.ts";
import {
  confidenceLabelFromScore,
  scorePatternConfidence,
} from "../lib/emailIntelligence/confidence.ts";
import {
  clearInMemoryEmailEvidence,
  getInMemoryEmailEvidence,
  mergeInMemoryEmailEvidence,
  shouldSkipEmailEnrichment,
} from "../lib/emailIntelligence/cache.ts";
import { buildContactIntelligenceView } from "../lib/emailIntelligence/formatContactIntelligence.ts";
import type { OrganizationEmailPattern } from "../lib/emailIntelligence/types.ts";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result instanceof Promise) {
    throw new Error(`Async check not supported: ${name}`);
  }
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Email intelligence checks:\n");

check("classifies observed first.last pattern with names", () => {
  assert.equal(
    classifyLocalPartWithNames("john.smith", "John", "Smith"),
    "first.last",
  );
  assert.equal(buildLocalPart("first.last", "John", "Smith"), "john.smith");
});

check("picks dominant pattern when multiple competing patterns exist", () => {
  const observations = [
    {
      email: "john.smith@acme.com",
      localPart: "john.smith",
      domain: "acme.com",
      sourceUrl: "https://acme.com/team",
      firstName: "John",
      lastName: "Smith",
    },
    {
      email: "jane.smith@acme.com",
      localPart: "jane.smith",
      domain: "acme.com",
      sourceUrl: "https://acme.com/team",
      firstName: "Jane",
      lastName: "Smith",
    },
    {
      email: "bob@acme.com",
      localPart: "bob",
      domain: "acme.com",
      sourceUrl: "https://acme.com/team",
      firstName: "Bob",
      lastName: "Example",
    },
  ];
  const evidence = observationsToEvidence("org-1", observations);
  const pattern = inferOrganizationEmailPattern({
    domain: "acme.com",
    evidence,
    mxProvider: null,
    lastCheckedAt: new Date().toISOString(),
  });
  assert.equal(pattern.pattern, "first.last");
  assert.equal(pattern.evidenceCount, 3);
  assert.equal(pattern.source, "observed_public_emails");
});

check("filters generic inbox local parts", () => {
  assert.equal(isGenericInboxLocalPart("info"), true);
  assert.equal(isGenericInboxLocalPart("sales"), true);
  assert.equal(isGenericInboxLocalPart("support"), true);
  assert.equal(isGenericInboxLocalPart("careers"), true);
  assert.equal(isGenericInboxLocalPart("privacy"), true);
  assert.equal(isGenericInboxLocalPart("john.smith"), false);
});

check("extractEmailsFromHtml ignores generic inboxes and foreign domains", () => {
  const html = `
    <p>info@acme.com sales@acme.com</p>
    <a href="mailto:john.smith@acme.com">John Smith</a>
    <span>other@example.com</span>
  `;
  const found = extractEmailsFromHtml(html, "https://acme.com/team", "acme.com");
  assert.equal(found.length, 1);
  assert.equal(found[0]!.email, "john.smith@acme.com");
  assert.equal(found[0]!.firstName, "John");
});

check("no domain stores unknown pattern", () => {
  // sync wrapper — tested via inferOrganizationEmailPattern directly below in enrich test
  const pattern = inferOrganizationEmailPattern({
    domain: null,
    evidence: [],
    mxProvider: null,
    lastCheckedAt: new Date().toISOString(),
  });
  assert.equal(pattern.pattern, "unknown");
  assert.equal(pattern.domain, null);
});

check("no observed emails stores unknown low-confidence pattern", () => {
  const pattern = inferOrganizationEmailPattern({
    domain: "acme.com",
    evidence: [],
    mxProvider: null,
    lastCheckedAt: new Date().toISOString(),
  });
  assert.equal(pattern.pattern, "unknown");
  assert.equal(pattern.confidenceLabel, "low");
  assert.equal(pattern.source, "unknown");
});

check("generateEmailCandidate utility returns predicted email", () => {
  const emailPattern: OrganizationEmailPattern = {
    domain: "acme.com",
    pattern: "first.last",
    formatTemplate: "{first}.{last}@{domain}",
    confidence: 0.82,
    confidenceLabel: "high",
    source: "observed_public_emails",
    evidenceCount: 3,
    sampleEvidence: ["john.smith@acme.com"],
    mxProvider: "Google Workspace",
    catchAllStatus: "unknown",
    lastCheckedAt: new Date().toISOString(),
  };
  const candidate = generateEmailCandidate("Jane", "Doe", "acme.com", emailPattern);
  assert.ok(candidate);
  assert.equal(candidate!.email, "jane.doe@acme.com");
  assert.equal(candidate!.pattern, "first.last");
  assert.equal(candidate!.status, "predicted");
});

check("confidence scoring labels high medium low", () => {
  const high = scorePatternConfidence({
    dominantCount: 3,
    totalClassified: 3,
    totalObserved: 3,
    source: "observed_public_emails",
  });
  assert.equal(confidenceLabelFromScore(high), "high");

  const low = scorePatternConfidence({
    dominantCount: 0,
    totalClassified: 0,
    totalObserved: 0,
    source: "unknown",
  });
  assert.equal(confidenceLabelFromScore(low), "low");
});

check("evidence storage keeps in-memory records per organization", () => {
  clearInMemoryEmailEvidence();
  const evidence = observationsToEvidence("org-evidence", [
    {
      email: "amy.jones@evidence.co",
      localPart: "amy.jones",
      domain: "evidence.co",
      sourceUrl: "https://evidence.co/team",
      firstName: "Amy",
      lastName: "Jones",
    },
  ]);
  mergeInMemoryEmailEvidence("org-evidence", evidence);
  const stored = getInMemoryEmailEvidence("org-evidence");
  assert.equal(stored.length, 1);
  assert.equal(stored[0]!.pattern, "first.last");
});

check("cache skips frequent rechecks", () => {
  const recent: OrganizationEmailPattern = {
    domain: "acme.com",
    pattern: "first.last",
    formatTemplate: "{first}.{last}@{domain}",
    confidence: 0.8,
    confidenceLabel: "high",
    source: "observed_public_emails",
    evidenceCount: 2,
    sampleEvidence: [],
    mxProvider: null,
    catchAllStatus: "unknown",
    lastCheckedAt: new Date().toISOString(),
  };
  assert.equal(shouldSkipEmailEnrichment(recent, 86_400_000), true);
  assert.equal(shouldSkipEmailEnrichment(recent, 86_400_000, true), false);
});

check("company detail rendering builds contact intelligence view", () => {
  const view = buildContactIntelligenceView({
    domain: "acme.com",
    pattern: "first.last",
    formatTemplate: "{first}.{last}@{domain}",
    confidence: 0.76,
    confidenceLabel: "high",
    source: "observed_public_emails",
    evidenceCount: 2,
    sampleEvidence: ["john.smith@acme.com"],
    mxProvider: "Google Workspace",
    catchAllStatus: "unknown",
    lastCheckedAt: "2026-06-01T00:00:00.000Z",
  });
  assert.equal(view.title, "Contact Intelligence");
  assert.equal(view.patternLabel, "first · last");
  assert.equal(view.domain, "acme.com");
  assert.ok(view.hasData);
  assert.equal(view.sampleEvidence[0], "john.smith@acme.com");
});

console.log(`\n${passed} email intelligence checks passed.`);
