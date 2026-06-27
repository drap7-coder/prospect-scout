import { mergeOrganizations } from "../organization";
import type { Organization } from "../organization";
import type { SearchIntent } from "../intent";
import type { DiscoveryConnector, ConnectorRecord } from "../connector";
import type { CatalogRecord } from "./types";
import { catalogRecordToOrganization } from "./normalize";
import { filterCatalogByIntent } from "./filterIntent";
import { ANY_REGION } from "@/lib/search/regions";

export interface CatalogConnectorConfig {
  id: string;
  label: string;
  industry: string;
  records: CatalogRecord[];
  confidence: number;
}

/** Factory for JSON-backed authoritative catalog connectors. */
export function createCatalogConnector(
  config: CatalogConnectorConfig,
): DiscoveryConnector {
  return {
    id: config.id,
    label: config.label,

    discover(intent: SearchIntent): ConnectorRecord[] {
      const filtered = filterCatalogByIntent(config.records, intent);
      const hasStructuredFilters = Boolean(
        intent.sectorId ||
          intent.industryId ||
          intent.organizationTypeId ||
          intent.state ||
          intent.region !== ANY_REGION,
      );
      const pool =
        filtered.length > 0
          ? filtered
          : hasStructuredFilters
            ? []
            : config.records;
      return pool.map(
        (record) =>
          ({ __type: "catalog", record }) as ConnectorRecord,
      );
    },

    normalize(record: ConnectorRecord): Organization {
      const catalogRecord = record.record as CatalogRecord;
      return catalogRecordToOrganization(config.id, catalogRecord);
    },

    merge(existing: Organization, incoming: Organization): Organization {
      return mergeOrganizations(existing, incoming);
    },
  };
}
