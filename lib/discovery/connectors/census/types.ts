/** Geography level for a CBP market-size query. */
export type CensusGeographyLevel = "us" | "state" | "county" | "zip";

/** Human-readable geography metadata returned with market size. */
export interface MarketSizeGeography {
  level: CensusGeographyLevel;
  /** Display label, e.g. "Ohio" or "Cuyahoga County, OH". */
  label: string;
  /** US postal state code when applicable. */
  stateCode?: string;
  /** Census state FIPS (2-digit). */
  stateFips?: string;
  /** County name when applicable. */
  county?: string;
  /** County FIPS (3-digit, within state). */
  countyFips?: string;
  /** ZIP code when applicable. */
  zip?: string;
}

/** Input for {@link getMarketSize}. */
export interface MarketSizeQuery {
  /** US postal state code, e.g. OH. */
  state?: string | null;
  /** County FIPS within state (3 digits), e.g. 035. */
  county?: string | null;
  /** ZIP code when available. */
  zip?: string | null;
  /** NAICS code (2–6 digits). Defaults to 00 (all industries). */
  naics?: string | null;
}

/** County Business Patterns market sizing result. */
export interface MarketSizeResult {
  estimatedEstablishments: number | null;
  employment: number | null;
  /** Annual payroll in USD (converted from Census PAYANN thousands). */
  annualPayroll: number | null;
  naicsDescription: string | null;
  geography: MarketSizeGeography;
  naics: string;
  year: number;
  source: "census-cbp";
  cached: boolean;
  available: boolean;
  error?: string;
}

/** Raw row from Census CBP JSON API (header row excluded). */
export type CbpApiRow = [
  name: string,
  naicsLabel: string,
  estab: string,
  payAnn: string,
  payQtr1: string,
  emp: string,
  ...geoFields: string[],
];

export interface CbpQueryParams {
  naics: string;
  stateFips?: string;
  countyFips?: string;
  zip?: string;
}

export interface CensusClientOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  cacheTtlMs?: number;
}

export interface CensusConnectorStatus {
  connectorId: "census-cbp";
  label: string;
  configured: boolean;
  lastQueryAt: string | null;
  lastError: string | null;
  cacheEntries: number;
  sampleMarketSize: MarketSizeResult | null;
}
