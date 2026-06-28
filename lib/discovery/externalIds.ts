import type { Organization } from "./organization";

/** External registry identifiers extracted from connector source records. */
export interface OrganizationExternalIds {
  cik?: string;
  ein?: string;
  npi?: string;
  fdaOrganizationId?: string;
}

function normalizeEin(value: string): string | undefined {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 9) return digits;
  return undefined;
}

/** Extract CIK/EIN/NPI/FDA ids from organization source stamps. */
export function extractExternalIds(org: Organization): OrganizationExternalIds {
  const ids: OrganizationExternalIds = {};

  for (const src of org.sources) {
    const sid = src.sourceId;
    if (src.connector === "sec" && /^\d+$/.test(sid)) {
      ids.cik = sid.padStart(10, "0");
    }
    if (src.connector === "irs-nonprofits") {
      const ein = normalizeEin(sid);
      if (ein) ids.ein = ein;
    }
    if (src.connector === "erisa") {
      const einFromFiling = normalizeEin(sid.split("-")[0] ?? sid);
      if (einFromFiling) ids.ein = einFromFiling;
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

  const erisaIdMatch = org.id.match(/^erisa-(\d{9})$/i);
  if (erisaIdMatch?.[1]) {
    ids.ein = erisaIdMatch[1];
  }

  return ids;
}
