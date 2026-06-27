/**
 * Fetch public datasets and write catalog JSON snapshots under lib/discovery/data/.
 * Run: node --import tsx scripts/ingestCatalogData.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogManifest, CatalogRecord, CatalogSourceMetadata } from "../lib/discovery/catalog/types.ts";
import { CMS_ORGANIZATIONS } from "../lib/providers/cms.ts";
import { FDA_FIRM_REGISTRY } from "../lib/providers/fda.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../lib/discovery/data");

const TODAY = new Date().toISOString().slice(0, 10);

function meta(
  sourceName: string,
  sourceUrl: string,
  confidence: number,
): CatalogSourceMetadata {
  return { sourceName, sourceUrl, lastUpdated: TODAY, confidence };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "User-Agent": "ProspectScout/1.0 (catalog ingest; contact@prospectscout.local)",
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }
  throw new Error(`Rate limited after retries for ${url}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ingestFdicBanks(): Promise<CatalogRecord[]> {
  const records: CatalogRecord[] = [];
  const limit = 1000;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `https://banks.data.fdic.gov/api/institutions?filters=ACTIVE:1&fields=NAME,STALP,CITY,WEBADDR,CERT&limit=${limit}&offset=${offset}`;
    const body = (await fetchJson(url)) as {
      meta?: { total?: number };
      data?: { data: { NAME: string; STALP: string; CITY: string; WEBADDR: string; CERT: number } }[];
    };
    total = body.meta?.total ?? 0;
    const batch = body.data ?? [];
    if (batch.length === 0) break;

    for (const row of batch) {
      const d = row.data;
      records.push({
        sourceId: String(d.CERT),
        name: d.NAME.trim(),
        state: d.STALP,
        city: d.CITY?.trim(),
        website: d.WEBADDR?.trim() || undefined,
        sectorId: "financial-services",
        industries: ["banks"],
        organizationType: "bank",
        ownership: "private",
        buyerPack: "employers",
        metadata: meta(
          "FDIC Institution Directory",
          "https://banks.data.fdic.gov/docs/",
          0.95,
        ),
      });
    }
    offset += batch.length;
    if (batch.length < limit) break;
  }

  return records;
}

async function ingestIpedsDirectory(): Promise<CatalogRecord[]> {
  const sourceMeta = meta(
    "NCES IPEDS Directory",
    "https://educationdata.urban.org/documentation/",
    0.92,
  );
  const body = (await fetchJson(
    "https://educationdata.urban.org/api/v1/college-university/ipeds/directory/2022/",
  )) as {
    results?: {
      unitid: number;
      inst_name: string;
      city: string;
      state_abbr: string;
      url_school?: string;
      institution_level?: number;
      sector?: number;
    }[];
  };

  return (body.results ?? []).map((row) => {
    const isCommunity = row.institution_level === 2 || row.sector === 4 || row.sector === 6;
    const isUniversity =
      row.institution_level === 4 ||
      row.sector === 1 ||
      row.sector === 2 ||
      row.sector === 3;
    return {
      sourceId: String(row.unitid),
      name: row.inst_name.trim(),
      state: row.state_abbr,
      city: row.city,
      website: row.url_school
        ? row.url_school.startsWith("http")
          ? row.url_school
          : `https://${row.url_school}`
        : undefined,
      sectorId: "education",
      industries: isCommunity
        ? ["community-colleges"]
        : isUniversity
          ? ["universities"]
          : ["universities", "community-colleges"],
      organizationType: isCommunity ? "community-college" : "university",
      ownership: "nonprofit",
      buyerPack: "employers",
      metadata: sourceMeta,
    };
  });
}

function classifySecCompany(title: string): Pick<
  CatalogRecord,
  "sectorId" | "industries" | "organizationType" | "buyerPack"
> {
  const t = title.toLowerCase();
  if (/\b(bank|bancorp|bancshares|financial group|savings|trust)\b/.test(t)) {
    return {
      sectorId: "financial-services",
      industries: ["banks"],
      organizationType: "bank",
      buyerPack: "employers",
    };
  }
  if (/\b(insur|reinsur|assur|underwrit)\b/.test(t)) {
    return {
      sectorId: "financial-services",
      industries: ["insurance-carriers"],
      organizationType: "insurance-carrier",
      buyerPack: "employers",
    };
  }
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
  if (
    /\b(manufactur|industrial|steel|automotive|packaging|chemical|aerospace|machin)\b/.test(
      t,
    )
  ) {
    return {
      sectorId: "manufacturing",
      industries: ["industrial-products"],
      organizationType: "manufacturer",
      buyerPack: "manufacturers",
    };
  }
  if (/\b(food|beverage|restaurant|grocery|brewer)\b/.test(t)) {
    return {
      sectorId: "manufacturing",
      industries: ["food-beverage"],
      organizationType: "food-beverage-company",
      buyerPack: "manufacturers",
    };
  }
  if (/\b(retail|store|supermarket|department)\b/.test(t)) {
    return {
      sectorId: "retail-consumer",
      industries: ["retail"],
      organizationType: "employer",
      buyerPack: "employers",
    };
  }
  return {
    sectorId: "technology",
    industries: ["technology"],
    organizationType: "employer",
    buyerPack: "employers",
  };
}

async function ingestSecCompanies(): Promise<CatalogRecord[]> {
  const body = (await fetchJson("https://www.sec.gov/files/company_tickers.json")) as Record<
    string,
    { cik_str: number; ticker: string; title: string }
  >;
  const sourceMeta = meta(
    "SEC company_tickers",
    "https://www.sec.gov/files/company_tickers.json",
    0.88,
  );
  const records: CatalogRecord[] = [];

  for (const entry of Object.values(body)) {
    const classification = classifySecCompany(entry.title);
    // Banks with state come from FDIC; skip SEC bank duplicates when name looks like a bank.
    if (classification.industries.includes("banks")) continue;

    records.push({
      sourceId: String(entry.cik_str),
      name: entry.title.trim(),
      sectorId: classification.sectorId,
      industries: classification.industries,
      organizationType: classification.organizationType,
      ownership: "public",
      buyerPack: classification.buyerPack,
      aliases: [entry.ticker],
      metadata: sourceMeta,
    });
  }

  return records;
}

function ingestCmsOrganizations(): CatalogRecord[] {
  const sourceMeta = meta(
    "CMS Medicare Contract Registry",
    "https://data.cms.gov/",
    0.9,
  );
  const records: CatalogRecord[] = CMS_ORGANIZATIONS.map((org) => ({
    sourceId: org.id.replace(/^cms-/, ""),
    name: org.organizationName,
    states: org.states,
    sectorId: "healthcare",
    industries: ["payers"],
    organizationType: "health-plan",
    ownership: "private",
    buyerPack: "health-plans",
    aliases: org.aliases,
    metadata: sourceMeta,
  }));

  const pbms: CatalogRecord[] = [
    {
      sourceId: "express-scripts",
      name: "Express Scripts (Cigna)",
      state: "MO",
      sectorId: "healthcare",
      industries: ["payers"],
      organizationType: "pbm",
      ownership: "public",
      buyerPack: "health-plans",
      aliases: ["express scripts", "cigna pharmacy"],
      metadata: meta("CMS / public PBM registry", "https://data.cms.gov/", 0.88),
    },
    {
      sourceId: "cvs-caremark",
      name: "CVS Caremark",
      state: "RI",
      sectorId: "healthcare",
      industries: ["payers"],
      organizationType: "pbm",
      ownership: "public",
      buyerPack: "health-plans",
      aliases: ["caremark", "cvs health pbm"],
      metadata: meta("CMS / public PBM registry", "https://data.cms.gov/", 0.88),
    },
    {
      sourceId: "optumrx",
      name: "OptumRx",
      state: "MN",
      sectorId: "healthcare",
      industries: ["payers"],
      organizationType: "pbm",
      ownership: "private",
      buyerPack: "health-plans",
      aliases: ["optum rx", "unitedhealth pharmacy"],
      metadata: meta("CMS / public PBM registry", "https://data.cms.gov/", 0.88),
    },
    {
      sourceId: "prime-therapeutics",
      name: "Prime Therapeutics",
      state: "MN",
      sectorId: "healthcare",
      industries: ["payers"],
      organizationType: "pbm",
      ownership: "private",
      buyerPack: "health-plans",
      aliases: ["prime therapeutics"],
      metadata: meta("CMS / public PBM registry", "https://data.cms.gov/", 0.88),
    },
    {
      sourceId: "humana-pharmacy",
      name: "Humana Pharmacy Solutions",
      state: "KY",
      sectorId: "healthcare",
      industries: ["payers"],
      organizationType: "pbm",
      ownership: "public",
      buyerPack: "health-plans",
      aliases: ["humana pharmacy", "humana pbm"],
      metadata: meta("CMS / public PBM registry", "https://data.cms.gov/", 0.88),
    },
  ];

  return [...records, ...pbms];
}

async function ingestFdaEstablishments(): Promise<CatalogRecord[]> {
  const records: CatalogRecord[] = [];
  const deviceMeta = meta(
    "openFDA Device Registration Listing",
    "https://open.fda.gov/apis/device/registrationlisting/",
    0.86,
  );
  const drugMeta = meta(
    "openFDA Drug Establishment Registration",
    "https://open.fda.gov/apis/drug/drugregistration/",
    0.86,
  );

  for (const firm of FDA_FIRM_REGISTRY) {
    const stateMatch = firm.location.match(/\b([A-Z]{2})\b/);
    records.push({
      sourceId: firm.id.replace(/^fda-/, ""),
      name: firm.firmName,
      state: stateMatch?.[1],
      headquarters: firm.location,
      sectorId: "manufacturing",
      industries: ["food-beverage", "life-sciences"],
      organizationType: "food-beverage-company",
      buyerPack: "manufacturers",
      metadata: meta(
        "FDA Firm Registry",
        "https://www.fda.gov/",
        0.9,
      ),
    });
  }

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
    const drugUrl =
      "https://api.fda.gov/drug/drugregistration.json?limit=500";
    const body = (await fetchJson(drugUrl)) as {
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
  return records.filter((r) => {
    const key = `${r.name.toLowerCase()}|${r.state ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function ingestIrsNonprofits(): Promise<CatalogRecord[]> {
  const records: CatalogRecord[] = [];
  const sourceMeta = meta(
    "IRS Exempt Orgs / ProPublica Nonprofit Explorer",
    "https://projects.propublica.org/nonprofits/api",
    0.85,
  );
  const states = [
    "PA", "OH", "CA", "TX", "NY", "FL", "IL", "MI", "GA", "NC",
    "VA", "WA", "MA", "NJ", "MD", "CO", "AZ", "TN", "IN", "MO",
  ];

  for (const state of states) {
    for (let page = 0; page < 8; page += 1) {
      const url = `https://projects.propublica.org/nonprofits/api/v2/search.json?state%5Bid%5D=${state}&page=${page}`;
      try {
        const body = (await fetchJson(url)) as {
          organizations?: {
            ein: number;
            name: string;
            city: string;
            state: string;
            ntee_code?: string;
          }[];
        };
        const batch = body.organizations ?? [];
        if (batch.length === 0) break;
        for (const org of batch) {
          const isHospital = /\bhospital\b/i.test(org.name) || org.ntee_code?.startsWith("E2");
          records.push({
            sourceId: String(org.ein),
            name: org.name.trim(),
            state: org.state,
            city: org.city,
            sectorId: "nonprofit",
            industries: isHospital ? ["hospitals", "nonprofit"] : ["nonprofit"],
            organizationType: isHospital ? "hospital" : "employer",
            ownership: "nonprofit",
            buyerPack: isHospital ? "health-systems" : "employers",
            metadata: sourceMeta,
          });
        }
      } catch {
        break;
      }
      await sleep(200);
    }
  }

  return records;
}

function writeJson(name: string, data: unknown): number {
  const filePath = path.join(DATA_DIR, name);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data));
  const count = Array.isArray(data) ? data.length : 0;
  console.log(`  wrote ${name} (${count.toLocaleString()} records)`);
  return count;
}

async function main() {
  console.log("Ingesting catalog datasets...\n");

  const fdicBanks = await ingestFdicBanks();
  const ncesSchools = await ingestIpedsDirectory();
  const secCompanies = await ingestSecCompanies();
  const cmsOrgs = ingestCmsOrganizations();
  const fdaEstablishments = await ingestFdaEstablishments();
  const irsNonprofits = await ingestIrsNonprofits();

  writeJson("sec-banks.json", fdicBanks);
  writeJson("nces-schools.json", ncesSchools);
  writeJson("sec-companies.json", secCompanies);
  writeJson("cms-organizations.json", cmsOrgs);
  writeJson("fda-establishments.json", fdaEstablishments);
  writeJson("irs-nonprofits.json", irsNonprofits);

  const manifest: CatalogManifest = {
    generatedAt: new Date().toISOString(),
    datasets: [
      {
        connectorId: "nces",
        label: "NCES / IPEDS",
        sourceName: "NCES IPEDS Directory",
        sourceUrl: "https://nces.ed.gov/ipeds/",
        lastUpdated: TODAY,
        recordCount: ncesSchools.length,
        confidence: 0.92,
      },
      {
        connectorId: "sec",
        label: "SEC / FDIC",
        sourceName: "SEC company_tickers + FDIC banks",
        sourceUrl: "https://www.sec.gov/",
        lastUpdated: TODAY,
        recordCount: fdicBanks.length + secCompanies.length,
        confidence: 0.9,
      },
      {
        connectorId: "cms",
        label: "CMS",
        sourceName: "CMS Medicare Contract Registry",
        sourceUrl: "https://data.cms.gov/",
        lastUpdated: TODAY,
        recordCount: cmsOrgs.length,
        confidence: 0.9,
      },
      {
        connectorId: "fda",
        label: "FDA",
        sourceName: "openFDA + FDA firm registry",
        sourceUrl: "https://open.fda.gov/",
        lastUpdated: TODAY,
        recordCount: fdaEstablishments.length,
        confidence: 0.86,
      },
      {
        connectorId: "irs-nonprofits",
        label: "IRS Nonprofits",
        sourceName: "IRS EO BMF via ProPublica",
        sourceUrl: "https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-eo-bmf",
        lastUpdated: TODAY,
        recordCount: irsNonprofits.length,
        confidence: 0.85,
      },
    ],
  };

  writeJson("catalog-manifest.json", manifest);

  const total =
    fdicBanks.length +
    ncesSchools.length +
    secCompanies.length +
    cmsOrgs.length +
    fdaEstablishments.length +
    irsNonprofits.length;
  console.log(`\nTotal catalog records: ${total.toLocaleString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
