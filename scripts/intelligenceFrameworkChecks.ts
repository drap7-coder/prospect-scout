/**
 * Organization Intelligence Framework checks.
 * Run: npm run test:intelligence
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseErisaCsv } from "../lib/import/erisa/parseCsv.ts";
import { indexErisaRows, clearErisaIndex } from "../lib/import/erisa/memoryIndex.ts";
import { buildIntelligenceForProspect } from "../lib/intelligence/framework/buildProfile.ts";
import {
  aggregateBenefitsFromFilings,
  buildBenefitsIntelligenceModule,
  isBenefitsIntelligenceDetail,
} from "../lib/intelligence/modules/benefits/buildBenefitsIntelligence.ts";
import { organizationToRawProspect } from "../lib/discovery/toRawProspect.ts";
import { organizationFromErisaRow } from "../lib/import/erisa/organizationFromFiling.ts";
import { directoryRecordToOrganization } from "../lib/discovery/organization.ts";
import { getAllDirectoryRecords } from "../lib/directories/search.ts";
import { mergeOrganizations } from "../lib/discovery/organization.ts";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(moduleDir, "../fixtures/import/erisa/sample-form5500.csv");

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("Organization Intelligence Framework checks:\n");

check("benefits module exposes summary metrics only when data exists", () => {
  const benefitsModule = buildBenefitsIntelligenceModule({
    organizationId: "erisa-231234567",
    filings: [],
  });
  assert.equal(benefitsModule, null);
});

check("benefits module labels participants as ERISA plan participants", () => {
  const rows = parseErisaCsv(readFileSync(fixturePath, "utf8")).slice(0, 2);
  const { totals } = aggregateBenefitsFromFilings(rows);
  const benefitsModule = buildBenefitsIntelligenceModule({
    organizationId: "erisa-231234567",
    filings: rows,
  });
  assert.ok(benefitsModule);
  const participantMetric = benefitsModule!.summaryMetrics.find(
    (metric) => metric.id === "plan-participants",
  );
  assert.ok(participantMetric);
  assert.match(participantMetric!.label, /ERISA plan participants/i);
  assert.ok(totals.totalErisaPlanParticipants > 0);
  assert.ok(isBenefitsIntelligenceDetail(benefitsModule!.detail));
});

check("synthesized prospect attaches benefits intelligence module from ERISA index", () => {
  clearErisaIndex();
  const rows = parseErisaCsv(readFileSync(fixturePath, "utf8"));
  indexErisaRows(rows);
  const upmc = rows.find((row) => /UPMC/i.test(row.sponsorName))!;
  const raw = organizationToRawProspect(organizationFromErisaRow(upmc));
  const intelligence = buildIntelligenceForProspect(raw);

  const benefits = intelligence.organizationIntelligence.modules.find(
    (entry) => entry.id === "benefits",
  );
  assert.ok(benefits, "expected benefits intelligence module");
  assert.ok(benefits!.summaryMetrics.length > 0);
  assert.ok(benefits!.provenance.some((p) => /ERISA Form 5500/i.test(p.sourceLabel)));
});

check("merged directory + ERISA org resolves benefits filings by name", () => {
  clearErisaIndex();
  const targetRecord = getAllDirectoryRecords().find((r) => r.id === "dir-ret-target");
  assert.ok(targetRecord);
  const merged = mergeOrganizations(
    directoryRecordToOrganization(targetRecord),
    organizationFromErisaRow({
      sponsorEin: "410215930",
      sponsorName: "Target Corporation",
      sponsorState: "MN",
      sponsorCity: "Minneapolis",
      planName: "Target Corporation Welfare Benefits Plan",
      planNumber: "001",
      filingYear: 2023,
      participantCount: 350_000,
      healthWelfarePlan: true,
      selfFunded: true,
      fundingArrangement: "self-funded",
      welfareBenefitTypes: [],
      ackId: null,
    }),
  );
  indexErisaRows([
    {
      sponsorEin: "410215930",
      sponsorName: "Target Corporation",
      sponsorState: "MN",
      sponsorCity: "Minneapolis",
      planName: "Target Corporation Welfare Benefits Plan",
      planNumber: "001",
      filingYear: 2023,
      participantCount: 350_000,
      healthWelfarePlan: true,
      selfFunded: true,
      fundingArrangement: "self-funded",
      welfareBenefitTypes: [],
      ackId: null,
    },
  ]);

  const intelligence = buildIntelligenceForProspect({
    id: merged.id,
    name: merged.canonicalName,
    erisaIntel: merged.erisaIntel,
  });
  const benefits = intelligence.organizationIntelligence.modules.find(
    (module) => module.id === "benefits",
  );
  assert.ok(benefits);
  assert.ok(
    benefits!.summaryMetrics.some((metric) => metric.id === "plan-participants"),
  );
});

check("organizations without intelligence data render zero modules", () => {
  const intelligence = buildIntelligenceForProspect({
    id: "dir-hp-uhc",
    name: "UnitedHealthcare",
  });
  assert.equal(intelligence.organizationIntelligence.modules.length, 0);
  assert.equal(intelligence.relationshipGraph.edges.length, 0);
});

console.log(`\nAll ${passed} intelligence framework checks passed.`);
