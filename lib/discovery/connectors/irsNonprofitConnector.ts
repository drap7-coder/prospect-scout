import { createCatalogConnector } from "../catalog/catalogConnector";
import { IRS_NONPROFIT_RECORDS } from "../catalog/loadCatalog";

export const irsNonprofitConnector = createCatalogConnector({
  id: "irs-nonprofits",
  label: "IRS Exempt Organizations",
  industry: "nonprofit",
  confidence: 0.85,
  records: IRS_NONPROFIT_RECORDS,
});
