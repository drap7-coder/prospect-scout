/**
 * Lightweight checks for the CMS provider — no test framework required.
 *
 * Run with:  npm run test:cms
 *
 * Covers: org normalization/matching, enrollment URL building, trend
 * normalization, signal extraction, generic search criteria, and fallback.
 */
import assert from "node:assert/strict";
import {
  CMS_UNAVAILABLE_EVIDENCE,
  CMS_ORGANIZATIONS,
  computeMaGrowthPct,
  enrollmentDataUrl,
  extractSignalsFromCmsData,
  fetchCmsProspectData,
  fetchCmsProspects,
  inferStatesFromText,
  isHealthPlanScopedQuery,
  looksLikeHealthPlanReference,
  matchOrganization,
  normalizeEnrollmentTrend,
  normalizeOrganizationName,
  parseCmsSearchCriteria,
  rankOrganizationsByCriteria,
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

const mockEnrollmentFetch = (rowsByState: Record<string, CmsEnrollmentRow[]>) =>
  async (url: string) => {
    const stateMatch = url.match(/BENE_STATE_ABRVTN%5D=([A-Z]{2})/);
    const state = stateMatch?.[1] ?? "FL";
    return {
      ok: true,
      status: 200,
      json: async () => rowsByState[state] ?? [],
    };
  };

const FL_ROWS: CmsEnrollmentRow[] = [
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

const PA_ROWS: CmsEnrollmentRow[] = [
  {
    YEAR: "2025",
    MONTH: "Year",
    BENE_GEO_LVL: "State",
    BENE_STATE_ABRVTN: "PA",
    BENE_STATE_DESC: "Pennsylvania",
    MA_AND_OTH_BENES: "1100000",
    PRSCRPTN_DRUG_MAPD_BENES: "500000",
    PRSCRPTN_DRUG_PDP_BENES: "200000",
    PRSCRPTN_DRUG_TOT_BENES: "700000",
  },
  {
    YEAR: "2024",
    MONTH: "Year",
    BENE_GEO_LVL: "State",
    BENE_STATE_ABRVTN: "PA",
    BENE_STATE_DESC: "Pennsylvania",
    MA_AND_OTH_BENES: "1050000",
  },
];

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

  check("inferStatesFromText finds Pennsylvania", () => {
    assert.deepEqual(inferStatesFromText("regional health plans in Pennsylvania"), ["PA"]);
  });

  check("parseCmsSearchCriteria detects Part D and Blues filters", () => {
    const partD = parseCmsSearchCriteria("health plans with Part D exposure");
    assert.equal(partD.requirePartD, true);
    const blues = parseCmsSearchCriteria("Blues plans in the Midwest", "midwest");
    assert.equal(blues.requireBlues, true);
    assert.equal(blues.region, "midwest");
  });

  check("rankOrganizationsByCriteria: regional health plans in Pennsylvania", () => {
    const criteria = parseCmsSearchCriteria("regional health plans in Pennsylvania");
    const ranked = rankOrganizationsByCriteria(criteria);
    assert.ok(ranked.length > 0);
    assert.ok(ranked.every((r) => r.org.states.includes("PA")));
    assert.ok(ranked.some((r) => r.org.id === "cms-highmark" || r.org.id === "cms-ibx"));
  });

  check("rankOrganizationsByCriteria: Medicare Advantage plans in the Mid-Atlantic", () => {
    const criteria = parseCmsSearchCriteria("Medicare Advantage plans in the Mid-Atlantic");
    assert.equal(criteria.region, "mid-atlantic");
    const ranked = rankOrganizationsByCriteria(criteria);
    assert.ok(ranked.length > 0);
    const midAtlanticStates = new Set(["PA", "NJ", "NY", "DE", "MD", "DC", "VA", "WV"]);
    assert.ok(
      ranked.every((r) => r.org.states.some((s) => midAtlanticStates.has(s))),
    );
  });

  check("rankOrganizationsByCriteria: health plans with Part D exposure", () => {
    const criteria = parseCmsSearchCriteria("health plans with Part D exposure");
    const ranked = rankOrganizationsByCriteria(criteria);
    assert.ok(ranked.length > 0);
    assert.ok(ranked.every((r) => r.org.partDExposure !== "none"));
  });

  check("rankOrganizationsByCriteria: Blues plans in the Midwest", () => {
    const criteria = parseCmsSearchCriteria("Blues plans in the Midwest", "midwest");
    const ranked = rankOrganizationsByCriteria(criteria);
    assert.ok(ranked.length > 0);
    assert.ok(ranked.every((r) => r.org.tags?.includes("blues") || r.org.organizationName.includes("Blue")));
    const midwestStates = new Set(["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"]);
    assert.ok(
      ranked.every((r) => r.org.states.some((s) => midwestStates.has(s))),
    );
  });

  check("isHealthPlanScopedQuery enables generic health-plan CMS searches", () => {
    assert.equal(isHealthPlanScopedQuery("Humana"), true);
    assert.equal(
      isHealthPlanScopedQuery("regional health plans in Pennsylvania"),
      true,
    );
    assert.equal(isHealthPlanScopedQuery("food manufacturers"), false);
  });

  check("looksLikeHealthPlanReference still gates named org tokens", () => {
    assert.equal(looksLikeHealthPlanReference("Humana"), true);
    assert.equal(looksLikeHealthPlanReference("regional health plans"), false);
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
    const trend = normalizeEnrollmentTrend("FL", FL_ROWS);
    assert.ok(trend);
    assert.equal(trend!.maGrowthPct, 5);
    assert.equal(trend!.state, "FL");
    assert.equal(trend!.maEnrollmentCurrent, 2100000);
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

  await checkAsync("fetchCmsProspectData succeeds for named Humana match", async () => {
    const result = await fetchCmsProspectData("Humana", "southeast", {
      fetchImpl: mockEnrollmentFetch({ FL: FL_ROWS }),
    });
    assert.ok(result);
    assert.equal(result!.match.org.id, "cms-humana");
    assert.equal(result!.confidence, "named");
    assert.ok(result!.signals.length >= 4);
    assert.ok(result!.enrollmentTrend);
  });

  await checkAsync(
    "fetchCmsProspects returns multiple PA plans for generic Pennsylvania query",
    async () => {
      const results = await fetchCmsProspects(
        "regional health plans in Pennsylvania",
        "any",
        { fetchImpl: mockEnrollmentFetch({ PA: PA_ROWS, FL: FL_ROWS }) },
      );
      assert.ok(results.length >= 2);
      assert.ok(results.every((r) => r.confidence === "criteria"));
      assert.ok(results.every((r) => r.match.org.states.includes("PA")));
    },
  );

  await checkAsync(
    "fetchCmsProspects returns Blues Midwest matches",
    async () => {
      const MI_ROWS: CmsEnrollmentRow[] = [
        {
          YEAR: "2025",
          MONTH: "Year",
          BENE_GEO_LVL: "State",
          BENE_STATE_ABRVTN: "MI",
          BENE_STATE_DESC: "Michigan",
          MA_AND_OTH_BENES: "600000",
          PRSCRPTN_DRUG_MAPD_BENES: "250000",
          PRSCRPTN_DRUG_PDP_BENES: "100000",
          PRSCRPTN_DRUG_TOT_BENES: "350000",
        },
        {
          YEAR: "2024",
          MONTH: "Year",
          BENE_GEO_LVL: "State",
          BENE_STATE_ABRVTN: "MI",
          MA_AND_OTH_BENES: "580000",
        },
      ];
      const IL_ROWS: CmsEnrollmentRow[] = [
        {
          YEAR: "2025",
          MONTH: "Year",
          BENE_GEO_LVL: "State",
          BENE_STATE_ABRVTN: "IL",
          BENE_STATE_DESC: "Illinois",
          MA_AND_OTH_BENES: "900000",
          PRSCRPTN_DRUG_MAPD_BENES: "400000",
          PRSCRPTN_DRUG_PDP_BENES: "150000",
          PRSCRPTN_DRUG_TOT_BENES: "550000",
        },
        {
          YEAR: "2024",
          MONTH: "Year",
          BENE_GEO_LVL: "State",
          BENE_STATE_ABRVTN: "IL",
          MA_AND_OTH_BENES: "870000",
        },
      ];
      const results = await fetchCmsProspects("Blues plans in the Midwest", "midwest", {
        fetchImpl: mockEnrollmentFetch({ MI: MI_ROWS, IL: IL_ROWS, IN: IL_ROWS }),
      });
      assert.ok(results.length > 0);
      assert.ok(results.some((r) => r.match.org.id === "cms-bcbs-mi"));
    },
  );

  console.log(`\nAll ${passed} CMS provider checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
