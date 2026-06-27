import { createCatalogConnector } from "../catalog/catalogConnector";
import { CMS_RECORDS } from "../catalog/loadCatalog";

export const cmsBulkConnector = createCatalogConnector({
  id: "cms",
  label: "CMS Health Plans & PBMs",
  industry: "healthcare",
  confidence: 0.9,
  records: CMS_RECORDS,
});
