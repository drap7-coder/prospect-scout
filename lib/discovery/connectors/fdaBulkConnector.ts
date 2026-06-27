import { createCatalogConnector } from "../catalog/catalogConnector";
import { FDA_RECORDS } from "../catalog/loadCatalog";

export const fdaBulkConnector = createCatalogConnector({
  id: "fda",
  label: "FDA Establishments",
  industry: "manufacturing",
  confidence: 0.86,
  records: FDA_RECORDS,
});
