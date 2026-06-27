import { createCatalogConnector } from "../catalog/catalogConnector";
import { SEC_BANK_RECORDS, SEC_COMPANY_RECORDS } from "../catalog/loadCatalog";

export const secBulkConnector = createCatalogConnector({
  id: "sec",
  label: "SEC / FDIC Public Companies",
  industry: "financial-services",
  confidence: 0.9,
  records: [...SEC_BANK_RECORDS, ...SEC_COMPANY_RECORDS],
});
