/** Parsed health plan row from bootstrap seed import. */
export interface HealthPlanSeedRow {
  id: string;
  name: string;
  aliases: string[];
  parentOrganization?: string;
  website?: string;
  headquarters: string;
  statesServed: string[];
  regions: string[];
  memberEstimate?: number;
  employeeEstimate?: number;
  sectorId?: string;
  industryId?: string;
  organizationType: string;
  ownership: "public" | "private" | "nonprofit" | "government";
  cmsContracts: string[];
  naicId?: string;
  npiIds: string[];
  tags: string[];
  ticker?: string;
}

export interface HealthPlanImportStats {
  rowsParsed: number;
  organizationsUpserted: number;
  sourcesUpserted: number;
  externalIdsUpserted: number;
  skipped: number;
}

export const HEALTH_PLAN_BOOTSTRAP_CONNECTOR_ID = "bootstrap-seed";
export const HEALTH_PLAN_BOOTSTRAP_SOURCE_NAME = "bootstrap-seed";
