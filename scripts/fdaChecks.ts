/**
 * Lightweight checks for the FDA / openFDA provider.
 *
 * Run with:  npm run test:fda
 *
 * Uses mocked openFDA JSON fixtures — no network calls.
 */
import assert from "node:assert/strict";
import {
  FDA_UNAVAILABLE_EVIDENCE,
  buildFirmEnforcementSearch,
  buildGenericEnforcementSearch,
  enforcementSearchUrl,
  extractSignalsFromRecalls,
  fetchFdaProspects,
  isEmployerFdaScopedQuery,
  isFdaScopedQuery,
  matchFdaFirm,
  parseFdaSearchCriteria,
  resolveFdaApiKey,
} from "../lib/providers/fda.ts";

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

const FOOD_RECALL = {
  results: [
    {
      recalling_firm: "General Mills, Inc.",
      product_description: "Cheerios cereal 18 oz box",
      reason_for_recall:
        "Possible Salmonella contamination linked to packaging line",
      classification: "Class II",
      recall_initiation_date: "20260501",
      report_date: "20260515",
      city: "Minneapolis",
      state: "MN",
      event_id: "food-1",
    },
  ],
};

const DRUG_RECALL = {
  results: [
    {
      recalling_firm: "Pfizer Inc.",
      product_description: "Prescription tablets 100mg",
      reason_for_recall: "Labeling issue with incorrect dosage instructions",
      classification: "Class II",
      recall_initiation_date: "20260420",
      report_date: "20260501",
      city: "New York",
      state: "NY",
      event_id: "drug-1",
    },
  ],
};

const DEVICE_RECALL = {
  results: [
    {
      recalling_firm: "Medtronic Inc.",
      product_description: "Cardiac rhythm management device",
      reason_for_recall:
        "Manufacturing quality deviation may cause device failure; product safety risk",
      classification: "Class I",
      recall_initiation_date: "20260310",
      report_date: "20260325",
      city: "Minneapolis",
      state: "MN",
      event_id: "device-1",
    },
  ],
};

const GENERIC_FOOD = {
  results: [
    {
      recalling_firm: "Sample Foods LLC",
      reason_for_recall: "Undeclared allergen labeling issue on packaging",
      classification: "Class II",
      recall_initiation_date: "20260505",
      report_date: "20260520",
      city: "Austin",
      state: "TX",
      event_id: "generic-1",
    },
    {
      recalling_firm: "Other Brand Co",
      reason_for_recall: "Unrelated recall",
      classification: "Class III",
      recall_initiation_date: "20250101",
      report_date: "20250115",
      city: "Denver",
      state: "CO",
      event_id: "generic-2",
    },
  ],
};

function mockFetchForFirm(firm: string) {
  return async (url: string) => {
    if (url.includes("/food/enforcement") && /general/i.test(firm)) {
      return { ok: true, status: 200, json: async () => FOOD_RECALL };
    }
    if (url.includes("/drug/enforcement") && /pfizer/i.test(firm)) {
      return { ok: true, status: 200, json: async () => DRUG_RECALL };
    }
    if (url.includes("/device/enforcement") && /medtronic/i.test(firm)) {
      return { ok: true, status: 200, json: async () => DEVICE_RECALL };
    }
    if (url.includes("/food/enforcement") && url.includes("reason_for_recall")) {
      return { ok: true, status: 200, json: async () => GENERIC_FOOD };
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: { code: "NOT_FOUND", message: "No matches" } }),
    };
  };
}

