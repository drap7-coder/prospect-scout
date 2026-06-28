import type { Organization } from "./organization";

/** External registry identifiers extracted from connector source records. */
export interface OrganizationExternalIds {
  cik?: string;
  ein?: string;
  npi?: string;
  fdaOrganizationId?: string;
}

/** Extract CIK/EIN/NPI/FDA ids from organization source stamps. */
export function extractExternalIds(org: Organization): OrganizationExternalIds {
  const ids: OrganizationExternalIds = {};

  for (const src of org.sources) {
    const sid = src.sourceId;
    if (src.connector === "sec" && /^\d+$/.test(sid)) {
      ids.cik = sid.padStart(10, "0");
    }
    if (src.connector === "irs-nonprofits" && /^\d+$/.test(sid)) {
      ids.ein = sid;
    }
    if (src.connector === "fda") {
      ids.fdaOrganizationId = sid;
    }
    if (src.connector === "cms" && !ids.npi) {
      ids.npi = sid.startsWith("npi-") ? sid.slice(4) : undefined;
    }
  }

  if (org.id.startsWith("sec-")) {
    ids.cik = org.id.slice(4).padStart(10, "0");
  }

  return ids;
}
