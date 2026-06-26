/**
 * Lightweight checks for the CMS provider — no test framework required.
 *
 * Run with:  npm run test:cms
 *
 * Covers: org normalization/matching, enrollment URL building, trend
 * normalization, signal extraction, and the unavailable fallback message.
 */
import assert from "node:assert/strict";
import {
  CMS_UNAVAILABLE_EVIDENCE,
  CMS_ORGANIZATIONS,
  computeMaGrowthPct,
  enrollmentDataUrl,
  extractSignalsFromCmsData,
  fetchCmsProspectData,
  looksLikeHealthPlanReference,
  matchOrganization,
  normalizeEnrollmentTrend,
  normalizeOrganizationName,
  type CmsEnrollmentRow,
} from "../lib/providers/cms.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

async function checkAsync(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

async function main() {
  console.log("CMS provider checks:");

  check("normalizeOrganizationName strips suffixes and punctuation", () => {
    assert.equal(normalizeOrganizationName("Humana Inc."), "humana");
    assert.equal(
      normalizeOrganizationName("Blue Cross Blue Shield of Michigan"),
      "blue cross blue shield of michigan",
    );
  });

  check("matchOrganization resolves Humana from free text", () => {
    const m = matchOrganization("PBM consulting for Humana MA plans");
    assert.ok(m);
    assert.equal(m!.org.id, "cms-humana");
    assert.equal(m!.matchedOn, "humana");
  });

  check("matchOrganization resolves UnitedHealthcare aliases", () => {
    const m = matchOrganization("sell to UHC Medicare Advantage");
    assert.ok(m);
    assert.equal(m!.org.id, "cms-uhc");
  });

  check("matchOrganization returns null for generic health plan queries", () => {
    assert.equal(matchOrganization("regional health plans"), null);
    assert.equal(matchOrganization("Medicare Advantage plans in Texas"), null);
  });

  check("enrollmentDataUrl builds filtered data.cms.gov URL", () => {
    const url = enrollmentDataUrl("FL");
    assert.ok(url.includes("d7fabe1e-d19b-4333-9eff-e80e0643f2fd"));
    assert.ok(url.includes("filter%5BBENE_STATE_ABRVTN%5D=FL"));
    assert.ok(url.includes("filter%5BBENE_GEO_LVL%5D=State"));
  });

  check("computeMaGrowthPct calculates YoY change", () => {
    assert.equal(computeMaGrowthPct(1100, 1000), 10);
    assert.equal(computeMaGrowthPct(1000, 0), null);
  });

  check("normalizeEnrollmentTrend derives MA growth from annual rows", () => {
    const rows: CmsEnrollmentRow[] = [
      {
        YEAR: "2025",
        MONTH: "Year",
        BENE_GEO_LVL: "State",
        BENE_STATE_ABRVTN: "FL",
        BENE_STATE_DESC: "Florida",
        MA_AND_OTH_BENES: "2200000",
        PRSCRPTN_DRUG_MAPD_BENES: "900000",
        PRSCRPTN_DRUG_PDP_BENES: "400000",
        PRSCRPTN_DRUG_TOT_BENES: "1300000",
      },
      {
        YEAR: "2024",
        MONTH: "Year",
        BENE_GEO_LVL: "State",
        BENE_STATE_ABRVTN: "FL",
        BENE_STATE_DESC: "Florida",
        MA_AND_OTH_BENES: "2000000",
      },
    ];
    const trend = normalizeEnrollmentTrend("FL", rows);
    assert.ok(trend);
    assert.equal(trend!.maGrowthPct, 10);
    assert.equal(trend!.state, "FL");
    assert.equal(trend!.maEnrollmentCurrent, 2200000);
  });

  check("extractSignalsFromCmsData emits MA growth and Part D signals", () => {
    const humana = CMS_ORGANIZATIONS.find((o) => o.id === "cms-humana")!;
    const signals = extractSignalsFromCmsData({
      org: humana,
      enrollmentTrend: {
        state: "FL",
        stateName: "Florida",
        currentYear: 2025,
        priorYear: 2024,
        maEnrollmentCurrent: 2100000,
        maEnrollmentPrior: 2000000,
        maGrowthPct: 5,
        partDMapdCurrent: 800000,
        partDPdpCurrent: 300000,
        partDTotalCurrent: 1100000,
      },
      dataFreshnessDays: 30,
    });

    const ids = signals.map((s) => s.id);
    assert.ok(ids.includes("cms-ma-enrollment-growth"));
    assert.ok(ids.includes("cms-part-d-exposure"));
    assert.ok(ids.includes("cms-regional-plan-presence"));
    assert.ok(ids.includes("cms-contract-concentration"));
    assert.ok(ids.includes("cms-star-ratings-pressure"));
    assert.equal(signals[0].source, "CMS");
    assert.ok(signals[0].evidenceText.includes("Medicare Monthly Enrollment"));
  });

  check("extractSignalsFromCmsData includes parent org relationship", () => {
    const uhc = CMS_ORGANIZATIONS.find((o) => o.id === "cms-uhc")!;
    const signals = extractSignalsFromCmsData({ org: uhc, dataFreshnessDays: 45 });
    assert.ok(signals.some((s) => s.id === "cms-parent-org-relationship"));
    const parent = signals.find((s) => s.id === "cms-parent-org-relationship");
    assert.ok(parent!.evidenceText.includes("UnitedHealth Group"));
  });

  check("looksLikeHealthPlanReference gates CMS network calls", () => {
    assert.equal(looksLikeHealthPlanReference("Humana"), true);
    assert.equal(looksLikeHealthPlanReference("regional health plans"), false);
  });

  check("CMS unavailable evidence matches fallback contract", () => {
    assert.equal(
      CMS_UNAVAILABLE_EVIDENCE,
      "unavailable — showing mock health plan signals",
    );
  });

  await checkAsync(
    "fetchCmsProspectData throws on API failure (orchestrator catches)",
    async () => {
      const badFetch = async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      });

      await assert.rejects(
        () =>
          fetchCmsProspectData("Humana Medicare", "any", {
            fetchImpl: badFetch,
          }),
        /CMS enrollment API returned 503/,
      );
    },
  );

  await checkAsync(
    "fetchCmsProspectData succeeds with mocked enrollment API",
    async () => {
      const mockRows: CmsEnrollmentRow[] = [
        {
          YEAR: "2025",
          MONTH: "Year",
          BENE_GEO_LVL: "State",
          BENE_STATE_ABRVTN: "FL",
          BENE_STATE_DESC: "Florida",
          MA_AND_OTH_BENES: "2100000",
          PRSCRPTN_DRUG_MAPD_BENES: "800000",
          PRSCRPTN_DRUG_PDP_BENES: "300000",
          PRSCRPTN_DRUG_TOT_BENES: "1100000",
        },
        {
          YEAR: "2024",
          MONTH: "Year",
          BENE_GEO_LVL: "State",
          BENE_STATE_ABRVTN: "FL",
          BENE_STATE_DESC: "Florida",
          MA_AND_OTH_BENES: "2000000",
        },
      ];

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => mockRows,
      });

      const result = await fetchCmsProspectData("Humana", "southeast", {
        fetchImpl: mockFetch,
      });
      assert.ok(result);
      assert.equal(result!.match.org.id, "cms-humana");
      assert.ok(result!.signals.length >= 4);
      assert.ok(result!.enrollmentTrend);
    },
  );

  console.log(`\nAll ${passed} CMS provider checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