async function main() {
  console.log("FDA provider checks:");

  check("matchFdaFirm resolves General Mills for manufacturers", () => {
    const match = matchFdaFirm("General Mills packaging", "manufacturers");
    assert.ok(match);
    assert.equal(match!.firm.id, "fda-general-mills");
  });

  check("matchFdaFirm resolves Medtronic for health-systems", () => {
    const match = matchFdaFirm("Medtronic device supply", "health-systems");
    assert.ok(match);
    assert.equal(match!.firm.id, "fda-medtronic");
  });

  check("matchFdaFirm returns null for unrelated queries", () => {
    assert.equal(matchFdaFirm("regional manufacturers", "manufacturers"), null);
    assert.equal(matchFdaFirm("Humana", "health-plans"), null);
  });

  check("isFdaScopedQuery enables manufacturers with category keywords", () => {
    assert.equal(isFdaScopedQuery("food packaging manufacturers", "manufacturers"), true);
    assert.equal(isFdaScopedQuery("regional manufacturers", "manufacturers"), true);
  });

  check("isFdaScopedQuery excludes health-plans by default", () => {
    assert.equal(isFdaScopedQuery("Humana drug recall", "health-plans"), false);
  });

  check("isFdaScopedQuery gates health-systems to relevant queries", () => {
    assert.equal(isFdaScopedQuery("medical device recall supply", "health-systems"), true);
    assert.equal(isFdaScopedQuery("regional hospitals", "health-systems"), false);
  });

  check("isEmployerFdaScopedQuery requires supply-chain keywords", () => {
    assert.equal(
      isEmployerFdaScopedQuery("large employer", "employee food benefits"),
      true,
    );
    assert.equal(isEmployerFdaScopedQuery("tech employer", "software"), false);
  });

  check("buildFirmEnforcementSearch quotes recalling firm", () => {
    assert.equal(
      buildFirmEnforcementSearch("General Mills"),
      'recalling_firm:"General Mills"',
    );
  });

  check("parseFdaSearchCriteria extracts packaging and contamination terms", () => {
    const criteria = parseFdaSearchCriteria("food packaging contamination recall");
    assert.ok(criteria.domains.includes("food"));
    assert.ok(criteria.reasonTerms.includes("packaging"));
    assert.ok(criteria.reasonTerms.includes("contamination"));
  });

  check("buildGenericEnforcementSearch joins reason terms with OR", () => {
    const search = buildGenericEnforcementSearch({
      domains: ["food"],
      reasonTerms: ["packaging", "contamination"],
    });
    assert.ok(search.includes("reason_for_recall:packaging"));
    assert.ok(search.includes("+OR+"));
  });

  check("enforcementSearchUrl appends optional api_key", () => {
    const url = enforcementSearchUrl("food", "recalling_firm:test", {
      apiKey: "test-key",
    });
    assert.ok(url.includes("api_key=test-key"));
  });

  check("resolveFdaApiKey prefers opts over env", () => {
    const prior = process.env.FDA_API_KEY;
    process.env.FDA_API_KEY = "env-key";
    assert.equal(resolveFdaApiKey({ apiKey: "opt-key" }), "opt-key");
    assert.equal(resolveFdaApiKey(), "env-key");
    if (prior === undefined) delete process.env.FDA_API_KEY;
    else process.env.FDA_API_KEY = prior;
  });

  check("extractSignalsFromRecalls detects food recall and contamination", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const signals = extractSignalsFromRecalls(FOOD_RECALL.results, "food", now);
    const ids = signals.map((s) => s.id);
    assert.ok(ids.includes("fda-food-recall"));
    assert.ok(ids.includes("fda-packaging-contamination"));
    assert.equal(signals[0].source, "FDA");
  });

  check("extractSignalsFromRecalls detects drug recall and labeling issue", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const signals = extractSignalsFromRecalls(DRUG_RECALL.results, "drug", now);
    const ids = signals.map((s) => s.id);
    assert.ok(ids.includes("fda-drug-recall"));
    assert.ok(ids.includes("fda-labeling-issue"));
  });

  check("extractSignalsFromRecalls detects device recall and quality/safety", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const signals = extractSignalsFromRecalls(DEVICE_RECALL.results, "device", now);
    const ids = signals.map((s) => s.id);
    assert.ok(ids.includes("fda-device-recall"));
    assert.ok(ids.includes("fda-manufacturing-quality"));
    assert.ok(ids.includes("fda-product-safety"));
    assert.ok(signals.some((s) => s.strength === "strong"));
  });

  check("FDA unavailable evidence matches fallback contract", () => {
    assert.equal(
      FDA_UNAVAILABLE_EVIDENCE,
      "unavailable — showing mock regulatory signals",
    );
  });

  await checkAsync("fetchFdaProspects returns General Mills food recall signals", async () => {
    const { results, allSourcesFailed } = await fetchFdaProspects(
      "General Mills",
      "manufacturers",
      { fetchImpl: mockFetchForFirm("General Mills") },
    );
    assert.equal(allSourcesFailed, false);
    assert.equal(results.length, 1);
    assert.equal(results[0].firm.id, "fda-general-mills");
    assert.ok(results[0].signals.some((s) => s.id === "fda-food-recall"));
  });

  await checkAsync("fetchFdaProspects returns Pfizer drug recall signals", async () => {
    const { results } = await fetchFdaProspects("Pfizer pharmaceutical", "manufacturers", {
      fetchImpl: mockFetchForFirm("Pfizer"),
    });
    assert.equal(results.length, 1);
    assert.ok(results[0].signals.some((s) => s.id === "fda-drug-recall"));
  });

  await checkAsync("fetchFdaProspects returns Medtronic device recall for health-systems", async () => {
    const { results } = await fetchFdaProspects(
      "Medtronic medical device",
      "health-systems",
      { fetchImpl: mockFetchForFirm("Medtronic") },
    );
    assert.equal(results.length, 1);
    assert.ok(results[0].signals.some((s) => s.id === "fda-device-recall"));
  });

  await checkAsync(
    "fetchFdaProspects returns allSourcesFailed when API finds nothing",
    async () => {
      const { results, allSourcesFailed } = await fetchFdaProspects(
        "General Mills",
        "manufacturers",
        {
          fetchImpl: async () => ({
            ok: false,
            status: 404,
            json: async () => ({ error: { code: "NOT_FOUND" } }),
          }),
        },
      );
      assert.equal(results.length, 0);
      assert.equal(allSourcesFailed, true);
    },
  );

  await checkAsync(
    "fetchFdaProspects handles generic packaging recall search",
    async () => {
      const { results } = await fetchFdaProspects(
        "food packaging contamination manufacturers",
        "manufacturers",
        { fetchImpl: mockFetchForFirm("generic") },
      );
      assert.ok(results.length > 0);
      assert.ok(
        results[0].signals.some((s) => s.id === "fda-packaging-contamination"),
      );
    },
  );

  console.log(`\nAll ${passed} FDA provider checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
