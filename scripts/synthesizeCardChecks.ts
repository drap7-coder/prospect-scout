/**
 * Intelligence card synthesis checks.
 * Run: npm run test:intel
 */
import assert from "node:assert/strict";
import { synthesizeIntelligenceCard } from "../lib/intelligence/synthesizeCard.ts";
import type { Prospect } from "../lib/search/types.ts";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function baseProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: "test-1",
    name: "Acme Health Systems",
    buyerType: "Health System",
    location: "Columbus, OH",
    region: "midwest",
    buyerPack: "healthSystems",
    stateCode: "OH",
    score: 82,
    scoreBreakdown: { total: 82, factors: [] },
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

function signal(
  overrides: Partial<Prospect["signals"][number]> &
    Pick<Prospect["signals"][number], "id" | "label" | "source">,
): Prospect["signals"][number] {
  return {
    type: "other",
    strength: "moderate",
    strengthScore: 0.5,
    evidenceText: "",
    whyNow: "",
    suggestedAction: "",
    freshnessDays: 30,
    urgency: 0.5,
    ...overrides,
  };
}

console.log("Intelligence card synthesis checks:\n");

check("synthesizes nonprofit revenue bullet from ProPublica enrichment", () => {
  const card = synthesizeIntelligenceCard(
    baseProspect({
      canonicalOrganizationTypeId: "nonprofit",
      sectorId: "nonprofit",
    }),
    {
      ein: "142007220",
      strein: "14-2007220",
      legalName: "Acme Health Systems",
      city: "Columbus",
      state: "OH",
      subsection501c: "501(c)(3)",
      nteeCategory: "Health General",
      nteeCode: "E",
      revenue: 860_000_000,
      expenses: 800_000_000,
      assets: 1_200_000_000,
      officers: [],
      executiveCompensation: null,
      latestForm990Year: 2023,
      form990PdfUrl: "https://example.com/990.pdf",
      form990XmlUrl: null,
      profileUrl: "https://projects.propublica.org/nonprofits/organizations/142007220",
    },
  );

  assert.ok(card.intelligence.some((b) => /860\.0M.*revenue/i.test(b.text)));
  assert.ok(card.dataSources.some((s) => s.label === "ProPublica"));
});

check("surfaces top three opportunity signals by urgency", () => {
  const card = synthesizeIntelligenceCard(
    baseProspect({
      signals: [
        signal({
          id: "s1",
          label: "Recent SEC 8-K filing",
          type: "regulatory",
          source: "SEC",
          strength: "strong",
          strengthScore: 0.9,
          urgency: 0.9,
          evidenceText: "Filed 8-K on leadership change",
          whyNow: "Leadership transition may open vendor review.",
        }),
        signal({
          id: "s2",
          label: "Hiring surge in IT",
          type: "hiring",
          source: "Careers",
          strength: "moderate",
          strengthScore: 0.6,
          urgency: 0.75,
          evidenceText: "12 open IT roles",
          whyNow: "Active hiring in technology.",
        }),
        signal({
          id: "s3",
          label: "CMS enrollment growth",
          type: "regulatory",
          source: "CMS",
          strength: "moderate",
          strengthScore: 0.55,
          urgency: 0.6,
          evidenceText: "Medicare Advantage enrollment up 8%",
        }),
        signal({
          id: "s4",
          label: "Low priority signal",
          type: "other",
          source: "Directory",
          strength: "weak",
          strengthScore: 0.2,
          urgency: 0.1,
          evidenceText: "Minor",
        }),
      ],
    }),
    null,
  );

  assert.equal(card.opportunitySignals.length, 3);
  assert.equal(card.opportunitySignals[0]!.label, "SEC: Recent SEC 8-K filing");
});

check("hides empty sections — no intelligence bullets without data", () => {
  const card = synthesizeIntelligenceCard(
    baseProspect({
      location: "Unknown",
      stateCode: undefined,
      buyerType: "Organization",
      description: "",
      whyItMatters: [],
      matchReasons: [],
    }),
    null,
  );

  assert.equal(card.intelligence.length, 0);
  assert.equal(card.opportunitySignals.length, 0);
});

check("identity includes org type, HQ, and confidence", () => {
  const card = synthesizeIntelligenceCard(
    baseProspect({
      canonicalOrganizationTypeId: "hospital-health-system",
      industryId: "hospitals",
      discoveryConfidence: 0.91,
      website: "https://www.acmehealth.org",
    }),
    null,
  );

  assert.equal(card.identity.orgType, "Hospital / Health System");
  assert.equal(card.identity.headquarters, "Columbus, OH");
  assert.equal(card.identity.confidencePercent, 91);
  assert.equal(card.identity.website, "acmehealth.org");
});

check("catalog badge describes directory contribution", () => {
  const card = synthesizeIntelligenceCard(
    baseProspect({
      directoryMatch: true,
    }),
    null,
  );

  const catalog = card.dataSources.find((s) => s.label === "Catalog");
  assert.ok(catalog);
  assert.match(catalog!.contribution, /identity/i);
});

console.log(`\n${passed} checks passed.`);
