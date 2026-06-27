import type { CatalogManifest, CatalogRecord } from "./types";
import ncesSchools from "../data/nces-schools.json";
import secBanks from "../data/sec-banks.json";
import secCompanies from "../data/sec-companies.json";
import cmsOrganizations from "../data/cms-organizations.json";
import fdaEstablishments from "../data/fda-establishments.json";
import irsNonprofits from "../data/irs-nonprofits.json";
import catalogManifest from "../data/catalog-manifest.json";

export const NCES_RECORDS = ncesSchools as CatalogRecord[];
export const SEC_BANK_RECORDS = secBanks as CatalogRecord[];
export const SEC_COMPANY_RECORDS = secCompanies as CatalogRecord[];
export const CMS_RECORDS = cmsOrganizations as CatalogRecord[];
export const FDA_RECORDS = fdaEstablishments as CatalogRecord[];
export const IRS_NONPROFIT_RECORDS = irsNonprofits as CatalogRecord[];
export const CATALOG_MANIFEST = catalogManifest as CatalogManifest;

export function allCatalogRecords(): CatalogRecord[] {
  return [
    ...NCES_RECORDS,
    ...SEC_BANK_RECORDS,
    ...SEC_COMPANY_RECORDS,
    ...CMS_RECORDS,
    ...FDA_RECORDS,
    ...IRS_NONPROFIT_RECORDS,
  ];
}

export function catalogRecordCountByConnector(): Record<string, number> {
  return {
    nces: NCES_RECORDS.length,
    sec: SEC_BANK_RECORDS.length + SEC_COMPANY_RECORDS.length,
    cms: CMS_RECORDS.length,
    fda: FDA_RECORDS.length,
    "irs-nonprofits": IRS_NONPROFIT_RECORDS.length,
  };
}
