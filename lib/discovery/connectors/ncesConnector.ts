import { createCatalogConnector } from "../catalog/catalogConnector";
import { NCES_RECORDS } from "../catalog/loadCatalog";

export const ncesConnector = createCatalogConnector({
  id: "nces",
  label: "NCES / IPEDS",
  industry: "education",
  confidence: 0.92,
  records: NCES_RECORDS,
});
