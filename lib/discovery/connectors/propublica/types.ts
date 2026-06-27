/** Public nonprofit enrichment returned to the UI (normalized, no raw API). */
export interface NonprofitOfficer {
  name: string;
  title: string | null;
  compensation: number | null;
}

export interface NonprofitEnrichment {
  ein: string;
  strein: string;
  legalName: string;
  city: string | null;
  state: string | null;
  subsection501c: string | null;
  nteeCategory: string | null;
  nteeCode: string | null;
  revenue: number | null;
  expenses: number | null;
  assets: number | null;
  officers: NonprofitOfficer[];
  executiveCompensation: number | null;
  latestForm990Year: number | null;
  form990PdfUrl: string | null;
  form990XmlUrl: string | null;
  profileUrl: string;
}

export interface NonprofitCandidate {
  ein: string;
  strein: string;
  name: string;
  city: string | null;
  state: string | null;
  nteeCode: string | null;
  confidence: number;
}

export interface NonprofitEnrichInput {
  name?: string | null;
  ein?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface NonprofitEnrichResult {
  enrichment: NonprofitEnrichment | null;
  candidates: NonprofitCandidate[];
  confidence: number;
  source: "propublica-nonprofit-explorer";
  available: boolean;
  error?: string;
}

/** Raw ProPublica search hit (internal). */
export interface ProPublicaSearchOrg {
  ein: number;
  strein?: string;
  name: string;
  sub_name?: string;
  city?: string;
  state?: string;
  ntee_code?: string;
  raw_ntee_code?: string;
  subseccd?: number;
  score?: number;
}

export interface ProPublicaSearchResponse {
  total_results: number;
  organizations: ProPublicaSearchOrg[];
}

export interface ProPublicaOrganizationRecord {
  ein: number;
  strein?: string;
  name: string;
  city?: string;
  state?: string;
  ntee_code?: string;
  subsection_code?: number;
  revenue_amount?: number;
  income_amount?: number;
  asset_amount?: number;
}

export interface ProPublicaFilingRecord {
  tax_prd_yr?: number;
  totrevenue?: number;
  totfuncexpns?: number;
  totassetsend?: number;
  compnsatncurrofcr?: number;
  pdf_url?: string | null;
}

export interface ProPublicaOrganizationResponse {
  organization: ProPublicaOrganizationRecord;
  filings_with_data?: ProPublicaFilingRecord[];
  filings_without_data?: ProPublicaFilingRecord[];
}

export interface ProPublicaConnectorStatus {
  connectorId: "propublica-nonprofit-explorer";
  label: string;
  configured: boolean;
  lastRequestAt: string | null;
  lastError: string | null;
  cacheEntries: number;
  cacheHitRate: number;
  averageLatencyMs: number;
  sampleResult: NonprofitEnrichResult | null;
}

export interface ProPublicaClientOptions {
  fetchImpl?: typeof fetch;
  cacheTtlMs?: number;
}
