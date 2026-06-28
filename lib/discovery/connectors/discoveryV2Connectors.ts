import type { DiscoveryConnector, ConnectorRecord } from "../connector";
import { sourceStamp } from "../connector";
import { finalizeOrganization, mergeOrganizations } from "../organization";
import type { Organization } from "../organization";
import type { SearchIntent } from "../intent";
import { filterOrganizationsByQueryText } from "../queryDiscovery";
import { getCatalogIndex } from "../catalog/catalogIndex";
import { SEC_COMPANY_RECORDS, SEC_BANK_RECORDS } from "../catalog/loadCatalog";
import { catalogRecordToOrganization } from "../catalog/normalize";

/** Wikipedia stub — query-matched public companies as web-indexed candidates. */
export const wikipediaConnector: DiscoveryConnector = {
  id: "wikipedia",
  label: "Wikipedia",

  discover(intent: SearchIntent): ConnectorRecord[] {
    const records = [...SEC_COMPANY_RECORDS, ...SEC_BANK_RECORDS].filter((r) =>
      /pharm|biotech|therapeut|drug|health|medical|hospital|insur|bank|tech|retail/i.test(
        r.name,
      ),
    );
    const orgs = filterOrganizationsByQueryText(
      records.map((r) => catalogRecordToOrganization("sec", r)),
      intent,
    );
    return orgs.slice(0, 120).map((org) => ({
      __type: "wikipedia",
      org: finalizeOrganization({
        ...org,
        sources: [
          sourceStamp("wikipedia", org.id, ["Wikipedia-indexed organization"], {
            sourceName: "Wikipedia",
            confidence: 0.55,
          }),
          ...org.sources,
        ],
      }),
    }));
  },

  normalize(record: ConnectorRecord): Organization {
    return record.org as Organization;
  },

  merge: mergeOrganizations,
};

/** State registry stub — state-scoped candidates from the catalog index. */
export const stateRegistryConnector: DiscoveryConnector = {
  id: "state-registry",
  label: "State Registry",

  discover(intent: SearchIntent): ConnectorRecord[] {
    const index = getCatalogIndex();
    const pool =
      intent.state != null
        ? (index.byState.get(intent.state) ?? []).map((i) => index.orgs[i]!)
        : index.orgs;
    return filterOrganizationsByQueryText(pool, intent)
      .slice(0, 80)
      .map((org) => ({
        __type: "state-registry",
        org: finalizeOrganization({
          ...org,
          sources: [
            sourceStamp(
              "state-registry",
              `${intent.state ?? "us"}-${org.id}`,
              ["State registry candidate"],
            ),
            ...org.sources,
          ],
        }),
      }));
  },

  normalize(record: ConnectorRecord): Organization {
    return record.org as Organization;
  },

  merge: mergeOrganizations,
};

/** Business directory stub — directory + public web candidates. */
export const businessDirectoryConnector: DiscoveryConnector = {
  id: "business-directory",
  label: "Business Directory",

  discover(intent: SearchIntent): ConnectorRecord[] {
    const index = getCatalogIndex();
    const dirIndices = index.byConnector.get("directory") ?? [];
    const webIndices = index.byConnector.get("public-web") ?? [];
    const pool = [...dirIndices, ...webIndices].map((i) => index.orgs[i]!);
    return filterOrganizationsByQueryText(pool, intent).map((org) => ({
      __type: "business-directory",
      org: finalizeOrganization({
        ...org,
        sources: [
          sourceStamp("business-directory", org.id, ["Business directory"]),
          ...org.sources,
        ],
      }),
    }));
  },

  normalize(record: ConnectorRecord): Organization {
    return record.org as Organization;
  },

  merge: mergeOrganizations,
};
