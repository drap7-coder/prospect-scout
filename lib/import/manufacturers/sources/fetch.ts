import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import type { CatalogRecord } from "@/lib/discovery/catalog/types";
import { productionManufacturerImportPaths } from "../fixtures";
import type { ManufacturerSourceFetchStats } from "../types";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "ProspectScout/1.0 (manufacturer warehouse ingestion; contact@prospectscout.local)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

function classifySecCompany(title: string): CatalogRecord["buyerPack"] {
  const t = title.toLowerCase();
  if (/\b(bank|bancorp|insur)\b/.test(t)) return "employers";
  if (
    /\b(pharm|therapeut|biotech|device|surgical|medical|manufactur|industrial|steel|automotive|packaging|chemical|aerospace|machin|food|beverage)\b/.test(
      t,
    )
  ) {
    return "manufacturers";
  }
  return "employers";
}

function secClassification(title: string): Pick<
  CatalogRecord,
  "sectorId" | "industries" | "organizationType" | "buyerPack"
> {
  const t = title.toLowerCase();
  if (/\b(pharm|therapeut|biotech|medicin|diagnostic)\b/.test(t)) {
    return {
      sectorId: "manufacturing",
      industries: ["pharma-manufacturing", "life-sciences"],
      organizationType: "pharma-manufacturer",
      buyerPack: "manufacturers",
    };
  }
  if (/\b(device|surgical|orthopedic|medical)\b/.test(t)) {
    return {
      sectorId: "manufacturing",
      industries: ["medical-device-manufacturing"],
      organizationType: "medical-device",
      buyerPack: "manufacturers",
    };
  }
  if (/\b(food|beverage|brewer)\b/.test(t)) {
    return {
      sectorId: "manufacturing",
      industries: ["food-beverage"],
      organizationType: "food-beverage-company",
      buyerPack: "manufacturers",
    };
  }
  return {
    sectorId: "manufacturing",
    industries: ["industrial-products"],
    organizationType: "manufacturer",
    buyerPack: "manufacturers",
  };
}

async function fetchSecManufacturerRecords(): Promise<CatalogRecord[]> {
  const body = (await fetchJson("https://www.sec.gov/files/company_tickers.json")) as Record<
    string,
    { cik_str: number; ticker: string; title: string }
  >;
  const today = new Date().toISOString().slice(0, 10);
  const records: CatalogRecord[] = [];

  for (const entry of Object.values(body)) {
    if (classifySecCompany(entry.title) !== "manufacturers") continue;
    const classification = secClassification(entry.title);
    records.push({
      sourceId: String(entry.cik_str),
      name: entry.title.trim(),
      sectorId: classification.sectorId,
      industries: classification.industries,
      organizationType: classification.organizationType,
      ownership: "public",
      buyerPack: "manufacturers",
      aliases: [entry.ticker],
      metadata: {
        sourceName: "SEC company_tickers",
        sourceUrl: "https://www.sec.gov/files/company_tickers.json",
        lastUpdated: today,
        confidence: 0.88,
      },
    });
  }

  return records;
}

async function fetchFdaEstablishmentRecords(): Promise<CatalogRecord[]> {
  const today = new Date().toISOString().slice(0, 10);
  const deviceMeta = {
    sourceName: "openFDA Device Registration Listing",
    sourceUrl: "https://open.fda.gov/apis/device/registrationlisting/",
    lastUpdated: today,
    confidence: 0.86,
  };
  const drugMeta = {
    sourceName: "openFDA Drug Establishment Registration",
    sourceUrl: "https://open.fda.gov/apis/drug/drugregistration/",
    lastUpdated: today,
    confidence: 0.86,
  };

  const records: CatalogRecord[] = [];
  const states = ["OH", "PA", "MI", "TX", "CA", "IN", "IL", "NY", "FL", "GA"];

  for (const state of states) {
    const url = `https://api.fda.gov/device/registrationlisting.json?search=registration.state_code:${state}&limit=200`;
    try {
      const body = (await fetchJson(url)) as {
        results?: {
          registration?: {
            name?: string;
            registration_number?: string;
            city?: string;
            state_code?: string;
          };
        }[];
      };
      for (const row of body.results ?? []) {
        const reg = row.registration;
        if (!reg?.name || !reg.registration_number) continue;
        records.push({
          sourceId: `dev-${reg.registration_number}`,
          name: reg.name.trim(),
          state: reg.state_code ?? state,
          city: reg.city,
          sectorId: "manufacturing",
          industries: ["medical-device-manufacturing"],
          organizationType: "medical-device",
          ownership: "private",
          buyerPack: "manufacturers",
          metadata: deviceMeta,
        });
      }
    } catch {
      // non-fatal per state
    }
  }

  try {
    const body = (await fetchJson(
      "https://api.fda.gov/drug/drugregistration.json?limit=500",
    )) as {
      results?: {
        establishment?: {
          name?: string;
          fei_number?: string;
          city?: string;
          state?: string;
        };
      }[];
    };
    for (const row of body.results ?? []) {
      const est = row.establishment;
      if (!est?.name || !est.fei_number) continue;
      records.push({
        sourceId: `drug-${est.fei_number}`,
        name: est.name.trim(),
        state: est.state,
        city: est.city,
        sectorId: "manufacturing",
        industries: ["pharma-manufacturing"],
        organizationType: "pharma-manufacturer",
        ownership: "private",
        buyerPack: "manufacturers",
        metadata: drugMeta,
      });
    }
  } catch {
    // non-fatal
  }

  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Download manufacturer source snapshots for the warehouse import pipeline. */
export async function fetchManufacturerWarehouseData(
  paths = productionManufacturerImportPaths(),
): Promise<ManufacturerSourceFetchStats> {
  mkdirSync(paths.secJson.replace(/[^/]+$/, ""), { recursive: true });

  const sec = await fetchSecManufacturerRecords();
  const fda = await fetchFdaEstablishmentRecords();

  writeFileSync(paths.secJson, JSON.stringify(sec, null, 2), "utf8");
  writeFileSync(paths.fdaJson, JSON.stringify(fda, null, 2), "utf8");

  const stats: ManufacturerSourceFetchStats = {
    fetchedAt: new Date().toISOString(),
    secManufacturerRecords: sec.length,
    fdaRecords: fda.length,
  };

  writeFileSync(
    paths.secJson.replace("sec-manufacturers.json", "manifest.json"),
    JSON.stringify({ ...stats, paths }, null, 2),
    "utf8",
  );

  return stats;
}

/** Build fixture snapshots from bundled catalog JSON (offline/tests). */
export function writeManufacturerFixturesFromCatalog(
  secRecords: CatalogRecord[],
  fdaRecords: CatalogRecord[],
  paths = productionManufacturerImportPaths(),
): void {
  if (!existsSync(paths.secJson.replace(/[^/]+$/, ""))) {
    mkdirSync(paths.secJson.replace(/[^/]+$/, ""), { recursive: true });
  }
  writeFileSync(paths.secJson, JSON.stringify(secRecords, null, 2), "utf8");
  writeFileSync(paths.fdaJson, JSON.stringify(fdaRecords, null, 2), "utf8");
}
