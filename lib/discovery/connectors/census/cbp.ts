import type { CbpApiRow, CbpQueryParams, MarketSizeGeography } from "./types";
import {
  normalizeCountyFips,
  normalizeZip,
  postalToStateFips,
  STATE_FIPS_TO_POSTAL,
} from "./fips";
import { normalizeNaicsCode } from "./naics";

const CBP_BASE = "https://api.census.gov/data";

/** Build a CBP API URL for the given geography and NAICS. */
export function buildCbpUrl(input: {
  year: number;
  apiKey: string;
  params: CbpQueryParams;
}): string {
  const { year, apiKey, params } = input;
  const naics = normalizeNaicsCode(params.naics);
  const search = new URLSearchParams({
    get: "NAME,NAICS2017_LABEL,ESTAB,PAYANN,PAYQTR1,EMP",
    NAICS2017: naics,
    LFO: "001",
    EMPSZES: "001",
    key: apiKey,
  });

  const zip = normalizeZip(params.zip);
  const countyFips = normalizeCountyFips(params.countyFips);
  const stateFips = params.stateFips ?? null;

  if (zip) {
    search.set("for", `zip code:${zip}`);
  } else if (stateFips && countyFips) {
    search.set("for", `county:${countyFips}`);
    search.set("in", `state:${stateFips}`);
  } else if (stateFips) {
    search.set("for", `state:${stateFips}`);
  } else {
    search.set("for", "us:*");
  }

  return `${CBP_BASE}/${year}/cbp?${search.toString()}`;
}

/** Parse Census JSON matrix response into typed rows (excluding header). */
export function parseCbpResponse(json: unknown): CbpApiRow[] {
  if (!Array.isArray(json) || json.length < 2) return [];
  const [header, ...rows] = json as [string[], ...string[][]];
  if (!Array.isArray(header)) return [];
  return rows.map((row) => row as CbpApiRow);
}

function parseIntField(value: string | undefined): number | null {
  if (value == null || value === "" || value === "N") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Aggregate CBP rows (sum establishments, employment, payroll). */
export function aggregateCbpRows(rows: CbpApiRow[]): {
  estimatedEstablishments: number | null;
  employment: number | null;
  annualPayroll: number | null;
  naicsDescription: string | null;
  name: string | null;
} {
  if (rows.length === 0) {
    return {
      estimatedEstablishments: null,
      employment: null,
      annualPayroll: null,
      naicsDescription: null,
      name: null,
    };
  }

  let estab = 0;
  let emp = 0;
  let payAnnThousands = 0;
  let hasEstab = false;
  let hasEmp = false;
  let hasPay = false;

  for (const row of rows) {
    const e = parseIntField(row[2]);
    const p = parseIntField(row[3]);
    const em = parseIntField(row[5]);
    if (e != null) {
      estab += e;
      hasEstab = true;
    }
    if (em != null) {
      emp += em;
      hasEmp = true;
    }
    if (p != null) {
      payAnnThousands += p;
      hasPay = true;
    }
  }

  const first = rows[0]!;
  return {
    estimatedEstablishments: hasEstab ? estab : null,
    employment: hasEmp ? emp : null,
    /** PAYANN is published in thousands of USD. */
    annualPayroll: hasPay ? payAnnThousands * 1_000 : null,
    naicsDescription: first[1] ?? null,
    name: first[0] ?? null,
  };
}

export function geographyFromQuery(input: {
  state?: string | null;
  county?: string | null;
  zip?: string | null;
  name?: string | null;
}): MarketSizeGeography {
  const zip = normalizeZip(input.zip);
  const countyFips = normalizeCountyFips(input.county);
  const stateFips = postalToStateFips(input.state);
  const stateCode = input.state?.trim().toUpperCase() ?? undefined;

  if (zip) {
    return {
      level: "zip",
      label: input.name?.trim() || `ZIP ${zip}`,
      zip,
      stateCode,
      stateFips: stateFips ?? undefined,
    };
  }

  if (stateFips && countyFips) {
    const postal = stateCode ?? STATE_FIPS_TO_POSTAL[stateFips];
    return {
      level: "county",
      label: input.name?.trim() || `County ${countyFips}, ${postal ?? stateFips}`,
      stateCode: postal,
      stateFips,
      countyFips,
    };
  }

  if (stateFips) {
    const postal = stateCode ?? STATE_FIPS_TO_POSTAL[stateFips];
    return {
      level: "state",
      label: input.name?.trim() || postal || `State ${stateFips}`,
      stateCode: postal,
      stateFips,
    };
  }

  return {
    level: "us",
    label: input.name?.trim() || "United States",
  };
}

export function cbpQueryParamsFromMarketQuery(query: {
  state?: string | null;
  county?: string | null;
  zip?: string | null;
  naics: string;
}): CbpQueryParams {
  return {
    naics: normalizeNaicsCode(query.naics),
    stateFips: postalToStateFips(query.state) ?? undefined,
    countyFips: normalizeCountyFips(query.county) ?? undefined,
    zip: normalizeZip(query.zip) ?? undefined,
  };
}
